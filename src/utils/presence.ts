/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure proximity / Proof-of-Presence helpers (no React, no DOM) so they can be unit tested.
 * The native layer mirrors the smoothing + hysteresis rules in PresenceTracker.java.
 */

import type { LaneBeacon } from '../types';
import type { IBeaconInfo } from './bleBridge';

/** Shared iBeacon UUID of every physical Virasat Edge lane node. */
export const HERITAGE_BEACON_UUID = 'e2c56db5-dffb-48d2-b060-d0f5a71096e0';

/** Median window: long enough to tame RSSI noise, short enough to feel responsive. */
export const SMOOTHING_WINDOW_MS = 4000;
export const SMOOTHING_MAX_SAMPLES = 9;
/** A beacon silent for this long is treated as out of range (Proof-of-Presence re-locks). */
export const LIVE_BEACON_STALE_MS = 7000;

export interface RssiSample {
  rssi: number;
  at: number;
}

export interface PresenceThresholds {
  /** Enter the lane zone when the smoothed signal rises to at least this (dBm). */
  entry: number;
  /** Leave the zone only when it falls below this (dBm). */
  exit: number;
  /** Minimum signal to sign a review, on top of being inside the zone (dBm). */
  review: number;
}

export const DEFAULT_THRESHOLDS: PresenceThresholds = { entry: -68, exit: -82, review: -78 };

/** Drop samples older than the window and cap the count (oldest first). */
export function pruneSamples(
  samples: RssiSample[],
  now: number,
  windowMs: number = SMOOTHING_WINDOW_MS,
  maxSamples: number = SMOOTHING_MAX_SAMPLES
): RssiSample[] {
  const fresh = samples.filter((s) => now - s.at <= windowMs);
  return fresh.length > maxSamples ? fresh.slice(fresh.length - maxSamples) : fresh;
}

/** Median RSSI (rounded), or null with no samples. Robust to single-packet outliers. */
export function medianRssi(samples: RssiSample[]): number | null {
  if (samples.length === 0) return null;
  const values = samples.map((s) => s.rssi).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return Math.round((values[mid - 1] + values[mid]) / 2);
}

export function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

export function normalizeMac(mac: string | null | undefined): string {
  return (mac || '').trim().toUpperCase();
}

const MAC_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

export function isValidMac(mac: string): boolean {
  return MAC_PATTERN.test(normalizeMac(mac));
}

/**
 * Is this advertisement one of our heritage beacons? Matches the iBeacon UUID (most reliable),
 * the advertised name, or a MAC the visitor explicitly paired.
 */
export function isHeritageBeacon(input: {
  address: string;
  name?: string | null;
  beacon?: IBeaconInfo | null;
  pairedMac?: string | null;
}): boolean {
  if (input.beacon?.uuid && normalizeUuid(input.beacon.uuid) === normalizeUuid(HERITAGE_BEACON_UUID)) {
    return true;
  }
  const name = (input.name || '').toLowerCase();
  if (name.includes('virasat') || name.includes('vedge')) return true;
  const paired = normalizeMac(input.pairedMac);
  return paired !== '' && paired === normalizeMac(input.address);
}

/**
 * Which lane does a detected beacon belong to? Each lane node advertises its own iBeacon minor;
 * a heritage beacon with an unknown minor (or a paired non-iBeacon device) is bound to the lane
 * currently on screen.
 */
export function resolveLaneId(
  beacon: IBeaconInfo | null | undefined,
  lanes: Pick<LaneBeacon, 'id' | 'hardware'>[],
  fallbackLaneId: string
): string {
  if (beacon) {
    const match = lanes.find((l) => l.hardware.minor === beacon.minor);
    if (match) return match.id;
  }
  return fallbackLaneId;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * "Calibrate here": the visitor stands where reviews should unlock and we derive thresholds from
 * the current smoothed signal, keeping the same spacing as the defaults (exit 14 dB below entry,
 * review 10 dB below entry) so hysteresis still prevents flapping.
 */
export function thresholdsFromCalibration(smoothedRssi: number): PresenceThresholds {
  const entry = clamp(Math.round(smoothedRssi) - 2, -95, -40);
  return { entry, exit: entry - 14, review: entry - 10 };
}

export function isDefaultThresholds(t: PresenceThresholds): boolean {
  return (
    t.entry === DEFAULT_THRESHOLDS.entry &&
    t.exit === DEFAULT_THRESHOLDS.exit &&
    t.review === DEFAULT_THRESHOLDS.review
  );
}

/** Proof-of-Presence is per lane: being verified in one lane must not unlock another lane. */
export function canReviewArtisan(presentLaneId: string | null, artisanLaneId: string): boolean {
  return presentLaneId !== null && presentLaneId === artisanLaneId;
}
