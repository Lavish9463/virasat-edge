/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { VerifiedReview } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore with an on-device (IndexedDB) cache: the app keeps showing saved artisans and reviews
// with no connectivity, and writes made offline are queued and synced when the network returns.
function createFirestore(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
      },
      databaseId
    );
  } catch {
    // Already initialised (e.g. dev hot reload) or IndexedDB unavailable: reuse / fall back.
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = createFirestore();

// Test Firestore Connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Connected to database successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[Firestore] Client is offline. Please check your Firebase configuration.');
    } else {
      console.log('[Firestore] Initialized with live rules.');
    }
  }
}

testFirestoreConnection();

/**
 * Real-time listener for the shared saved-artisans list across all devices/screens.
 * Always reports the full list, including an empty one, so un-saving on one phone clears it on
 * every other phone too.
 */
export function subscribeToSavedArtisans(
  callback: (savedIds: string[]) => void
): () => void {
  const savedCollection = collection(db, 'saved_artisans');
  return onSnapshot(
    savedCollection,
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((docSnap) => {
        ids.push(docSnap.id);
      });
      callback(ids);
    },
    (error) => {
      console.warn('[Firestore] Error subscribing to saved_artisans:', error);
    }
  );
}

/**
 * Toggle saving an artisan to Firestore so it reflects on all screens
 */
export async function toggleSaveArtisanFirestore(
  artisanId: string,
  artisanName: string,
  laneName: string,
  isCurrentlySaved: boolean
) {
  const docRef = doc(db, 'saved_artisans', artisanId);
  try {
    if (isCurrentlySaved) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, {
        artisanId,
        artisanName,
        laneName,
        savedAt: new Date().toISOString(),
        serverTime: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[Firestore] Error toggling saved artisan:', error);
  }
}

/**
 * Real-time listener for verified reviews submitted with Proof of Presence
 */
export function subscribeToVerifiedReviews(
  callback: (reviews: any[]) => void
): () => void {
  const reviewsCollection = collection(db, 'artisan_reviews');
  return onSnapshot(
    reviewsCollection,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    },
    (error) => {
      console.warn('[Firestore] Error subscribing to artisan_reviews:', error);
    }
  );
}

/**
 * Save a hardware-verified review to Firestore. Only reviews signed by a real beacon detection
 * should be persisted (the security rules also require isVerifiedPresence == true).
 */
export async function saveVerifiedReviewFirestore(review: VerifiedReview & { artisanId: string }) {
  const docRef = doc(db, 'artisan_reviews', review.id);
  try {
    await setDoc(docRef, {
      ...review,
      createdAt: new Date().toISOString(),
      serverTime: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firestore] Error saving verified review:', error);
  }
}
