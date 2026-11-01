/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artisan, LaneBeacon, StreetLane } from '../types';
import {
  callNative,
  readScannerStatus,
  subscribeToBleDevices,
  subscribeToScannerStatus,
  type IBeaconInfo,
  type ScannerStatus,
} from '../utils/bleBridge';
import {
  LIVE_BEACON_STALE_MS,
  isHeritageBeacon,
  locationKey,
  medianRssi,
  pruneSamples,
  resolveLocation,
  type PresenceThresholds,
  type RssiSample,
} from '../utils/presence';

/** Smoothed, current reading from the strongest heritage beacon in range. */
export interface LiveReading {
  /** Heritage place, from the iBeacon major. */
  laneId: string;
  /** Street lane inside the place, from the iBeacon minor. */
  streetMinor: number;
  /** Median-smoothed RSSI (dBm) — use this for every decision. */
  rssi: number;
  /** Latest raw packet RSSI, for display/debugging only. */
  rawRssi: number;
  name: string;
  address: string;
  beacon: IBeaconInfo | null;
  /** Calibrated power at 1 m, from the iBeacon frame when available. */
  txPower: number;
}

interface LaneTrack {
  laneId: string;
  streetMinor: number;
  samples: RssiSample[];
  lastSeen: number;
  name: string;
  address: string;
  beacon: IBeaconInfo | null;
  rawRssi: number;
}

interface UseLiveBeaconOptions {
  /** Only true inside the native Android app; the web preview has no Bluetooth access. */
  enabled: boolean;
  beacons: LaneBeacon[];
  streets: StreetLane[];
  /** Used to tell background alerts how many masters work in each street lane. */
  artisans: Pick<Artisan, 'laneId' | 'streetMinor'>[];
  selectedLaneId: string;
  pairedMac?: string | null;
  thresholds: PresenceThresholds;
}

export function useLiveBeacon({
  enabled,
  beacons,
  streets,
  artisans,
  selectedLaneId,
  pairedMac,
  thresholds,
}: UseLiveBeaconOptions) {
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [status, setStatus] = useState<ScannerStatus | null>(null);

  const tracksRef = useRef<Map<string, LaneTrack>>(new Map());
  const lastPublishedRef = useRef('');
  const lastStatusJsonRef = useRef('');
  const lastConfigJsonRef = useRef('');
  // Latest config for the BLE callback without re-subscribing on every render.
  const configRef = useRef({ beacons, streets, selectedLaneId, pairedMac });
  configRef.current = { beacons, streets, selectedLaneId, pairedMac };

  /** Recompute the strongest fresh street lane and publish only when something visible changed. */
  const publish = useCallback(() => {
    const now = Date.now();
    let best: LiveReading | null = null;
    for (const [key, track] of Array.from(tracksRef.current.entries())) {
      if (now - track.lastSeen > LIVE_BEACON_STALE_MS) {
        tracksRef.current.delete(key);
        continue;
      }
      track.samples = pruneSamples(track.samples, now);
      const smoothed = medianRssi(track.samples) ?? track.rawRssi;
      if (best === null || smoothed > best.rssi) {
        best = {
          laneId: track.laneId,
          streetMinor: track.streetMinor,
          rssi: smoothed,
          rawRssi: track.rawRssi,
          name: track.name,
          address: track.address,
          beacon: track.beacon,
          txPower: track.beacon?.txPower ?? -59,
        };
      }
    }
    const current = best as LiveReading | null;
    const key = current
      ? `${locationKey(current.laneId, current.streetMinor)}|${current.rssi}|${current.name}|${current.address}`
      : 'none';
    if (key !== lastPublishedRef.current) {
      lastPublishedRef.current = key;
      setReading(current);
    }
  }, []);

  // Live advertisements -> per-street-lane sample windows.
  useEffect(() => {
    if (!enabled) return;
    callNative('startScan'); // also triggers the permission prompt on first launch

    const unsubscribe = subscribeToBleDevices((address, name, rssi, beacon) => {
      const cfg = configRef.current;
      if (!isHeritageBeacon({ address, name, beacon, pairedMac: cfg.pairedMac })) return;

      const { laneId, streetMinor } = resolveLocation(beacon, cfg.beacons, cfg.streets, cfg.selectedLaneId);
      const key = locationKey(laneId, streetMinor);
      const now = Date.now();
      const existing = tracksRef.current.get(key);
      tracksRef.current.set(key, {
        laneId,
        streetMinor,
        samples: pruneSamples([...(existing?.samples ?? []), { rssi, at: now }], now),
        lastSeen: now,
        name: name || existing?.name || 'Virasat Edge beacon',
        address,
        beacon: beacon ?? existing?.beacon ?? null,
        rawRssi: rssi,
      });
      publish();
    });

    // Expire beacons that stop advertising so Proof-of-Presence re-locks without new packets.
    const interval = window.setInterval(publish, 1000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      tracksRef.current.clear();
      lastPublishedRef.current = '';
      setReading(null);
    };
  }, [enabled, publish]);

  // Scanner status: pushed by native on changes, polled as a safety net, refreshed on resume.
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      const next = readScannerStatus();
      const json = JSON.stringify(next);
      if (json !== lastStatusJsonRef.current) {
        lastStatusJsonRef.current = json;
        setStatus(next);
      }
    };
    refresh();
    const unsubscribe = subscribeToScannerStatus(refresh);
    const interval = window.setInterval(refresh, 2500);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        callNative('startScan');
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  // Keep native in sync so background alerts use the same thresholds and lane names: one entry per
  // street lane of every place, keyed by the (major, minor) its beacon advertises.
  useEffect(() => {
    if (!enabled) return;
    const lanes = beacons.flatMap((b) =>
      streets.map((s) => ({
        major: b.hardware.major,
        minor: s.minor,
        laneId: locationKey(b.id, s.minor),
        laneName: `${b.laneName.split('(')[0].trim()} · ${s.name}`,
        artisanCount: artisans.filter((a) => a.laneId === b.id && a.streetMinor === s.minor).length,
      }))
    );
    const json = JSON.stringify({
      entry: thresholds.entry,
      exit: thresholds.exit,
      defaultLaneId: streets[0] ? locationKey(selectedLaneId, streets[0].minor) : null,
      pairedMac: pairedMac || null,
      lanes,
    });
    // Artisans change identity on every review sync; only push when the payload really changed.
    if (json === lastConfigJsonRef.current) return;
    lastConfigJsonRef.current = json;
    callNative('configure', json);
  }, [enabled, beacons, streets, artisans, selectedLaneId, pairedMac, thresholds.entry, thresholds.exit]);

  const actions = useMemo(
    () => ({
      requestPermissions: () => {
        callNative('requestPermissions');
      },
      requestNotifications: () => {
        callNative('requestNotificationPermission');
      },
      openBluetoothSettings: () => {
        callNative('openBluetoothSettings');
      },
      openLocationSettings: () => {
        callNative('openLocationSettings');
      },
      openAppSettings: () => {
        callNative('openAppSettings');
      },
      setBackgroundEnabled: (on: boolean) => {
        callNative('setBackgroundEnabled', on);
      },
      rescan: () => {
        callNative('startScan');
      },
    }),
    []
  );

  return { reading, status, actions };
}

export type LiveBeaconActions = ReturnType<typeof useLiveBeacon>['actions'];
