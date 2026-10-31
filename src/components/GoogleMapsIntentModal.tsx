/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Navigation, MapPin, Footprints, ExternalLink, Compass } from 'lucide-react';
import { Artisan } from '../types';

interface GoogleMapsIntentModalProps {
  artisan: Artisan;
  onClose: () => void;
}

export const GoogleMapsIntentModal: React.FC<GoogleMapsIntentModalProps> = ({
  artisan,
  onClose,
}) => {
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${artisan.coordinates.lat},${artisan.coordinates.lng}&travelmode=walking`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maps-modal-title"
      className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-stone-100 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                1-Tap Walking Navigation Handoff
              </span>
              <h3 id="maps-modal-title" className="text-sm font-bold text-stone-100">
                Walking Route: {artisan.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            aria-label="Close navigation dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Simulated Map Visual */}
          <div className="relative h-44 rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 flex items-center justify-center">
            {/* Architectural Stylized Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

            {/* Street Line Drawing */}
            <svg className="w-full h-full absolute inset-0 text-stone-700" viewBox="0 0 400 200">
              {/* Main commercial road */}
              <line x1="20" y1="170" x2="380" y2="170" stroke="#78716c" strokeWidth="12" strokeLinecap="round" />
              <text x="50" y="190" fill="#a8a29e" fontSize="10" fontWeight="bold">
                COMMERCIAL MAIN ROAD (NOISY SOUVENIR SHOPS)
              </text>

              {/* Narrow Heritage Alleyway turning north */}
              <path
                d="M 200 170 L 200 60 L 270 60"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="6,4"
              />
            </svg>

            {/* Tourist Position Icon */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg animate-pulse" />
              <span className="text-[9px] bg-stone-900/90 text-blue-300 px-1 rounded font-mono mt-0.5">
                Your Location
              </span>
            </div>

            {/* Master Workshop Pin */}
            <div className="absolute top-8 right-24 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/40">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-amber-300 bg-stone-950/90 px-1.5 py-0.2 rounded border border-amber-500/30 mt-1">
                {artisan.name.split(' ')[0]}'s Workshop ({artisan.distanceMeters}m)
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs">
            <div>
              <span className="text-[10px] text-stone-400 block">Total Walking</span>
              <strong className="text-stone-100 font-mono text-sm">{artisan.distanceMeters} meters</strong>
            </div>
            <div className="border-x border-stone-800">
              <span className="text-[10px] text-stone-400 block">Estimated Time</span>
              <strong className="text-emerald-400 font-mono text-sm">~1.5 min</strong>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 block">Alley Terrain</span>
              <strong className="text-amber-300 text-xs">Pedestrian Stone</strong>
            </div>
          </div>

          {/* Step-by-Step Micro Guidance */}
          <div className="space-y-2 text-xs">
            <span className="font-bold text-stone-300 text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Footprints className="w-3.5 h-3.5 text-amber-400" />
              <span>Turn-by-Turn Heritage Alley Directions</span>
            </span>

            <div className="space-y-1.5 text-stone-300 text-[11px]">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-stone-950/60 border border-stone-800">
                <span className="font-bold text-amber-400">1.</span>
                <span>Leave the main commercial road; enter the stone alleyway arch at <strong className="text-stone-100">{artisan.laneName}</strong>.</span>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-stone-950/60 border border-stone-800">
                <span className="font-bold text-amber-400">2.</span>
                <span>{artisan.walkingDirectionsStep}</span>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-stone-950/60 border border-stone-800">
                <span className="font-bold text-emerald-400">3.</span>
                <span>Look for the verified brass Virasat Edge plaque beside the artisan's door.</span>
              </div>
            </div>
          </div>

          {/* Real Google Maps Launch Action */}
          <div className="pt-2">
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition"
            >
              <span>Launch in Google Maps App</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-[10px] text-stone-400 text-center mt-1.5">
              Handoff coordinates: {artisan.coordinates.lat.toFixed(4)}, {artisan.coordinates.lng.toFixed(4)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
