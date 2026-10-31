/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceFromRssi,
  checkHysteresisProximity,
  getCrowdDensityInfo,
  canSubmitReviewWithProof,
} from './beaconLogic';

test('calculateDistanceFromRssi estimates reasonable distance in meters', () => {
  // At TxPower (-59 dBm) distance should be approximately 1.0m
  const d1 = calculateDistanceFromRssi(-59, -59);
  assert.equal(d1, 1);

  // Weaker signal should indicate larger distance
  const dFar = calculateDistanceFromRssi(-80, -59);
  assert.ok(dFar > 5, `Expected distance > 5m, got ${dFar}`);

  // Disconnected / zero signal returns default max range
  assert.equal(calculateDistanceFromRssi(0), 999);
});

test('checkHysteresisProximity prevents rapid signal flapping', () => {
  const entry = -68;
  const exit = -82;

  // Not currently inside:
  // RSSI at -70 dBm does not trigger entry (below -68)
  assert.equal(checkHysteresisProximity(-70, false, entry, exit), false);
  // RSSI at -65 dBm triggers entry
  assert.equal(checkHysteresisProximity(-65, false, entry, exit), true);

  // Currently inside:
  // Signal weakens to -75 dBm: remains inside because it is above exit (-82)
  assert.equal(checkHysteresisProximity(-75, true, entry, exit), true);
  // Signal weakens past exit to -85 dBm: triggers exit
  assert.equal(checkHysteresisProximity(-85, true, entry, exit), false);
});

test('getCrowdDensityInfo correctly categorizes Edge Impulse pedestrian headcount', () => {
  const serene = getCrowdDensityInfo(3);
  assert.equal(serene.status, 'serene');

  const moderate = getCrowdDensityInfo(10);
  assert.equal(moderate.status, 'moderate');

  const busy = getCrowdDensityInfo(22);
  assert.equal(busy.status, 'busy');
});

test('canSubmitReviewWithProof enforces physical presence anti-bot gating', () => {
  // Without beacon detection -> locked
  const noBeacon = canSubmitReviewWithProof(false, -60);
  assert.equal(noBeacon.canReview, false);
  assert.ok(noBeacon.reason.includes('Physical Presence Required'));

  // With beacon detected but weak signal -> locked
  const weakSignal = canSubmitReviewWithProof(true, -85, -78);
  assert.equal(weakSignal.canReview, false);
  assert.ok(weakSignal.reason.includes('too weak'));

  // With strong beacon signal -> unlocked
  const strongSignal = canSubmitReviewWithProof(true, -62, -78);
  assert.equal(strongSignal.canReview, true);
  assert.ok(strongSignal.verificationConfidence >= 75);
});
