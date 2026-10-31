/**
 * Security-rules tests for firestore.rules, run against the Firestore emulator:
 *   npm run test:rules
 * Requests go through the normal client SDK (no admin), so every read/write is checked by the rules.
 */

import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  terminate,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const PROJECT = 'demo-virasat';
const HOST = '127.0.0.1';
const PORT = 8085;
const EMULATOR = `http://${HOST}:${PORT}`;
const DOCS = `${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`;

let app;
let db;

const allowed = (promise) => assert.doesNotReject(promise);
const denied = (promise) => assert.rejects(promise, (err) => err.code === 'permission-denied');

/** Write a document with admin rights (bypasses rules) to set up a scenario. */
async function seed(path, fields) {
  const toValue = (v) =>
    typeof v === 'boolean' ? { booleanValue: v }
      : Number.isInteger(v) ? { integerValue: String(v) }
        : typeof v === 'number' ? { doubleValue: v }
          : { stringValue: String(v) };
  const res = await fetch(`${DOCS}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  assert.equal(res.status, 200, await res.text());
}

/** Exactly what src/firebase.ts writes when an artisan is saved. */
const savedDoc = (artisanId, overrides = {}) => ({
  artisanId,
  artisanName: 'Pt. Mohanlal Mewar Chitrakar',
  laneName: 'Gangaur Ghat Marg',
  savedAt: new Date().toISOString(),
  serverTime: serverTimestamp(),
  ...overrides,
});

/** Exactly what the app writes for a hardware-verified review. */
const reviewId = () => `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const reviewDoc = (id, overrides = {}) => ({
  id,
  artisanId: 'artisan-mohanlal-miniature',
  userName: 'Asha Verma',
  userCity: 'Jaipur',
  date: '31 Oct 2026',
  rating: 5,
  comment: 'Watched the master grind lapis lazuli pigment by hand.',
  proofOfPresenceBeaconId: 'ESP32-VEDGE-01 · major 101 / minor 2001',
  verifiedRssi: -61,
  tags: ['Authentic Handcrafted', 'Fair Direct Price'],
  isVerifiedPresence: true,
  presenceSource: 'ble',
  createdAt: new Date().toISOString(),
  serverTime: serverTimestamp(),
  ...overrides,
});

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const res = await fetch(`${EMULATOR}/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: 'PUT',
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  });
  assert.equal(res.status, 200, `rules failed to load: ${await res.text()}`);

  app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key' });
  db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, PORT);
});

beforeEach(async () => {
  await fetch(`${DOCS}`, { method: 'DELETE' });
});

after(async () => {
  await terminate(db);
  await deleteApp(app);
});

// --- connectivity probe -------------------------------------------------------------------------

test('the boot-time connection probe is readable but not writable', async () => {
  await allowed(getDoc(doc(db, 'test', 'connection')));
  await denied(setDoc(doc(db, 'test', 'connection'), { hacked: true }));
  await denied(getDoc(doc(db, 'test', 'something-else')));
});

// --- saved artisans -----------------------------------------------------------------------------

test('saving and un-saving a real artisan works (what the app does)', async () => {
  const ref = doc(db, 'saved_artisans', 'artisan-mohanlal-miniature');
  await allowed(setDoc(ref, savedDoc('artisan-mohanlal-miniature')));
  await allowed(setDoc(ref, savedDoc('artisan-mohanlal-miniature'))); // saving again = update
  await allowed(getDocs(collection(db, 'saved_artisans')));
  await allowed(deleteDoc(ref));
});

test('the saved list rejects unknown artisans, extra fields and forged data', async () => {
  await denied(setDoc(doc(db, 'saved_artisans', 'spam-entry'), savedDoc('spam-entry')));
  const ref = doc(db, 'saved_artisans', 'artisan-mohanlal-miniature');
  await denied(setDoc(ref, savedDoc('artisan-mohanlal-miniature', { link: 'http://spam.example' })));
  await denied(setDoc(ref, savedDoc('artisan-gopaldas-sweets'))); // id/field mismatch
  await denied(setDoc(ref, savedDoc('artisan-mohanlal-miniature', { serverTime: new Date(0) })));
  await denied(setDoc(ref, savedDoc('artisan-mohanlal-miniature', { artisanName: 'x'.repeat(500) })));
  const { laneName, ...missingField } = savedDoc('artisan-mohanlal-miniature');
  await denied(setDoc(ref, missingField));
  await denied(deleteDoc(doc(db, 'saved_artisans', 'spam-entry')));
});

// --- reviews ------------------------------------------------------------------------------------

test('a hardware-verified review from the app is accepted and readable', async () => {
  const id = reviewId();
  await allowed(setDoc(doc(db, 'artisan_reviews', id), reviewDoc(id)));
  await allowed(getDocs(collection(db, 'artisan_reviews')));
});

test('reviews without real beacon verification are rejected', async () => {
  for (const overrides of [{ isVerifiedPresence: false }, { presenceSource: 'simulator' }]) {
    const id = reviewId();
    await denied(setDoc(doc(db, 'artisan_reviews', id), reviewDoc(id, overrides)));
  }
  const id = reviewId();
  const { presenceSource, ...noSource } = reviewDoc(id);
  await denied(setDoc(doc(db, 'artisan_reviews', id), noSource));
});

test('malformed or abusive reviews are rejected', async () => {
  const bad = [
    { rating: 6 },
    { rating: 0 },
    { rating: 4.5 },
    { comment: 'too short' },
    { comment: 'x'.repeat(601) },
    { userName: '' },
    { userName: 'x'.repeat(41) },
    { tags: ['Buy followers'] },
    { tags: ['Authentic Handcrafted', 'Fair Direct Price', 'Master Demonstration', 'Pure Natural Materials', 'Zero Middleman Markup', 'Warm Heritage Hospitality', 'Authentic Handcrafted'] },
    { artisanId: 'artisan-does-not-exist' },
    { verifiedRssi: -10 },
    { verifiedRssi: 'strong' },
    { serverTime: new Date(0) },
    { spamLink: 'http://spam.example' },
  ];
  for (const overrides of bad) {
    const id = reviewId();
    await denied(setDoc(doc(db, 'artisan_reviews', id), reviewDoc(id, overrides)), JSON.stringify(overrides));
  }
  // Document id must follow the app's format and match the id field.
  await denied(setDoc(doc(db, 'artisan_reviews', 'my-fake-review'), reviewDoc('my-fake-review')));
  const id = reviewId();
  await denied(setDoc(doc(db, 'artisan_reviews', id), reviewDoc(`${id}0`)));
});

test('reviews are append-only: they cannot be edited, overwritten or deleted', async () => {
  const id = reviewId();
  await seed(`artisan_reviews/${id}`, { id, rating: 5, comment: 'Original genuine review text.' });
  const ref = doc(db, 'artisan_reviews', id);
  await denied(updateDoc(ref, { rating: 1 }));
  await denied(setDoc(ref, reviewDoc(id, { rating: 1 })));
  await denied(deleteDoc(ref));
});

// --- everything else ----------------------------------------------------------------------------

test('any other collection is closed', async () => {
  await denied(setDoc(doc(db, 'users', 'u1'), { name: 'x' }));
  await denied(getDocs(collection(db, 'users')));
  await denied(setDoc(doc(db, 'anything', 'x'), { a: 1 }));
});
