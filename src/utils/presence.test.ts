/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THRESHOLDS,
  HERITAGE_BEACON_UUID,
  canReviewArtisan,
  isDefaultThresholds,
  isHeritageBeacon,
  isValidMac,
  medianRssi,
  pruneSamples,
  resolveLaneId,
  thresholdsFromCalibration,
} from './presence';
import { MOCK_BEACONS } from '../data/mockData';

// The user's physical node, exactly as nRF Connect reports it.
const REAL_BEACON = { uuid: HERITAGE_BEACON_UUID, major: 101, minor: 2001, txPower: -59 };
const REAL_MAC = 'B0:A6:04:00:77:1E';

test('medianRssi ignores single-packet outliers', () => {
  assert.equal(medianRssi([]), null);
  assert.equal(medianRssi([{ rssi: -70, at: 0 }]), -70);
  // One spike to -50 among -80s must not move the reading.
  assert.equal(
    medianRssi([
      { rssi: -80, at: 0 },
      { rssi: -50, at: 1 },
      { rssi: -81, at: 2 },
    ]),
    -80
  );
  // Even count averages the two middle values.
  assert.equal(
    medianRssi([
      { rssi: -60, at: 0 },
      { rssi: -50, at: 1 },
    ]),
    -55
  );
});

test('pruneSamples keeps only the recent window and caps the count', () => {
  const samples = [
    { rssi: -90, at: 0 },
    { rssi: -60, at: 4500 },
    { rssi: -61, at: 4600 },
  ];
  assert.deepEqual(
    pruneSamples(samples, 5000, 4000, 9).map((s) => s.rssi),
    [-60, -61]
  );
  const many = Array.from({ length: 12 }, (_, i) => ({ rssi: -60 - i, at: 1000 + i }));
  const capped = pruneSamples(many, 2000, 4000, 9);
  assert.equal(capped.length, 9);
  assert.equal(capped[0].rssi, -63); // oldest three dropped
});

test('isHeritageBeacon recognises the real node by UUID, name or paired MAC', () => {
  assert.equal(isHeritageBeacon({ address: REAL_MAC, beacon: REAL_BEACON }), true);
  // UUID comparison tolerates case and missing dashes.
  assert.equal(
    isHeritageBeacon({
      address: 'AA:BB:CC:DD:EE:FF',
      beacon: { ...REAL_BEACON, uuid: 'E2C56DB5DFFB48D2B060D0F5A71096E0' },
    }),
    true
  );
  assert.equal(isHeritageBeacon({ address: REAL_MAC, name: 'Virasat Edge' }), true);
  assert.equal(isHeritageBeacon({ address: 'b0:a6:04:00:77:1e', pairedMac: REAL_MAC }), true);
  // Random phones, earbuds and other iBeacons are ignored.
  assert.equal(isHeritageBeacon({ address: '11:22:33:44:55:66', name: 'Galaxy Buds' }), false);
  assert.equal(
    isHeritageBeacon({
      address: '11:22:33:44:55:66',
      beacon: { uuid: 'f7826da6-4fa2-4e98-8024-bc5b71e0893e', major: 1, minor: 1, txPower: -59 },
    }),
    false
  );
});

test('resolveLaneId maps a beacon to its lane by minor, else the lane on screen', () => {
  assert.equal(resolveLaneId(REAL_BEACON, MOCK_BEACONS, 'lane_hathi_pol'), 'lane_gangaur_ghat');
  assert.equal(resolveLaneId({ ...REAL_BEACON, minor: 3 }, MOCK_BEACONS, 'x'), 'lane_hathi_pol');
  assert.equal(resolveLaneId({ ...REAL_BEACON, minor: 9999 }, MOCK_BEACONS, 'lane_bhatiyani'), 'lane_bhatiyani');
  assert.equal(resolveLaneId(null, MOCK_BEACONS, 'lane_jagdish_temple'), 'lane_jagdish_temple');
});

test('every lane node has a unique minor so lanes never collide', () => {
  const minors = MOCK_BEACONS.map((b) => b.hardware.minor);
  assert.equal(new Set(minors).size, minors.length);
});

test('calibration keeps the default spacing between entry, review and exit', () => {
  const t = thresholdsFromCalibration(-61.4);
  assert.deepEqual(t, { entry: -63, exit: -77, review: -73 });
  // Clamped to a sane range.
  assert.equal(thresholdsFromCalibration(-20).entry, -40);
  assert.equal(thresholdsFromCalibration(-120).entry, -95);
  assert.equal(isDefaultThresholds(DEFAULT_THRESHOLDS), true);
  assert.equal(isDefaultThresholds(t), false);
});

test('Proof-of-Presence is per lane', () => {
  assert.equal(canReviewArtisan('lane_gangaur_ghat', 'lane_gangaur_ghat'), true);
  assert.equal(canReviewArtisan('lane_gangaur_ghat', 'lane_hathi_pol'), false);
  assert.equal(canReviewArtisan(null, 'lane_gangaur_ghat'), false);
});

test('isValidMac accepts colon-separated hex only', () => {
  assert.equal(isValidMac(REAL_MAC), true);
  assert.equal(isValidMac('b0:a6:04:00:77:1e'), true);
  assert.equal(isValidMac('B0A60400771E'), false);
  assert.equal(isValidMac('192.168.4.1'), false);
});
