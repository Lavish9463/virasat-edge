/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Check, X, Crosshair, RotateCcw, BellRing, Settings } from 'lucide-react';
import type { ScannerStatus } from '../utils/bleBridge';
import type { PresenceThresholds } from '../utils/presence';
import type { LiveReading, LiveBeaconActions } from '../hooks/useLiveBeacon';
import type { PairedHardware } from '../types';

interface SignalDetailsProps {
  liveReading: LiveReading | null;
  rssi: number | null;
  distance: number | null;
  scannerStatus: ScannerStatus | null;
  actions: LiveBeaconActions;
  thresholds: PresenceThresholds;
  isCalibrated: boolean;
  onCalibrate: () => void;
  onResetCalibration: () => void;
  pairedHardware: PairedHardware | null;
  onOpenBleGuide: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-stone-400">{label}</span>
    <span className="text-stone-200 text-right">{children}</span>
  </div>
);

const Check1: React.FC<{ ok: boolean; label: string; hint?: string }> = ({ ok, label, hint }) => (
  <li className="flex items-start gap-2 text-xs">
    <span
      className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
        ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
      }`}
    >
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
    </span>
    <span className={ok ? 'text-stone-300' : 'text-stone-100'}>
      {label}
      {!ok && hint && <span className="block text-stone-500">{hint}</span>}
    </span>
  </li>
);

function heardLabel(status: ScannerStatus | null): { ok: boolean; text: string } {
  const ago = status?.lastBeaconAgoMs ?? -1;
  if (ago < 0) return { ok: false, text: 'Virasat beacon not heard yet' };
  if (ago > 10_000) return { ok: false, text: `Virasat beacon last heard ${Math.round(ago / 1000)} s ago` };
  return { ok: true, text: `Virasat beacon heard ${Math.max(0, Math.round(ago / 1000))} s ago (${status?.beaconPackets10s ?? 0} signals / 10 s)` };
}

export const SignalDetails: React.FC<SignalDetailsProps> = ({
  liveReading,
  rssi,
  distance,
  scannerStatus,
  actions,
  thresholds,
  isCalibrated,
  onCalibrate,
  onResetCalibration,
  pairedHardware,
  onOpenBleGuide,
}) => {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3500);
    return () => window.clearTimeout(t);
  }, [note]);

  const s = scannerStatus;
  const heard = heardLabel(s);
  const backgroundEnabled = s?.backgroundEnabled ?? false;

  return (
    <>
      <div className="space-y-1.5">
        <Row label="Signal strength">{rssi !== null ? `${rssi} dBm` : '—'}</Row>
        <Row label="Distance">{distance !== null ? `about ${distance} m` : '—'}</Row>
        <Row label="Beacon">
          {liveReading
            ? `${liveReading.name}${liveReading.beacon ? ` · minor ${liveReading.beacon.minor}` : ''}`
            : 'Not in range'}
        </Row>
      </div>

      {/* Unlock distance calibration */}
      <div className="rounded-2xl bg-stone-950/60 p-3 space-y-2">
        <p className="text-xs text-stone-300">
          {note ??
            (isCalibrated
              ? `Reviews unlock at your saved spot (${thresholds.entry} dBm).`
              : 'Reviews unlock about 2–3 m from the beacon.')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (rssi === null) return;
              onCalibrate();
              setNote('Saved — reviews now unlock from where you’re standing.');
            }}
            disabled={rssi === null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 disabled:opacity-40"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Unlock reviews from here
          </button>
          {isCalibrated && (
            <button
              onClick={onResetCalibration}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-stone-300 bg-stone-800 border border-stone-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Background alerts */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <BellRing className={`w-4 h-4 mt-0.5 shrink-0 ${backgroundEnabled ? 'text-amber-400' : 'text-stone-500'}`} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-stone-200">Alert me with the app closed</p>
            <p className="text-[11px] text-stone-400">
              {s && !s.notificationsAllowed ? (
                <>
                  Notifications are off.{' '}
                  <button onClick={actions.requestNotifications} className="text-amber-300 underline font-semibold">
                    Turn on
                  </button>
                </>
              ) : backgroundEnabled ? (
                'On'
              ) : (
                'Off — alerts only while the app is open'
              )}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={backgroundEnabled}
          aria-label="Alert me with the app closed"
          onClick={() => actions.setBackgroundEnabled(!backgroundEnabled)}
          className={`relative w-10 h-6 rounded-full transition shrink-0 ${backgroundEnabled ? 'bg-amber-500' : 'bg-stone-700'}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${backgroundEnabled ? 'left-5' : 'left-1'}`}
          />
        </button>
      </div>

      {/* Signal check: pinpoints why a beacon isn't being detected */}
      <div className="rounded-2xl bg-stone-950/60 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Signal check</p>
        <ul className="space-y-1.5">
          <Check1 ok={!!s?.bluetoothEnabled} label="Bluetooth is on" hint="Turn Bluetooth on in quick settings." />
          <Check1
            ok={s?.hasNearbyPermission ?? !!s?.hasPermissions}
            label="Nearby devices allowed"
            hint="Settings → Apps → Virasat Edge → Permissions."
          />
          <Check1
            ok={!!s?.hasLocationPermission}
            label={s?.hasCoarseOnly ? 'Location is “Approximate”' : 'Precise location allowed'}
            hint="Android hides beacons unless Location is set to Precise."
          />
          <Check1
            ok={!s?.locationServicesRequired || !!s?.locationServicesEnabled}
            label="Location switched on"
            hint="Pull down quick settings and turn on Location."
          />
          <Check1 ok={!!s?.scanning} label="Scanning for beacons" hint="Opens automatically once the items above pass." />
          <Check1 ok={heard.ok} label={heard.text} hint="Check the ESP32 is powered and within ~20 m." />
        </ul>
        {s?.sdkInt ? <p className="text-[10px] text-stone-500 mt-2">Android API {s.sdkInt}</p> : null}
      </div>

      <button
        onClick={onOpenBleGuide}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-stone-800 text-stone-200 border border-stone-700"
      >
        <Settings className="w-3.5 h-3.5" />
        {pairedHardware ? `Paired: ${pairedHardware.name}` : 'Beacon setup & pairing'}
      </button>
    </>
  );
};
