/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AndroidPhoneFrame } from './components/AndroidPhoneFrame';
import { AndroidNotificationBanner } from './components/AndroidNotificationBanner';
import { NearbyStatusCard, type NearbyState } from './components/NearbyStatusCard';
import { SignalDetails } from './components/SignalDetails';
import { SimulatorControls } from './components/SimulatorControls';
import { DiscoverTab } from './components/DiscoverTab';
import { ArtisansTab } from './components/ArtisansTab';
import { FavoritesTab } from './components/FavoritesTab';
import { AboutTab } from './components/AboutTab';
import { ArtisanDetailModal } from './components/ArtisanDetailModal';
import { ProofOfPresenceReviewModal } from './components/ProofOfPresenceReviewModal';
import { AudioStoryPlayerModal } from './components/AudioStoryPlayerModal';
import { GoogleMapsIntentModal } from './components/GoogleMapsIntentModal';
import { BleHardwareScannerModal } from './components/BleHardwareScannerModal';
import { MOCK_BEACONS, MOCK_ARTISANS, STREET_LANES } from './data/mockData';
import { Artisan, AndroidTab, VerifiedReview, PairedHardware } from './types';
import {
  checkHysteresisProximity,
  canSubmitReviewWithProof,
  calculateDistanceFromRssi,
  getCrowdDensityInfo,
} from './utils/beaconLogic';
import { getScannerBlocker } from './utils/scannerBlocker';
import {
  DEFAULT_THRESHOLDS,
  canReviewArtisan,
  isDefaultThresholds,
  locationKey,
  thresholdsFromCalibration,
  type LaneLocation,
  type PresenceThresholds,
} from './utils/presence';
import { useLiveBeacon } from './hooks/useLiveBeacon';
import {
  subscribeToSavedArtisans,
  toggleSaveArtisanFirestore,
  subscribeToVerifiedReviews,
  saveVerifiedReviewFirestore,
} from './firebase';

const PAIRED_HARDWARE_KEY = 'virasat_paired_hardware';
const THRESHOLDS_KEY = 'virasat_presence_thresholds';
/** RSSI used when no beacon is heard at all: far below every threshold, so everything locks. */
const NO_SIGNAL_RSSI = -120;

function detectNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to persist ${key}`, e);
  }
}

function loadThresholds(): PresenceThresholds {
  const saved = readStorage<Partial<PresenceThresholds> | null>(THRESHOLDS_KEY, null);
  if (
    saved &&
    typeof saved.entry === 'number' &&
    typeof saved.exit === 'number' &&
    typeof saved.review === 'number'
  ) {
    return { entry: saved.entry, exit: saved.exit, review: saved.review };
  }
  return DEFAULT_THRESHOLDS;
}

const shortLaneName = (laneName: string) => laneName.split('(')[0].trim();
const streetName = (minor: number) => STREET_LANES.find((s) => s.minor === minor)?.name ?? `Lane ${minor}`;

export default function App() {
  // Inside the installed Android app Proof-of-Presence comes ONLY from the real ESP32 beacon.
  // The web preview has no Bluetooth, so it uses the on-screen simulator instead.
  const isNative = useMemo(detectNative, []);

  const beacons = MOCK_BEACONS;
  const streets = STREET_LANES;
  const [activeTab, setActiveTab] = useState<AndroidTab>('discover');
  const [artisans, setArtisans] = useState<Artisan[]>(MOCK_ARTISANS);
  const [selectedBeaconId, setSelectedBeaconId] = useState<string>('lane_gangaur_ghat');
  // Street lane the web-preview simulator stands in (the phone reads it from the beacon minor).
  const [simStreetMinor, setSimStreetMinor] = useState<number>(STREET_LANES[0].minor);
  const [pairedHardware, setPairedHardware] = useState<PairedHardware | null>(() =>
    readStorage<PairedHardware | null>(PAIRED_HARDWARE_KEY, null)
  );
  const [thresholds, setThresholds] = useState<PresenceThresholds>(loadThresholds);
  // Simulator distance: drives presence in the web preview; purely visual on the phone.
  const [userDistanceMeters, setUserDistanceMeters] = useState<number>(isNative ? 40 : 1.3);
  // Shared across all phones via Firestore (the snapshot is the source of truth).
  const [savedArtisanIds, setSavedArtisanIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // A real installed app (or a narrow mobile browser) fills the screen. Only wide desktop web
  // previews get the simulated phone bezel so it renders like a device mock-up.
  const [isPhoneFrameMode, setIsPhoneFrameMode] = useState<boolean>(() => {
    if (isNative) return false;
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });

  // Modals state
  const [activeDetailArtisan, setActiveDetailArtisan] = useState<Artisan | null>(null);
  const [reviewingArtisan, setReviewingArtisan] = useState<Artisan | null>(null);
  const [navigatingArtisan, setNavigatingArtisan] = useState<Artisan | null>(null);
  const [audioArtisan, setAudioArtisan] = useState<Artisan | null>(null);
  const [isBleGuideOpen, setIsBleGuideOpen] = useState<boolean>(false);

  // Android Heads-Up Push Notification (in-app banner; the native layer posts the system one)
  const [headsUpAlert, setHeadsUpAlert] = useState<{
    laneName: string;
    artisanCount: number;
    distanceMeters: number;
  } | null>(null);
  const [hasDismissedAlertForLane, setHasDismissedAlertForLane] = useState<string | null>(null);

  const activeBeacon = useMemo(
    () => beacons.find((b) => b.id === selectedBeaconId) || beacons[0],
    [beacons, selectedBeaconId]
  );

  // --- Real hardware (native only) ---
  const {
    reading: liveReading,
    status: scannerStatus,
    actions: bleActions,
  } = useLiveBeacon({
    enabled: isNative,
    beacons,
    streets,
    artisans,
    selectedLaneId: selectedBeaconId,
    pairedMac: pairedHardware?.macAddress,
    thresholds,
  });

  // Jump to the lane whose beacon the phone has just started detecting.
  const previousLiveLaneRef = useRef<string | null>(null);
  useEffect(() => {
    const laneId = liveReading?.laneId ?? null;
    if (laneId && laneId !== previousLiveLaneRef.current) {
      setSelectedBeaconId(laneId);
      setHasDismissedAlertForLane(null);
    }
    previousLiveLaneRef.current = laneId;
  }, [liveReading?.laneId]);

  // --- Presence model ---
  // Presence belongs to the place (beacon major) and street lane (minor) the visitor is physically
  // in: on the phone that is the beacon it detects (independent of which place is being browsed);
  // in the web preview it is the simulated place and street lane.
  const simulatedRssi = useMemo(() => {
    const d = Math.max(1, userDistanceMeters);
    // Calibrated BLE path loss for stone alleys: 1 m -> -46 dBm, 8 m -> -66 dBm, 40 m -> -82 dBm
    const rssi = Math.round(-46 - 22 * Math.log10(d));
    return Math.min(-45, Math.max(-95, rssi));
  }, [userDistanceMeters]);

  const presenceLaneId: string | null = isNative ? liveReading?.laneId ?? null : selectedBeaconId;
  const presenceStreetMinor: number | null = isNative ? liveReading?.streetMinor ?? null : simStreetMinor;
  const presenceKey =
    presenceLaneId !== null && presenceStreetMinor !== null ? locationKey(presenceLaneId, presenceStreetMinor) : null;
  const presenceRssi = isNative ? liveReading?.rssi ?? NO_SIGNAL_RSSI : simulatedRssi;
  const presenceLane = beacons.find((b) => b.id === presenceLaneId) ?? activeBeacon;
  const gateThresholds: PresenceThresholds = isNative
    ? thresholds
    : {
        entry: activeBeacon.entryThreshold,
        exit: activeBeacon.exitThreshold,
        review: DEFAULT_THRESHOLDS.review,
      };

  // Hysteresis as real state (prevents flapping and re-locks the moment the signal drops out).
  // Moving to a different street lane's beacon starts outside again.
  const [isPresenceInside, setIsPresenceInside] = useState<boolean>(false);
  const hysteresisLaneRef = useRef<string | null>(presenceKey);
  useEffect(() => {
    const laneChanged = hysteresisLaneRef.current !== presenceKey;
    hysteresisLaneRef.current = presenceKey;
    setIsPresenceInside((prev) =>
      checkHysteresisProximity(
        presenceRssi,
        laneChanged ? false : prev,
        gateThresholds.entry,
        gateThresholds.exit
      )
    );
  }, [presenceRssi, presenceKey, gateThresholds.entry, gateThresholds.exit]);

  const presenceCheck = useMemo(
    () => canSubmitReviewWithProof(isPresenceInside, presenceRssi, gateThresholds.review),
    [isPresenceInside, presenceRssi, gateThresholds.review]
  );
  /** Street lane the visitor may review right now (null = locked everywhere). */
  const presentLocation: LaneLocation | null =
    presenceCheck.canReview && presenceLaneId !== null && presenceStreetMinor !== null
      ? { laneId: presenceLaneId, streetMinor: presenceStreetMinor }
      : null;
  const mastersAt = (laneId: string, minor: number) =>
    artisans.filter((a) => a.laneId === laneId && a.streetMinor === minor).length;

  // What the radar shows for the lane currently on screen.
  const selectedIsPresenceLane = presenceLaneId === selectedBeaconId;
  const selectedInsideZone = selectedIsPresenceLane && isPresenceInside;
  const selectedRssi: number | null = isNative
    ? selectedIsPresenceLane && liveReading
      ? liveReading.rssi
      : null
    : simulatedRssi;
  const selectedDistance: number | null = isNative
    ? selectedRssi !== null
      ? calculateDistanceFromRssi(selectedRssi, liveReading?.txPower ?? activeBeacon.hardware.txPowerDbm)
      : null
    : userDistanceMeters;

  // In-app heads-up banner when entering a street lane (system notification is raised natively).
  useEffect(() => {
    if (isPresenceInside && presenceKey && presenceStreetMinor !== null && hasDismissedAlertForLane !== presenceKey) {
      setHeadsUpAlert({
        laneName: `${shortLaneName(presenceLane.laneName)} · ${streetName(presenceStreetMinor)}`,
        artisanCount: mastersAt(presenceLane.id, presenceStreetMinor),
        distanceMeters: isNative
          ? calculateDistanceFromRssi(presenceRssi, liveReading?.txPower ?? presenceLane.hardware.txPowerDbm)
          : userDistanceMeters,
      });
    } else if (!isPresenceInside) {
      setHeadsUpAlert(null);
      // Re-arm so walking back into the lane shows the alert again.
      setHasDismissedAlertForLane(null);
    }
    // presenceRssi / userDistanceMeters are deliberately not dependencies: the banner shows the
    // distance at the moment of entry and must not re-render on every packet.
  }, [isPresenceInside, presenceKey, presenceStreetMinor, hasDismissedAlertForLane, artisans, presenceLane, isNative]);

  // Real-time Firestore synchronization across all connected screens/devices
  useEffect(() => {
    // 1. Shared saved list: the snapshot (including an empty one) is the source of truth.
    const unsubscribeSaved = subscribeToSavedArtisans((firestoreSavedIds) => {
      setSavedArtisanIds(firestoreSavedIds);
    });

    // 2. Verified reviews from every phone. Only genuinely new reviews (deduped by id) are merged,
    // so counts never drop and a locally submitted review echoed back is not counted twice.
    const unsubscribeReviews = subscribeToVerifiedReviews((firestoreReviews) => {
      if (firestoreReviews.length === 0) return;
      setArtisans((prev) =>
        prev.map((artisan) => {
          const incoming = firestoreReviews.filter((r) => r.artisanId === artisan.id);
          if (incoming.length === 0) return artisan;

          const existingIds = new Set(artisan.reviews.map((r) => r.id));
          const newReviews = incoming.filter((r) => !existingIds.has(r.id));
          if (newReviews.length === 0) return artisan;

          const addedRatingTotal = newReviews.reduce(
            (sum, r) => sum + (Number(r.rating) || 5),
            0
          );
          const newCount = artisan.verifiedReviewsCount + newReviews.length;
          // Weighted against the curated base count keeps the heritage score realistic.
          const newScore =
            Math.round(
              ((artisan.verifiedHeritageScore * artisan.verifiedReviewsCount + addedRatingTotal) /
                newCount) *
                100
            ) / 100;

          return {
            ...artisan,
            reviews: [...newReviews, ...artisan.reviews],
            verifiedReviewsCount: newCount,
            verifiedHeritageScore: newScore,
          };
        })
      );
    });

    return () => {
      unsubscribeSaved();
      unsubscribeReviews();
    };
  }, []);

  // Android hardware back button: close the top-most overlay, then return to the Radar tab, and
  // only then let Android leave the app. Read via a ref so it always sees the latest state.
  const backHandlerRef = useRef<() => boolean>(() => false);
  backHandlerRef.current = () => {
    // Order matters: the review form and audio/maps sheets can sit on top of the detail sheet.
    const closers: [boolean, () => void][] = [
      [!!reviewingArtisan, () => setReviewingArtisan(null)],
      [!!audioArtisan, () => setAudioArtisan(null)],
      [!!navigatingArtisan, () => setNavigatingArtisan(null)],
      [!!activeDetailArtisan, () => setActiveDetailArtisan(null)],
      [isBleGuideOpen, () => setIsBleGuideOpen(false)],
      [
        !!headsUpAlert,
        () => {
          setHeadsUpAlert(null);
          setHasDismissedAlertForLane(presenceKey);
        },
      ],
      [activeTab !== 'discover', () => setActiveTab('discover')],
    ];
    const top = closers.find(([isOpen]) => isOpen);
    if (!top) return false;
    top[1]();
    return true;
  };
  useEffect(() => {
    (window as any).__virasatHandleBack = () => backHandlerRef.current();
    return () => {
      delete (window as any).__virasatHandleBack;
    };
  }, []);

  const handleSavePairedHardware = (hardware: PairedHardware) => {
    setPairedHardware(hardware);
    writeStorage(PAIRED_HARDWARE_KEY, hardware);
  };

  const handleForgetHardware = () => {
    setPairedHardware(null);
    writeStorage(PAIRED_HARDWARE_KEY, null);
  };

  const handleCalibrate = () => {
    if (!liveReading) return;
    const next = thresholdsFromCalibration(liveReading.rssi);
    setThresholds(next);
    writeStorage(THRESHOLDS_KEY, next);
  };

  const handleResetCalibration = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    writeStorage(THRESHOLDS_KEY, null);
  };

  const handleSelectBeacon = (id: string) => {
    setSelectedBeaconId(id);
    setHasDismissedAlertForLane(null);
  };

  const handleSelectStreet = (minor: number) => {
    setSimStreetMinor(minor);
    setHasDismissedAlertForLane(null);
  };

  // Toggle saved artisan with real-time multi-screen Firestore sync
  const handleToggleSaveArtisan = (id: string) => {
    const artisan = artisans.find((a) => a.id === id);
    const isCurrentlySaved = savedArtisanIds.includes(id);

    // Optimistic local toggle; the Firestore snapshot confirms it a moment later.
    setSavedArtisanIds((prev) =>
      isCurrentlySaved ? prev.filter((item) => item !== id) : [...prev, id]
    );

    toggleSaveArtisanFirestore(
      id,
      artisan?.name || 'Heritage Artisan',
      artisan?.laneName || 'Heritage Lane',
      isCurrentlySaved
    );
  };

  /** Review gate for one artisan, with a human explanation either way. */
  const reviewGateFor = (artisan: Artisan): { canReview: boolean; message: string } => {
    const where = (loc: LaneLocation) =>
      `${shortLaneName(beacons.find((b) => b.id === loc.laneId)?.laneName ?? 'this lane')} · ${streetName(loc.streetMinor)}`;
    const artisanWhere = where(artisan);

    if (canReviewArtisan(presentLocation, artisan)) {
      return {
        canReview: true,
        message: isNative
          ? `Your phone detects the ${artisanWhere} beacon at ${presenceRssi} dBm — you are verified on site.`
          : `Simulated presence at ${presenceRssi} dBm. Web-preview reviews are marked "Simulated", not verified.`,
      };
    }
    if (presentLocation) {
      return {
        canReview: false,
        message: `You're verified in ${where(presentLocation)}. Walk to ${artisanWhere} to review this workshop.`,
      };
    }
    if (isNative) {
      if (scannerStatus && !scannerStatus.bluetoothEnabled) {
        return { canReview: false, message: 'Turn on Bluetooth so your phone can detect the lane beacon.' };
      }
      if (scannerStatus && !scannerStatus.hasPermissions) {
        return {
          canReview: false,
          message: 'Allow Bluetooth and Location so your phone can detect the lane beacon.',
        };
      }
      if (liveReading && liveReading.laneId === artisan.laneId && liveReading.streetMinor === artisan.streetMinor) {
        return {
          canReview: false,
          message: `Signal too weak (${liveReading.rssi} dBm). Walk closer to the workshop to unlock reviews.`,
        };
      }
      return {
        canReview: false,
        message: `Walk into ${artisanWhere} — reviews unlock once your phone detects its beacon nearby.`,
      };
    }
    return {
      canReview: false,
      message:
        selectedBeaconId === artisan.laneId && simStreetMinor === artisan.streetMinor
          ? 'Move the simulator inside the lane to try a review (web preview).'
          : `Select ${artisanWhere} in the simulator and move inside the lane to try a review (web preview).`,
    };
  };

  const handleSubmitReview = (newReview: VerifiedReview) => {
    if (!reviewingArtisan) return;
    const verified = newReview.presenceSource === 'ble';

    // Only hardware-verified reviews are persisted and synced to every phone.
    if (verified) {
      saveVerifiedReviewFirestore({ ...newReview, artisanId: reviewingArtisan.id });
    }

    const applyReview = <T extends Artisan>(artisan: T): T => {
      if (!verified) return { ...artisan, reviews: [newReview, ...artisan.reviews] };
      const newCount = artisan.verifiedReviewsCount + 1;
      const newScore =
        Math.round(
          ((artisan.verifiedHeritageScore * artisan.verifiedReviewsCount + newReview.rating) /
            newCount) *
            100
        ) / 100;
      return {
        ...artisan,
        reviews: [newReview, ...artisan.reviews],
        verifiedReviewsCount: newCount,
        verifiedHeritageScore: newScore,
      };
    };

    setArtisans((prev) =>
      prev.map((artisan) => (artisan.id === reviewingArtisan.id ? applyReview(artisan) : artisan))
    );
    if (activeDetailArtisan?.id === reviewingArtisan.id) {
      setActiveDetailArtisan((prev) => (prev ? applyReview(prev) : null));
    }
  };

  const savedArtisans = useMemo(
    () => artisans.filter((a) => savedArtisanIds.includes(a.id)),
    [artisans, savedArtisanIds]
  );

  // Keep an open detail modal in sync with live review merges.
  const detailArtisan = activeDetailArtisan
    ? artisans.find((a) => a.id === activeDetailArtisan.id) ?? activeDetailArtisan
    : null;
  const detailGate = detailArtisan ? reviewGateFor(detailArtisan) : null;
  const reviewGate = reviewingArtisan ? reviewGateFor(reviewingArtisan) : null;

  const proofBeaconLabel = isNative
    ? liveReading?.beacon
      ? `${presenceLane.beaconCode} · major ${liveReading.beacon.major} / minor ${liveReading.beacon.minor}`
      : `${presenceLane.beaconCode} · ${liveReading?.address ?? 'BLE'}`
    : `${presenceLane.beaconCode} (simulated)`;

  // --- Nearby status card: one plain-language summary of where the visitor is ---
  const scannerBlocker = isNative ? getScannerBlocker(scannerStatus) : null;
  const signalLevel = ((): 0 | 1 | 2 | 3 | 4 => {
    if (selectedRssi === null) return 0;
    if (selectedRssi >= gateThresholds.entry + 6) return 4;
    if (selectedRssi >= gateThresholds.entry) return 3;
    if (selectedRssi >= gateThresholds.review) return 2;
    // A real but faint beacon still counts as "far"; in the demo it means out of range.
    return isNative ? 1 : 0;
  })();
  const nearbyState: NearbyState = scannerBlocker
    ? 'blocked'
    : selectedInsideZone
      ? 'here'
      : signalLevel > 0
        ? 'near'
        : 'searching';
  const crowdLabel = {
    serene: 'quiet right now',
    moderate: 'a little busy',
    busy: 'busy right now',
  }[getCrowdDensityInfo(activeBeacon.liveCrowdCount).status];
  const runBlockerAction = () => {
    const action = scannerBlocker?.action;
    if (action) bleActions[action]();
  };

  return (
    <div className="w-full min-h-screen bg-stone-950 font-sans">
      <AndroidPhoneFrame
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isInsideBeaconZone={isPresenceInside}
        activeLaneName={activeBeacon.laneName}
        isPhoneFrameMode={isPhoneFrameMode}
        onToggleFrameMode={() => setIsPhoneFrameMode(!isPhoneFrameMode)}
        savedCount={savedArtisanIds.length}
      >
        {/* Android Push Notification Banner */}
        {headsUpAlert && (
          <AndroidNotificationBanner
            laneName={headsUpAlert.laneName}
            artisanCount={headsUpAlert.artisanCount}
            distanceMeters={headsUpAlert.distanceMeters}
            onExplore={() => {
              setActiveTab('discover');
              setHeadsUpAlert(null);
              setHasDismissedAlertForLane(presenceKey);
            }}
            onDismiss={() => {
              setHeadsUpAlert(null);
              setHasDismissedAlertForLane(presenceKey);
            }}
          />
        )}

        {/* Tab Content Router */}
        {activeTab === 'discover' && (
          <>
            <NearbyStatusCard
              state={nearbyState}
              laneName={shortLaneName(activeBeacon.laneName)}
              streetName={selectedIsPresenceLane && presenceStreetMinor !== null ? streetName(presenceStreetMinor) : null}
              landmark={activeBeacon.landmark}
              artisanCount={
                selectedIsPresenceLane && presenceStreetMinor !== null
                  ? mastersAt(activeBeacon.id, presenceStreetMinor)
                  : artisans.filter((a) => a.laneId === activeBeacon.id).length
              }
              crowdLabel={crowdLabel}
              signalLevel={signalLevel}
              canReview={selectedIsPresenceLane && presenceCheck.canReview}
              blocker={scannerBlocker}
              onBlockerAction={runBlockerAction}
              isDemo={!isNative}
              footer={
                isNative ? undefined : (
                  <SimulatorControls
                    beacons={beacons}
                    selectedBeaconId={selectedBeaconId}
                    onSelectBeacon={handleSelectBeacon}
                    streets={streets}
                    selectedStreetMinor={simStreetMinor}
                    onSelectStreet={handleSelectStreet}
                    distanceMeters={userDistanceMeters}
                    onDistanceChange={setUserDistanceMeters}
                  />
                )
              }
            />
            <DiscoverTab
              activeBeacon={activeBeacon}
              currentStreetMinor={selectedInsideZone ? presenceStreetMinor : null}
              streets={streets}
              artisans={artisans}
              onSelectArtisan={setActiveDetailArtisan}
              onPlayAudio={setAudioArtisan}
              onStartNavigation={setNavigatingArtisan}
              savedArtisanIds={savedArtisanIds}
              onToggleSaveArtisan={handleToggleSaveArtisan}
            />
          </>
        )}

        {activeTab === 'artisans' && (
          <ArtisansTab
            artisans={artisans}
            onSelectArtisan={setActiveDetailArtisan}
            onPlayAudio={setAudioArtisan}
            onStartNavigation={setNavigatingArtisan}
            savedArtisanIds={savedArtisanIds}
            onToggleSaveArtisan={handleToggleSaveArtisan}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesTab
            savedArtisans={savedArtisans}
            onSelectArtisan={setActiveDetailArtisan}
            onRemoveFavorite={handleToggleSaveArtisan}
            onStartNavigation={setNavigatingArtisan}
            onPlayAudio={setAudioArtisan}
            onExploreArtisans={() => setActiveTab('artisans')}
          />
        )}

        {activeTab === 'about' && (
          <AboutTab
            activeBeacon={activeBeacon}
            onOpenBleGuide={() => setIsBleGuideOpen(true)}
            signalPanel={
              isNative ? (
                <SignalDetails
                  liveReading={liveReading}
                  rssi={selectedRssi}
                  distance={selectedDistance}
                  scannerStatus={scannerStatus}
                  actions={bleActions}
                  thresholds={thresholds}
                  isCalibrated={!isDefaultThresholds(thresholds)}
                  onCalibrate={handleCalibrate}
                  onResetCalibration={handleResetCalibration}
                  pairedHardware={pairedHardware}
                  onOpenBleGuide={() => setIsBleGuideOpen(true)}
                />
              ) : undefined
            }
          />
        )}
      </AndroidPhoneFrame>

      {/* Modals & Dialogs */}
      {isBleGuideOpen && (
        <BleHardwareScannerModal
          isNative={isNative}
          activeBeaconCode={activeBeacon.beaconCode}
          pairedHardware={pairedHardware}
          liveReading={liveReading}
          onSavePairedHardware={handleSavePairedHardware}
          onForgetHardware={handleForgetHardware}
          onClose={() => setIsBleGuideOpen(false)}
        />
      )}

      {detailArtisan && detailGate && (
        <ArtisanDetailModal
          artisan={detailArtisan}
          onClose={() => setActiveDetailArtisan(null)}
          canReview={detailGate.canReview}
          gateMessage={detailGate.message}
          onOpenReviewModal={() => setReviewingArtisan(detailArtisan)}
          onStartNavigation={() => setNavigatingArtisan(detailArtisan)}
          onPlayAudio={() => setAudioArtisan(detailArtisan)}
          isSaved={savedArtisanIds.includes(detailArtisan.id)}
          onToggleSave={() => handleToggleSaveArtisan(detailArtisan.id)}
        />
      )}

      {reviewingArtisan && reviewGate && (
        <ProofOfPresenceReviewModal
          artisan={reviewingArtisan}
          beaconLabel={proofBeaconLabel}
          currentRssi={presenceRssi}
          presenceSource={isNative ? 'ble' : 'simulator'}
          canSubmit={reviewGate.canReview}
          lockMessage={reviewGate.message}
          onClose={() => setReviewingArtisan(null)}
          onSubmitReview={handleSubmitReview}
        />
      )}

      {navigatingArtisan && (
        <GoogleMapsIntentModal
          artisan={navigatingArtisan}
          onClose={() => setNavigatingArtisan(null)}
        />
      )}

      {audioArtisan && (
        <AudioStoryPlayerModal
          artisan={audioArtisan}
          onClose={() => setAudioArtisan(null)}
        />
      )}
    </div>
  );
}
