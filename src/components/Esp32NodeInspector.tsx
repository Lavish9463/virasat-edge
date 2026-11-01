/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  EyeOff,
  BatteryCharging,
  DollarSign,
  Activity,
  Layers,
  CheckCircle,
  HelpCircle,
  Sun,
  ShieldCheck,
  Bluetooth,
} from 'lucide-react';
import { LaneBeacon } from '../types';

interface Esp32NodeInspectorProps {
  activeBeacon: LaneBeacon;
  onOpenBleGuide?: () => void;
}

export const Esp32NodeInspector: React.FC<Esp32NodeInspectorProps> = ({
  activeBeacon,
  onOpenBleGuide,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'privacy' | 'bom' | 'telemetry'>('architecture');

  const bomItems = [
    { component: 'ESP32-CAM AI-Thinker Module (Dual Xtensa LX6)', costInr: 280, purpose: 'On-device Edge Impulse inferencing + BLE beacon' },
    { component: 'OV2640 Sensor & 160x120 Monocular Lens', costInr: 25, purpose: 'Privacy-first downward FoV (180-190cm angle)' },
    { component: '3.7V 1200mAh LiPo Cell + 5V Solar Epoxied Pad', costInr: 35, purpose: 'Continuous autonomous zero-grid heritage operation' },
  ];

  const totalCost = bomItems.reduce((acc, curr) => acc + curr.costInr, 0);

  return (
    <div className="p-4 space-y-4 text-stone-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-950 p-4 rounded-2xl border border-stone-800 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Aravalli Build Championship • Hardware Spec
              </span>
              <h2 className="text-base font-bold text-stone-50">
                ESP32-CAM Spatial Edge Node (Rs. 340 / $4.10)
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded-lg">
              ACTIVE #{activeBeacon.beaconCode}
            </span>
          </div>
        </div>

        <p className="text-xs text-stone-300 mt-2 leading-relaxed">
          The low-cost hardware breakthrough that replaces expensive Rs. 50,000 municipal CCTV networks with privacy-preserving BLE beacons and on-device pedestrian crowd counting.
        </p>

        {onOpenBleGuide && (
          <button
            onClick={onOpenBleGuide}
            className="w-full mt-3 py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-semibold flex items-center justify-between transition"
          >
            <div className="flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>Capture Hardware Signal in Android App</span>
            </div>
            <span className="text-[10px] bg-blue-900/60 px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">
              Live Scanner & Guide →
            </span>
          </button>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-stone-800 overflow-x-auto scrollbar-none">
          {[
            { id: 'architecture', label: 'Architecture & Workflow' },
            { id: 'privacy', label: '100% Privacy Guarantee' },
            { id: 'bom', label: 'Rs. 340 Bill of Materials' },
            { id: 'telemetry', label: 'Live Node Telemetry' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition font-medium ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Architecture Workflow */}
      {activeTab === 'architecture' && (
        <div className="space-y-3">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>3-Stage Hardware to Mobile Pipeline</span>
            </h3>

            {/* Workflow steps */}
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                <div className="flex items-center justify-between font-bold text-stone-100">
                  <span className="text-amber-400">1. ESP32-CAM Node (Hardware Arch)</span>
                  <span className="text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded">At Lane Entry Arch</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-stone-300 text-[11px] list-disc list-inside">
                  <li>Mounted at 4-6 ft FOV (optimized for 180-190 cm height angles)</li>
                  <li>Edge Impulse model calculates pedestrian crowd count integers</li>
                  <li>Broadcasts non-connectable static BLE beacon identifier</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                <div className="flex items-center justify-between font-bold text-stone-100">
                  <span className="text-emerald-400">2. Android Mobile App Service (Flutter UX)</span>
                  <span className="text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded">Tourist Device</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-stone-300 text-[11px] list-disc list-inside">
                  <li>Real-time RSSI calculation with Hysteresis filtering (-68 dBm entry / -82 dBm exit)</li>
                  <li>Triggers local push alert: "You are near [Lane Name]!"</li>
                  <li>Unlocks Proof-of-Presence anti-bot review signing</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                <div className="flex items-center justify-between font-bold text-stone-100">
                  <span className="text-sky-400">3. Server & Database Schema</span>
                  <span className="text-[10px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded">Cloud Registry</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-stone-300 text-[11px] list-disc list-inside">
                  <li>Maps beacon_id to specific heritage alleyway & artisan workshops</li>
                  <li>Powers live crowd density counters and verified review feeds</li>
                  <li>1-Tap Google Maps handoff coordinates</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Privacy Guarantee */}
      {activeTab === 'privacy' && (
        <div className="space-y-3">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <EyeOff className="w-5 h-5" />
              <h3 className="text-sm font-bold">Zero Surveillance • Zero Video Frames Stored</h3>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Standard smart city proposals fail because tourists and citizens resist CCTV surveillance cameras and GPS trackers. Virasat Edge was engineered specifically with a <strong>privacy-first constraint</strong>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                <div className="font-bold text-stone-100 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>No Video Recording</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  The OV2640 sensor captures a 160x120 grayscale frame directly into volatile SRAM. The Edge Impulse model outputs a single integer (e.g., 4) and immediately zeroes the memory.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                <div className="font-bold text-stone-100 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Zero GPS Tracking</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Works inside dense stone alleys where satellite GPS fails. The phone scans for one-way Bluetooth beacon pings without transmitting location back to servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Rs. 340 Bill of Materials */}
      {activeTab === 'bom' && (
        <div className="space-y-3">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                <span>Ultra-Low Hardware Cost Breakdown</span>
              </h3>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                Total: Rs. {totalCost} / Node
              </span>
            </div>

            <div className="space-y-2">
              {bomItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs"
                >
                  <div>
                    <div className="font-bold text-stone-200">{item.component}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{item.purpose}</div>
                  </div>
                  <span className="font-bold font-mono text-amber-400 text-sm ml-2">
                    Rs. {item.costInr}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
              💡 <strong>Scalability to Municipalities:</strong> For less than Rs. 35,000 ($420), an entire historic city quarter like Udaipur Old City (100 heritage alleyways) can be fully sensor-enabled without tearing up stone pavements for fiber cabling.
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Live Telemetry */}
      {activeTab === 'telemetry' && (
        <div className="space-y-3">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold text-amber-400 uppercase font-sans tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>Realtime Sensor Telemetry: {activeBeacon.beaconCode}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                <span className="text-stone-400 block text-[10px]">Edge Impulse Headcount</span>
                <span className="text-emerald-400 font-bold text-base">
                  {activeBeacon.liveCrowdCount} Persons
                </span>
                <span className="text-[9px] text-stone-400 block mt-0.5">Latency: {activeBeacon.hardware.inferenceTimeMs} ms</span>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                <span className="text-stone-400 block text-[10px]">Power & Battery</span>
                <span className="text-amber-400 font-bold text-base flex items-center gap-1">
                  <Sun className="w-4 h-4 text-amber-400" />
                  {activeBeacon.hardware.batteryPercentage}%
                </span>
                <span className="text-[9px] text-stone-400 block mt-0.5">Solar Top-Up Active</span>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 col-span-2">
                <span className="text-stone-400 block text-[10px]">BLE Beacon UUID</span>
                <span className="text-stone-300 font-mono text-[10px] break-all">
                  {activeBeacon.hardware.bleUuid}
                </span>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-stone-400">
                  <span>Major: {activeBeacon.hardware.major}</span>
                  <span>Minor: 2001–2003 (street lanes)</span>
                  <span>TxPower: {activeBeacon.hardware.txPowerDbm} dBm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
