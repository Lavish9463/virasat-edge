/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Footprints } from 'lucide-react';
import type { LaneBeacon, StreetLane } from '../types';

interface SimulatorControlsProps {
  beacons: LaneBeacon[];
  selectedBeaconId: string;
  onSelectBeacon: (id: string) => void;
  streets: StreetLane[];
  selectedStreetMinor: number;
  onSelectStreet: (minor: number) => void;
  distanceMeters: number;
  onDistanceChange: (meters: number) => void;
}

const PRESETS = [
  { label: 'Main road', meters: 40 },
  { label: 'Lane entry', meters: 15 },
  { label: 'At the shop', meters: 1.3 },
];

/** Web-preview stand-in for walking: browsers can't read beacon signal strength. */
export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  beacons,
  selectedBeaconId,
  onSelectBeacon,
  streets,
  selectedStreetMinor,
  onSelectStreet,
  distanceMeters,
  onDistanceChange,
}) => (
  <div className="rounded-2xl bg-stone-950/60 p-3 space-y-2.5">
    <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-300">
      <Footprints className="w-4 h-4 text-amber-400" />
      Try it: walk to a lane
    </span>
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <select
        value={selectedBeaconId}
        onChange={(e) => onSelectBeacon(e.target.value)}
        aria-label="Place"
        className="min-w-0 bg-stone-900 border border-stone-700 text-stone-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
      >
        {beacons.map((b) => (
          <option key={b.id} value={b.id}>
            {b.laneName.split('(')[0].trim()}
          </option>
        ))}
      </select>
      <select
        value={selectedStreetMinor}
        onChange={(e) => onSelectStreet(Number(e.target.value))}
        aria-label="Street lane"
        className="bg-stone-900 border border-stone-700 text-stone-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
      >
        {streets.map((s) => (
          <option key={s.minor} value={s.minor}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
    <input
      type="range"
      min="1"
      max="50"
      step="0.5"
      value={distanceMeters}
      onChange={(e) => onDistanceChange(Number(e.target.value))}
      className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
      aria-label="Distance to the lane beacon"
    />
    <div className="grid grid-cols-3 gap-1.5">
      {PRESETS.map((p) => {
        const active =
          p.meters === 40 ? distanceMeters > 25 : p.meters === 15 ? distanceMeters > 7 && distanceMeters <= 25 : distanceMeters <= 7;
        return (
          <button
            key={p.label}
            onClick={() => onDistanceChange(p.meters)}
            className={`py-1.5 rounded-lg text-[11px] font-semibold border transition ${
              active ? 'bg-amber-500 text-stone-950 border-amber-400' : 'bg-stone-900 text-stone-300 border-stone-700'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  </div>
);
