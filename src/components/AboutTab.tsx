/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { LaneBeacon } from '../types';
import { BlueprintTab } from './BlueprintTab';
import { Esp32NodeInspector } from './Esp32NodeInspector';

interface AboutTabProps {
  activeBeacon: LaneBeacon;
  onOpenBleGuide: () => void;
  /** Live signal, unlock calibration and background alerts (installed app only). */
  signalPanel?: React.ReactNode;
}

/** Project story, live signal tools and hardware specs, kept out of the visitor's main flow. */
export const AboutTab: React.FC<AboutTabProps> = ({ activeBeacon, onOpenBleGuide, signalPanel }) => {
  const [section, setSection] = useState<'project' | 'hardware'>('project');

  return (
    <div>
      <div className="px-4 pt-4">
        <div className="flex p-1 rounded-2xl bg-stone-900 border border-stone-800" role="tablist">
          {(
            [
              { id: 'project', label: 'How it works' },
              { id: 'hardware', label: 'Beacon hardware' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                section === s.id ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {section === 'project' ? (
        <BlueprintTab />
      ) : (
        <>
          {signalPanel && (
            <section aria-label="Live signal" className="px-4 pt-4">
              <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4 space-y-3">
                <h3 className="text-sm font-bold text-stone-100">Live signal</h3>
                {signalPanel}
              </div>
            </section>
          )}
          <Esp32NodeInspector activeBeacon={activeBeacon} onOpenBleGuide={onOpenBleGuide} />
        </>
      )}
    </div>
  );
};
