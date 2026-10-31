/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScannerStatus } from './bleBridge';

export type BlockerAction =
  | 'requestPermissions'
  | 'openAppSettings'
  | 'openBluetoothSettings'
  | 'openLocationSettings'
  | 'rescan';

export interface ScannerBlocker {
  title: string;
  detail: string;
  action?: BlockerAction;
  actionLabel?: string;
}

/**
 * The single most important thing stopping the phone from hearing lane beacons, in plain language,
 * with the one tap that fixes it. Null when nothing is in the way.
 */
export function getScannerBlocker(status: ScannerStatus | null): ScannerBlocker | null {
  if (!status) {
    return { title: 'Starting Bluetooth…', detail: 'Getting your phone ready to find heritage lanes.' };
  }
  if (!status.bluetoothSupported) {
    return {
      title: 'Bluetooth not available',
      detail: 'This phone can’t scan for Bluetooth beacons, so lanes can’t be detected.',
    };
  }
  if (!status.hasPermissions) {
    if (status.hasCoarseOnly) {
      return {
        title: 'Switch Location to “Precise”',
        detail: 'Android only shows beacons to apps with precise location. Open settings → Location → Precise.',
        action: 'openAppSettings',
        actionLabel: 'Open settings',
      };
    }
    return {
      title: 'Allow Bluetooth & Location',
      detail: 'Android needs both to detect lane beacons. We never read or store your GPS position.',
      action: 'requestPermissions',
      actionLabel: 'Allow',
    };
  }
  if (!status.bluetoothEnabled) {
    return {
      title: 'Turn on Bluetooth',
      detail: 'Your phone needs Bluetooth on to hear the lane beacons.',
      action: 'openBluetoothSettings',
      actionLabel: 'Turn on Bluetooth',
    };
  }
  if (status.locationServicesRequired && !status.locationServicesEnabled) {
    return {
      title: 'Turn on Location',
      detail: 'Android hides beacons while Location is off. We never read your GPS position.',
      action: 'openLocationSettings',
      actionLabel: 'Turn on Location',
    };
  }
  if (!status.scanning && status.lastError !== 0) {
    return {
      title: 'Bluetooth scan paused',
      detail: `Android paused scanning (code ${status.lastError}). Retrying automatically.`,
      action: 'rescan',
      actionLabel: 'Try again',
    };
  }
  return null;
}
