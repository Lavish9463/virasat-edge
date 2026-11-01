/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Bluetooth,
  Radio,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Package,
  Lock,
  Globe,
  Server,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { calculateDistanceFromRssi } from '../utils/beaconLogic';
import { callNative, subscribeToBleDevices, type IBeaconInfo } from '../utils/bleBridge';
import { isHeritageBeacon, isValidMac, normalizeMac, HERITAGE_BEACON_UUID } from '../utils/presence';
import type { LiveReading } from '../hooks/useLiveBeacon';
import { PairedHardware } from '../types';

interface BleHardwareScannerModalProps {
  isNative: boolean;
  onClose: () => void;
  activeBeaconCode: string;
  pairedHardware: PairedHardware | null;
  liveReading: LiveReading | null;
  onSavePairedHardware: (hardware: PairedHardware) => void;
  onForgetHardware: () => void;
}

interface DiscoveredNode {
  address: string;
  name: string;
  rssi: number;
  beacon: IBeaconInfo | null;
  isHeritage: boolean;
  lastSeen: number;
}

const MAX_LISTED_DEVICES = 25;
const pairedTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const BleHardwareScannerModal: React.FC<BleHardwareScannerModalProps> = ({
  isNative,
  onClose,
  activeBeaconCode,
  pairedHardware,
  liveReading,
  onSavePairedHardware,
  onForgetHardware,
}) => {
  const [activeStepTab, setActiveStepTab] = useState<'guide' | 'scanner' | 'apk'>('scanner');
  const [pairingMethod, setPairingMethod] = useState<'ble' | 'mac' | 'ip'>('ble');

  // Live nearby-device list (native only), keyed by address.
  const [nodes, setNodes] = useState<Record<string, DiscoveredNode>>({});
  const [webBleStatus, setWebBleStatus] = useState<string | null>(null);

  const [inputMacAddress, setInputMacAddress] = useState<string>('B0:A6:04:00:77:1E');
  const [macStatus, setMacStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [inputIpAddress, setInputIpAddress] = useState<string>('192.168.4.1');
  const [isPingingIp, setIsPingingIp] = useState(false);
  const [ipStatus, setIpStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const pairedMacRef = useRef(pairedHardware?.macAddress ?? null);
  pairedMacRef.current = pairedHardware?.macAddress ?? null;

  const hasWebBluetooth = !isNative && typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const showLiveList = isNative && !pairedHardware && activeStepTab === 'scanner' && pairingMethod === 'ble';

  // Listen to the (already continuous, natively managed) scan while the list is on screen.
  useEffect(() => {
    if (!showLiveList) return;
    callNative('startScan'); // idempotent; prompts for permission if still missing
    const unsubscribe = subscribeToBleDevices((address, name, rssi, beacon) => {
      setNodes((prev) => ({
        ...prev,
        [address]: {
          address,
          name: name || prev[address]?.name || `BLE device (${address.slice(-5)})`,
          rssi,
          beacon: beacon ?? prev[address]?.beacon ?? null,
          isHeritage: isHeritageBeacon({ address, name, beacon, pairedMac: pairedMacRef.current }),
          lastSeen: Date.now(),
        },
      }));
    });
    // Drop devices that have gone quiet so the list reflects what is actually nearby.
    const prune = window.setInterval(() => {
      const cutoff = Date.now() - 15000;
      setNodes((prev) => {
        const next: Record<string, DiscoveredNode> = {};
        for (const [addr, node] of Object.entries(prev)) if (node.lastSeen >= cutoff) next[addr] = node;
        return next;
      });
    }, 3000);
    return () => {
      unsubscribe();
      window.clearInterval(prune);
    };
  }, [showLiveList]);

  // Virasat beacons first, then strongest signal; capped so crowded venues stay readable.
  const sortedNodes = useMemo(
    () =>
      Object.values(nodes)
        .sort((a, b) => Number(b.isHeritage) - Number(a.isHeritage) || b.rssi - a.rssi)
        .slice(0, MAX_LISTED_DEVICES),
    [nodes]
  );

  const pairNode = (node: DiscoveredNode) => {
    onSavePairedHardware({
      id: node.address,
      name: node.name,
      pairedAt: pairedTime(),
      beaconCode: node.beacon ? `minor ${node.beacon.minor}` : node.address.slice(-5).replace(':', ''),
      rssi: node.rssi,
      distanceMeters: calculateDistanceFromRssi(node.rssi, node.beacon?.txPower ?? -59),
      autoReconnect: true,
      macAddress: normalizeMac(node.address),
      connectionType: 'ble',
    });
  };

  // Web preview only: Chrome's device chooser. It cannot report signal strength.
  const handleWebBluetooth = async () => {
    try {
      setWebBleStatus('Opening the browser’s Bluetooth device chooser…');
      const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true });
      onSavePairedHardware({
        id: device.id || 'web-bluetooth-device',
        name: device.name || 'Bluetooth device',
        pairedAt: pairedTime(),
        beaconCode: activeBeaconCode,
        autoReconnect: true,
        connectionType: 'ble',
      });
      setWebBleStatus(null);
    } catch (err: any) {
      setWebBleStatus(err?.name === 'NotFoundError' ? 'Cancelled.' : 'Bluetooth chooser unavailable in this browser.');
    }
  };

  const handlePairByMacAddress = () => {
    const mac = normalizeMac(inputMacAddress);
    if (!isValidMac(mac)) {
      setMacStatus({ ok: false, text: 'Enter a MAC like B0:A6:04:00:77:1E (six hex pairs separated by colons).' });
      return;
    }
    onSavePairedHardware({
      id: mac,
      name: `ESP32 Beacon (${mac})`,
      pairedAt: pairedTime(),
      beaconCode: mac.slice(-5).replace(':', ''),
      autoReconnect: true,
      macAddress: mac,
      connectionType: 'mac',
    });
    setMacStatus({ ok: true, text: `Saved ${mac}. It counts as soon as your phone hears its signal.` });
  };

  const handlePairByIpAddress = async () => {
    const rawIp = inputIpAddress.trim();
    if (!rawIp) {
      setIpStatus({ ok: false, text: 'Enter the ESP32’s IP address, e.g. 192.168.4.1.' });
      return;
    }
    const targetUrl = rawIp.startsWith('http') ? rawIp : `http://${rawIp}`;
    setIsPingingIp(true);
    setIpStatus(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);
    try {
      // no-cors: an opaque response still proves the device answered; a network error rejects.
      await fetch(targetUrl, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
      onSavePairedHardware({
        id: `IP:${rawIp}`,
        name: `ESP32 Wi-Fi Node (${rawIp})`,
        pairedAt: pairedTime(),
        beaconCode: `IP-${rawIp.split('.').pop() || '1'}`,
        autoReconnect: true,
        ipAddress: rawIp,
        connectionType: 'ip',
      });
      setIpStatus({ ok: true, text: `${targetUrl} answered. Saved as a Wi-Fi link.` });
    } catch {
      setIpStatus({
        ok: false,
        text: `No answer from ${targetUrl}. Join the ESP32’s Wi-Fi (or the same network) and try again.`,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsPingingIp(false);
    }
  };

  // Only a Bluetooth reading from the paired MAC counts; a Wi-Fi link never proves presence.
  const pairedIsLive =
    !!pairedHardware?.macAddress &&
    !!liveReading &&
    normalizeMac(pairedHardware.macAddress) === normalizeMac(liveReading.address);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ble-modal-title"
      className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-stone-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Real Hardware Setup
              </span>
              <h3 id="ble-modal-title" className="text-sm font-bold text-stone-100">
                ESP32 Beacon Manager
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            aria-label="Close Hardware Manager"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Tab Toggle */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 p-1.5 shrink-0 gap-1">
          {(
            [
              { id: 'scanner', label: '1. Pair', icon: <Radio className="w-3.5 h-3.5" /> },
              { id: 'guide', label: '2. Setup Steps', icon: <Info className="w-3.5 h-3.5" /> },
              { id: 'apk', label: '3. Build APK', icon: <Package className="w-3.5 h-3.5" /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStepTab(tab.id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeStepTab === tab.id
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Pairing */}
        {activeStepTab === 'scanner' && (
          <div className="p-4 overflow-y-auto space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Pairing is optional: any beacon advertising the Virasat iBeacon UUID or the name “Virasat Edge” is
                recognised automatically. Pair only if your node uses a different name or no iBeacon frame.
              </span>
            </div>

            {pairedHardware ? (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-stone-100 text-sm truncate">{pairedHardware.name}</h4>
                      <p className="text-[11px] text-stone-400">
                        Saved on this phone · paired {pairedHardware.pairedAt}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold text-[11px] px-2 py-1 rounded-lg border shrink-0 ${
                      pairedIsLive
                        ? 'text-emerald-300 bg-emerald-950 border-emerald-500/40'
                        : 'text-stone-400 bg-stone-900 border-stone-700'
                    }`}
                  >
                    {pairedIsLive && liveReading ? `${liveReading.rssi} dBm` : 'not in range'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-stone-900/80 p-2.5 rounded-xl border border-stone-800">
                  <div className="col-span-2">
                    <span className="text-stone-400 block text-[10px]">Live status</span>
                    <span className={pairedIsLive ? 'text-emerald-300 font-semibold' : 'text-stone-300'}>
                      {pairedIsLive && liveReading
                        ? `Heard now at ${liveReading.rssi} dBm (~${calculateDistanceFromRssi(liveReading.rssi, liveReading.txPower)} m)`
                        : isNative
                          ? 'Not heard right now — power it on or walk closer.'
                          : 'Live signal is only available in the Android app.'}
                    </span>
                  </div>
                  {pairedHardware.macAddress && (
                    <div className="col-span-2">
                      <span className="text-stone-400 block text-[10px]">MAC address</span>
                      <span className="font-mono text-amber-300">{pairedHardware.macAddress}</span>
                    </div>
                  )}
                  {pairedHardware.ipAddress && (
                    <div className="col-span-2">
                      <span className="text-stone-400 block text-[10px]">Wi-Fi address</span>
                      <span className="font-mono text-emerald-300">http://{pairedHardware.ipAddress}</span>
                      <span className="block text-[10px] text-stone-500 mt-0.5">
                        Wi-Fi link only — Proof-of-Presence still uses the Bluetooth signal.
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800 text-[11px] text-stone-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Stored in app storage — it survives restarts until you unpair.</span>
                </div>

                <button
                  onClick={onForgetHardware}
                  className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition border border-rose-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unpair this device</span>
                </button>
              </div>
            ) : (
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-4">
                {/* Method Selector */}
                <div className="flex bg-stone-900 p-1 rounded-xl border border-stone-800 gap-1 text-[11px]">
                  {(
                    [
                      { id: 'ble', label: 'BLE Scan', icon: <Bluetooth className="w-3.5 h-3.5" /> },
                      { id: 'mac', label: 'MAC Address', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                      { id: 'ip', label: 'Wi-Fi IP', icon: <Globe className="w-3.5 h-3.5" /> },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPairingMethod(m.id)}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
                        pairingMethod === m.id ? 'bg-amber-500 text-stone-950 shadow' : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Method 1: BLE */}
                {pairingMethod === 'ble' &&
                  (isNative ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Nearby devices (live) · {sortedNodes.length}
                        </span>
                        <button
                          onClick={() => setNodes({})}
                          className="text-[10px] text-stone-400 hover:text-stone-200 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Clear
                        </button>
                      </div>
                      {sortedNodes.length === 0 ? (
                        <div className="p-4 text-center rounded-xl bg-stone-900 border border-stone-800 text-[11px] text-stone-400">
                          Listening… make sure Bluetooth is on and the ESP32 is powered.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {sortedNodes.map((node) => (
                            <div
                              key={node.address}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                node.isHeritage ? 'bg-amber-950/30 border-amber-500/40' : 'bg-stone-900 border-stone-800'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-stone-100 text-xs truncate">{node.name}</span>
                                  {node.isHeritage && (
                                    <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 rounded border border-amber-500/30 shrink-0">
                                      VIRASAT
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] text-stone-400 block truncate">
                                  {node.address} · {node.rssi} dBm
                                  {node.beacon ? ` · minor ${node.beacon.minor}` : ''}
                                </span>
                              </div>
                              <button
                                onClick={() => pairNode(node)}
                                className="py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs shrink-0"
                              >
                                Pair
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-stone-300">
                        Live Bluetooth scanning (and Proof-of-Presence) needs the installed Android app — browsers can’t
                        read beacon signal strength.
                      </p>
                      {hasWebBluetooth && (
                        <button
                          onClick={handleWebBluetooth}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                          <Bluetooth className="w-4 h-4" />
                          Choose a device (browser)
                        </button>
                      )}
                      {webBleStatus && <p className="text-[11px] text-stone-400">{webBleStatus}</p>}
                    </div>
                  ))}

                {/* Method 2: MAC */}
                {pairingMethod === 'mac' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="mac-input" className="text-xs font-bold text-stone-200 block mb-1">
                        Beacon MAC address
                      </label>
                      <input
                        id="mac-input"
                        type="text"
                        value={inputMacAddress}
                        onChange={(e) => {
                          setInputMacAddress(e.target.value);
                          setMacStatus(null);
                        }}
                        placeholder="e.g. B0:A6:04:00:77:1E"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:border-amber-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-stone-500 mt-1">
                        Find it in nRF Connect under the device name. Your Virasat node is pre-filled.
                      </p>
                    </div>

                    {macStatus && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] ${
                          macStatus.ok
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {macStatus.text}
                      </div>
                    )}

                    <button
                      onClick={handlePairByMacAddress}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Save this beacon</span>
                    </button>
                  </div>
                )}

                {/* Method 3: Wi-Fi IP */}
                {pairingMethod === 'ip' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="ip-input" className="text-xs font-bold text-stone-200 block mb-1">
                        ESP32 Wi-Fi / SoftAP IP address
                      </label>
                      <input
                        id="ip-input"
                        type="text"
                        inputMode="decimal"
                        value={inputIpAddress}
                        onChange={(e) => {
                          setInputIpAddress(e.target.value);
                          setIpStatus(null);
                        }}
                        placeholder="e.g. 192.168.4.1"
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:border-amber-500 focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {['192.168.4.1', '192.168.1.100'].map((ip) => (
                          <button
                            key={ip}
                            onClick={() => setInputIpAddress(ip)}
                            className="text-[10px] font-mono px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-emerald-300 hover:border-emerald-500/50"
                          >
                            {ip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {ipStatus && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] ${
                          ipStatus.ok
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {ipStatus.text}
                      </div>
                    )}

                    <button
                      onClick={handlePairByIpAddress}
                      disabled={isPingingIp}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {isPingingIp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Checking…</span>
                        </>
                      ) : (
                        <>
                          <Server className="w-4 h-4" />
                          <span>Test connection & save</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-stone-500">
                      A Wi-Fi link confirms the node is online; proximity and Proof-of-Presence always use Bluetooth.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Setup Steps */}
        {activeStepTab === 'guide' && (
          <div className="p-4 overflow-y-auto space-y-2.5 text-xs">
            {[
              {
                title: '1. Flash the ESP32 as an iBeacon',
                body: (
                  <>
                    UUID <code className="text-amber-300 break-all">{HERITAGE_BEACON_UUID}</code>, major = place (
                    <code className="text-amber-300">101</code> = Gangaur Ghat … <code className="text-amber-300">104</code> =
                    Bhatiyani), minor = street lane (<code className="text-amber-300">2001</code>–
                    <code className="text-amber-300">2003</code> = Street Lane 1–3), measured power{' '}
                    <code className="text-amber-300">-59 dBm</code> at 1 m, device name “Virasat Edge”.
                  </>
                ),
              },
              {
                title: '2. Allow access on the phone',
                body: 'On first launch allow “Nearby devices” (Bluetooth) and notifications. Android 11 and older also need Location switched on for Bluetooth scanning.',
              },
              {
                title: '3. Walk to the lane',
                body: `The Nearby tab switches to the place and street lane it detects (e.g. major 101 / minor 2002 = Gangaur Ghat Marg, Street Lane 2). Reviews unlock within roughly 2–3 m of that lane's beacon and lock again ~7 s after the signal disappears. Use “Unlock reviews from here” (About → Beacon hardware) to calibrate for your phone and venue.`,
              },
              {
                title: '4. Alerts with the app closed',
                body: 'Keep “Lane alerts with the app closed” on: a persistent notification shows while it watches, and you get an alert with vibration when you walk into a lane.',
              },
            ].map((step) => (
              <div key={step.title} className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="font-bold text-amber-400 text-xs">{step.title}</span>
                <p className="text-stone-300 text-[11px] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Build APK */}
        {activeStepTab === 'apk' && (
          <div className="p-4 overflow-y-auto space-y-3 text-xs">
            <p className="text-[11px] text-stone-300 leading-relaxed">
              The Android project is already set up with Capacitor. From the project folder:
            </p>
            {[
              { title: 'Install dependencies', cmd: 'npm install' },
              { title: 'Build the web app and copy it into Android', cmd: 'npm run android:sync' },
              { title: 'Build the APK (or open in Android Studio: npx cap open android)', cmd: 'cd android && gradlew assembleDebug' },
            ].map((step, i) => (
              <div key={step.cmd} className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-1.5">
                <span className="font-bold text-[11px] text-amber-400">
                  Step {i + 1}: {step.title}
                </span>
                <pre className="bg-stone-900 p-2.5 rounded-xl border border-stone-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                  {step.cmd}
                </pre>
              </div>
            ))}
            <p className="text-[10px] text-stone-400">
              Output: <code className="text-amber-300">android/app/build/outputs/apk/debug/app-debug.apk</code>
            </p>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
