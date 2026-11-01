/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Radio, X, ChevronRight, Sparkles } from 'lucide-react';

interface AndroidNotificationBannerProps {
  laneName: string;
  artisanCount: number;
  distanceMeters: number;
  onExplore: () => void;
  onDismiss: () => void;
}

export const AndroidNotificationBanner: React.FC<AndroidNotificationBannerProps> = ({
  laneName,
  artisanCount,
  distanceMeters,
  onExplore,
  onDismiss,
}) => {
  return (
    <div
      role="alert"
      className="absolute top-2 inset-x-2 z-50 animate-in slide-in-from-top-6 duration-300"
    >
      <div className="bg-stone-800/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl shadow-black/80 text-stone-100 flex flex-col gap-2">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-stone-950 font-bold text-[10px]">
              VE
            </div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              Virasat Edge • Proximity Alert
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400">Just now</span>
            <button
              onClick={onDismiss}
              className="p-1 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-700/50"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notification Body */}
        <div className="cursor-pointer" onClick={onExplore}>
          <h4 className="text-sm font-bold text-stone-50 flex items-center gap-1.5">
            <span>You are near {laneName}!</span>
          </h4>
          <p className="text-xs text-stone-300 mt-0.5 line-clamp-2">
            {artisanCount > 0
              ? `${artisanCount} verified heritage artisan${artisanCount === 1 ? ' is' : 's are'} located just ${Math.round(distanceMeters)}m inside this lane.`
              : 'Tap to browse the masters in the nearest lanes.'}
          </p>
        </div>

        {/* Quick Android Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-700/50 mt-1">
          <button
            onClick={onDismiss}
            className="text-xs px-2.5 py-1 text-stone-400 hover:text-stone-200"
          >
            Later
          </button>
          <button
            onClick={onExplore}
            className="text-xs font-semibold px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg flex items-center gap-1 shadow-md transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Artisans</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
