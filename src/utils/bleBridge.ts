/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin typed wrapper around the native Android BLE bridge (window.AndroidBleScanner) injected by
 * MainActivity.
 *
 * The native layer calls single globals (window.onAndroidBleDeviceFound for each advertisement and
 * window.onAndroidBleStatusChanged when Bluetooth/permissions/scanning change). Several parts of
 * the UI need those callbacks at the same time, so this module fans each global out to any number
 * of subscribers instead of letting callers overwrite one another.
 */

export interface IBeaconInfo {
  uuid: string;
  major: number;
  minor: number;
  txPower: number;
}

export type BleDeviceListener = (
  address: string,
  name: string,
  rssi: number,
  beacon?: IBeaconInfo | null
) => void;

export interface ScannerStatus {
  bluetoothSupported: boolean;
  bluetoothEnabled: boolean;
  hasPermissions: boolean;
  scanning: boolean;
  mode: 'foreground' | 'background' | null;
  /** Android ScanCallback error code of the last failure (0 = none). */
  lastError: number;
  locationServicesRequired: boolean;
  locationServicesEnabled: boolean;
  backgroundEnabled: boolean;
  backgroundRunning: boolean;
  notificationsAllowed: boolean;
  // Diagnostics (optional so older native builds still parse).
  hasLocationPermission?: boolean;
  /** User picked "Approximate" location: Android then hides beacons. */
  hasCoarseOnly?: boolean;
  hasNearbyPermission?: boolean;
  /** Virasat beacon packets received in the last 10 s. */
  beaconPackets10s?: number;
  /** ms since the Virasat beacon was last heard (-1 = never). */
  lastBeaconAgoMs?: number;
  lastBeaconRssi?: number;
  packetsSinceStart?: number;
  sdkInt?: number;
}

interface NativeBleBridge {
  isNativeAvailable?: () => boolean;
  isBluetoothEnabled?: () => boolean;
  hasPermissions?: () => boolean;
  requestPermissions?: () => void;
  requestNotificationPermission?: () => void;
  startScan?: () => boolean;
  stopScan?: () => void;
  getStatusJson?: () => string;
  configure?: (json: string) => void;
  setBackgroundEnabled?: (enabled: boolean) => void;
  openBluetoothSettings?: () => void;
  openLocationSettings?: () => void;
  openAppSettings?: () => void;
}

const deviceListeners = new Set<BleDeviceListener>();
const statusListeners = new Set<() => void>();
let deviceHandlerInstalled = false;
let statusHandlerInstalled = false;

function parseBeacon(raw: unknown): IBeaconInfo | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj && typeof obj.uuid === 'string') {
      return {
        uuid: obj.uuid,
        major: Number(obj.major) || 0,
        minor: Number(obj.minor) || 0,
        txPower: Number(obj.txPower) || -59,
      };
    }
  } catch {
    // ignore malformed beacon payloads
  }
  return null;
}

function ensureDeviceHandler(): void {
  if (typeof window === 'undefined' || deviceHandlerInstalled) return;
  (window as any).onAndroidBleDeviceFound = (
    address: string,
    name: string,
    rssi: number,
    beaconRaw?: unknown
  ) => {
    const beacon = parseBeacon(beaconRaw);
    deviceListeners.forEach((listener) => {
      try {
        listener(address, name || '', rssi, beacon);
      } catch {
        // A single misbehaving listener must not stop the others.
      }
    });
  };
  deviceHandlerInstalled = true;
}

function ensureStatusHandler(): void {
  if (typeof window === 'undefined' || statusHandlerInstalled) return;
  (window as any).onAndroidBleStatusChanged = () => {
    statusListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore
      }
    });
  };
  statusHandlerInstalled = true;
}

/**
 * Register a listener for native BLE scan results. Returns an unsubscribe function; callers
 * should invoke it on cleanup instead of deleting the shared global handler.
 */
export function subscribeToBleDevices(listener: BleDeviceListener): () => void {
  ensureDeviceHandler();
  deviceListeners.add(listener);
  return () => {
    deviceListeners.delete(listener);
  };
}

/** Called whenever the native side reports a Bluetooth / permission / scanning change. */
export function subscribeToScannerStatus(listener: () => void): () => void {
  ensureStatusHandler();
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Returns the native BLE bridge if the app is running inside the Android host, else null. */
export function getAndroidBleScanner(): NativeBleBridge | null {
  return typeof window !== 'undefined' ? ((window as any).AndroidBleScanner as NativeBleBridge) ?? null : null;
}

export function readScannerStatus(): ScannerStatus | null {
  const ble = getAndroidBleScanner();
  if (!ble?.getStatusJson) return null;
  try {
    return JSON.parse(ble.getStatusJson()) as ScannerStatus;
  } catch {
    return null;
  }
}

/** Invoke an optional native method without letting a bridge failure crash the UI. */
export function callNative<K extends keyof NativeBleBridge>(
  method: K,
  ...args: Parameters<NonNullable<NativeBleBridge[K]>>
): ReturnType<NonNullable<NativeBleBridge[K]>> | undefined {
  const ble = getAndroidBleScanner();
  const fn = ble?.[method] as ((...a: unknown[]) => any) | undefined;
  if (!fn) return undefined;
  try {
    return fn.apply(ble, args);
  } catch {
    return undefined;
  }
}
