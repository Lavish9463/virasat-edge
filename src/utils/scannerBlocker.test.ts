/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getScannerBlocker } from './scannerBlocker';
import type { ScannerStatus } from './bleBridge';

const READY: ScannerStatus = {
  bluetoothSupported: true,
  bluetoothEnabled: true,
  hasPermissions: true,
  scanning: true,
  mode: 'foreground',
  lastError: 0,
  locationServicesRequired: true,
  locationServicesEnabled: true,
  backgroundEnabled: true,
  backgroundRunning: true,
  notificationsAllowed: true,
};

test('no blocker when everything needed for detection is in place', () => {
  assert.equal(getScannerBlocker(READY), null);
});

test('blockers are reported in the order the visitor has to fix them', () => {
  assert.equal(getScannerBlocker(null)?.title, 'Starting Bluetooth…');
  assert.equal(getScannerBlocker({ ...READY, bluetoothSupported: false })?.action, undefined);
  assert.equal(
    getScannerBlocker({ ...READY, hasPermissions: false, bluetoothEnabled: false })?.action,
    'requestPermissions'
  );
  assert.equal(getScannerBlocker({ ...READY, bluetoothEnabled: false })?.action, 'openBluetoothSettings');
  assert.equal(getScannerBlocker({ ...READY, locationServicesEnabled: false })?.action, 'openLocationSettings');
  assert.equal(getScannerBlocker({ ...READY, scanning: false, lastError: 2 })?.action, 'rescan');
});

test('"Approximate" location is explained, because Android then hides beacons', () => {
  const b = getScannerBlocker({ ...READY, hasPermissions: false, hasCoarseOnly: true });
  assert.equal(b?.action, 'openAppSettings');
  assert.match(b?.title ?? '', /Precise/);
});
