/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LaneBeacon } from '../types';
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
  medianRssi,
  pruneSamples,
  resolveLaneId,
  type PresenceThresholds,
  type RssiSample,
} from '../utils/presence';

/** Smoothed, current reading from the strongest heritage beacon in range. */
export interface LiveReading {
  laneId: string;
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
  selectedLaneId: string;
  pairedMac?: string | null;
  thresholds: PresenceThresholds;
}

export function useLiveBeacon({ enabled, beacons, selectedLaneId, pairedMac, thresholds }: UseLiveBeaconOptions) {
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [status, setStatus] = useState<ScannerStatus | null>(null);

  const tracksRef = useRef<Map<string, LaneTrack>>(new Map());
  const lastPublishedRef = useRef('');
  const lastStatusJsonRef = useRef('');
  // Latest config for the BLE callback without re-subscribing on every render.
  const configRef = useRef({ beacons, selectedLaneId, pairedMac });
  configRef.current = { beacons, selectedLaneId, pairedMac };

  /** Recompute the strongest fresh lane and publish only when something visible changed. */
  const publish = useCallback(() => {
    const now = Date.now();
    let best: LiveReading | null = null;
    for (const [laneId, track] of Array.from(tracksRef.current.entries())) {
      if (now - track.lastSeen > LIVE_BEACON_STALE_MS) {
        tracksRef.current.delete(laneId);
        continue;
      }
      track.samples = pruneSamples(track.samples, now);
      const smoothed = medianRssi(track.samples) ?? track.rawRssi;
      if (best === null || smoothed > best.rssi) {
        best = {
          laneId,
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
      ? `${current.laneId}|${current.rssi}|${current.name}|${current.address}|${current.beacon?.minor ?? ''}`
      : 'none';
    if (key !== lastPublishedRef.current) {
      lastPublishedRef.current = key;
      setReading(current);
    }
  }, []);

  // Live advertisements -> per-lane sample windows.
  useEffect(() => {
    if (!enabled) return;
    callNative('startScan'); // also triggers the permission prompt on first launch

    const unsubscribe = subscribeToBleDevices((address, name, rssi, beacon) => {
      const cfg = configRef.current;
      if (!isHeritageBeacon({ address, name, beacon, pairedMac: cfg.pairedMac })) return;

      const laneId = resolveLaneId(beacon, cfg.beacons, cfg.selectedLaneId);
      const now = Date.now();
      const existing = tracksRef.current.get(laneId);
      tracksRef.current.set(laneId, {
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

  // Keep native in sync so background alerts use the same thresholds and lane names.
  useEffect(() => {
    if (!enabled) return;
    const lanes = beacons.map((b) => ({
      minor: b.hardware.minor,
      laneId: b.id,
      laneName: b.laneName.split('(')[0].trim(),
      artisanCount: b.artisanCount,
    }));
    callNative(
      'configure',
      JSON.stringify({
        entry: thresholds.entry,
        exit: thresholds.exit,
        defaultLaneId: selectedLaneId,
        pairedMac: pairedMac || null,
        lanes,
      })
    );
  }, [enabled, beacons, selectedLaneId, pairedMac, thresholds.entry, thresholds.exit]);

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
