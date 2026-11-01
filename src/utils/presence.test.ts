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
  locationKey,
  medianRssi,
  nearestStreetLanes,
  pruneSamples,
  resolveLocation,
  thresholdsFromCalibration,
} from './presence';
import { MOCK_ARTISANS, MOCK_BEACONS, STREET_LANES } from '../data/mockData';

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

test('resolveLocation maps major to the place and minor to the street lane', () => {
  const at = (major: number, minor: number, fallback = 'x') =>
    resolveLocation({ ...REAL_BEACON, major, minor }, MOCK_BEACONS, STREET_LANES, fallback);
  assert.deepEqual(at(101, 2001, 'lane_hathi_pol'), { laneId: 'lane_gangaur_ghat', streetMinor: 2001 });
  assert.deepEqual(at(101, 2002), { laneId: 'lane_gangaur_ghat', streetMinor: 2002 });
  assert.deepEqual(at(102, 2003), { laneId: 'lane_jagdish_temple', streetMinor: 2003 });
  assert.deepEqual(at(103, 2002), { laneId: 'lane_hathi_pol', streetMinor: 2002 });
  assert.deepEqual(at(104, 2001), { laneId: 'lane_bhatiyani', streetMinor: 2001 });
  // Unknown minor -> first street lane of that place; unknown major -> the place on screen.
  assert.deepEqual(at(102, 9999), { laneId: 'lane_jagdish_temple', streetMinor: 2001 });
  assert.deepEqual(at(999, 2002, 'lane_bhatiyani'), { laneId: 'lane_bhatiyani', streetMinor: 2001 });
  assert.deepEqual(resolveLocation(null, MOCK_BEACONS, STREET_LANES, 'lane_jagdish_temple'), {
    laneId: 'lane_jagdish_temple',
    streetMinor: 2001,
  });
});

test('every place has a unique major and every street lane a unique minor', () => {
  const majors = MOCK_BEACONS.map((b) => b.hardware.major);
  assert.deepEqual(majors, [101, 102, 103, 104]);
  assert.deepEqual(
    STREET_LANES.map((s) => [s.minor, s.name]),
    [
      [2001, 'Street Lane 1'],
      [2002, 'Street Lane 2'],
      [2003, 'Street Lane 3'],
    ]
  );
  const keys = MOCK_BEACONS.flatMap((b) => STREET_LANES.map((s) => locationKey(b.id, s.minor)));
  assert.equal(new Set(keys).size, MOCK_BEACONS.length * STREET_LANES.length);
});

test('every artisan sits in a known place and street lane', () => {
  for (const a of MOCK_ARTISANS) {
    assert.ok(MOCK_BEACONS.some((b) => b.id === a.laneId), a.id);
    assert.ok(STREET_LANES.some((s) => s.minor === a.streetMinor), a.id);
  }
});

test('nearestStreetLanes offers the two closest lanes, in lane order', () => {
  const near = (minor: number) => nearestStreetLanes(minor, STREET_LANES).map((s) => s.minor);
  assert.deepEqual(near(2001), [2002, 2003]);
  assert.deepEqual(near(2002), [2001, 2003]);
  assert.deepEqual(near(2003), [2001, 2002]);
  assert.deepEqual(nearestStreetLanes(2002, STREET_LANES, 1).map((s) => s.minor), [2001]);
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

test('Proof-of-Presence is per street lane', () => {
  const lane1 = { laneId: 'lane_gangaur_ghat', streetMinor: 2001 };
  assert.equal(canReviewArtisan(lane1, { laneId: 'lane_gangaur_ghat', streetMinor: 2001 }), true);
  // Same place, neighbouring street lane: browse only.
  assert.equal(canReviewArtisan(lane1, { laneId: 'lane_gangaur_ghat', streetMinor: 2002 }), false);
  assert.equal(canReviewArtisan(lane1, { laneId: 'lane_hathi_pol', streetMinor: 2001 }), false);
  assert.equal(canReviewArtisan(null, { laneId: 'lane_gangaur_ghat', streetMinor: 2001 }), false);
});

test('isValidMac accepts colon-separated hex only', () => {
  assert.equal(isValidMac(REAL_MAC), true);
  assert.equal(isValidMac('b0:a6:04:00:77:1e'), true);
  assert.equal(isValidMac('B0A60400771E'), false);
  assert.equal(isValidMac('192.168.4.1'), false);
});
