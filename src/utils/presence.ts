/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure proximity / Proof-of-Presence helpers (no React, no DOM) so they can be unit tested.
 * The native layer mirrors the smoothing + hysteresis rules in PresenceTracker.java.
 */

import type { Artisan, LaneBeacon, StreetLane } from '../types';
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

/** Where the visitor is: a heritage place (iBeacon major) and a street lane in it (minor). */
export interface LaneLocation {
  laneId: string;
  streetMinor: number;
}

/** Stable key for one street lane of one place, e.g. "lane_gangaur_ghat#2001". */
export function locationKey(laneId: string, streetMinor: number): string {
  return `${laneId}#${streetMinor}`;
}

/**
 * Which place and street lane does a detected beacon belong to? The iBeacon major names the place,
 * the minor the street lane. An unknown minor falls back to the place's first street lane; an
 * unknown major (or a paired non-iBeacon device) to the first street lane of the place on screen.
 * BeaconScanner.java resolves lanes the same way for background alerts.
 */
export function resolveLocation(
  beacon: IBeaconInfo | null | undefined,
  lanes: Pick<LaneBeacon, 'id' | 'hardware'>[],
  streets: StreetLane[],
  fallbackLaneId: string
): LaneLocation {
  const firstStreet = streets[0]?.minor ?? 0;
  if (beacon) {
    const lane = lanes.find((l) => l.hardware.major === beacon.major);
    if (lane) {
      const street = streets.find((s) => s.minor === beacon.minor);
      return { laneId: lane.id, streetMinor: street ? street.minor : firstStreet };
    }
  }
  return { laneId: fallbackLaneId, streetMinor: firstStreet };
}

/**
 * The street lanes a visitor can browse from where they stand: the `count` lanes closest by number
 * (lane 2 -> lanes 1 and 3; lane 1 -> lanes 2 and 3), in lane order.
 */
export function nearestStreetLanes(currentMinor: number, streets: StreetLane[], count = 2): StreetLane[] {
  return streets
    .filter((s) => s.minor !== currentMinor)
    .sort((a, b) => Math.abs(a.minor - currentMinor) - Math.abs(b.minor - currentMinor) || a.minor - b.minor)
    .slice(0, count)
    .sort((a, b) => a.minor - b.minor);
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

/** Proof-of-Presence is per street lane: being verified in one lane must not unlock another. */
export function canReviewArtisan(
  present: LaneLocation | null,
  artisan: Pick<Artisan, 'laneId' | 'streetMinor'>
): boolean {
  return present !== null && present.laneId === artisan.laneId && present.streetMinor === artisan.streetMinor;
}
