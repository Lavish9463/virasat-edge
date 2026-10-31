/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  Video,
  Award,
  Layers,
  ShieldCheck,
  TrendingUp,
  MapPin,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

export const BlueprintTab: React.FC = () => {
  return (
    <div className="p-4 space-y-4 text-stone-100">
      {/* Pitch Header */}
      <div className="bg-gradient-to-br from-amber-950/40 via-stone-900 to-stone-950 p-4 rounded-2xl border border-amber-500/30 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Aravalli Build Championship • Road to DevFest Udaipur
            </span>
            <h2 className="text-base font-bold text-stone-50">
              Virasat Edge: Master Plan & Architecture
            </h2>
          </div>
        </div>

        <blockquote className="p-3 bg-stone-950/80 rounded-xl border-l-2 border-amber-500 text-xs text-stone-200 italic leading-relaxed">
          "Virasat Edge combines privacy-first ESP32-CAM crowd counting with static BLE proximity beacons and server-mapped artisan directories—giving tourists a seamless way to discover hidden heritage craftsmen while completely eliminating fake review bots."
        </blockquote>
      </div>

      {/* The Hidden Artisan Problem vs. Solution */}
      <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4" />
          <span>The Core Problem & Breakthrough Solution</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-stone-950 border border-rose-500/30 space-y-1.5">
            <span className="font-bold text-rose-400 flex items-center gap-1">
              [Broken Status Quo]
            </span>
            <ul className="space-y-1 text-stone-300 text-[11px] list-disc list-inside">
              <li>Tourists stay on crowded commercial roads. Authentic masters 15m inside historic lanes remain totally invisible.</li>
              <li>Commercial shops buy thousands of fake bot reviews to bury genuine craftsmen.</li>
              <li>Standard CCTV cameras or continuous GPS violate tourist privacy and drain phone batteries.</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-stone-950 border border-emerald-500/30 space-y-1.5">
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              [Virasat Edge Innovation]
            </span>
            <ul className="space-y-1 text-stone-300 text-[11px] list-disc list-inside">
              <li>Under Rs. 350 ESP32 hardware node placed at alleyway entries.</li>
              <li>Proof of Presence: Reviews ONLY unlock when tourist's phone physically detects the lane beacon. Zero fake bots.</li>
              <li>100% Privacy-First: Edge Impulse calculates headcount integers; zero video frames ever saved or sent.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Scalability Roadmap */}
      <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          <span>Impact & Scalability Across India</span>
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs gap-1">
          <div className="text-center flex-1">
            <span className="font-bold text-amber-400 block text-sm">Udaipur</span>
            <span className="text-[10px] text-stone-400">Pilot in 15 heritage lanes</span>
          </div>
          <span className="text-amber-500 font-bold px-1">»</span>
          <div className="text-center flex-1">
            <span className="font-bold text-stone-200 block text-sm">Rajasthan</span>
            <span className="text-[10px] text-stone-400">Jaipur, Jodhpur, Jaisalmer</span>
          </div>
          <span className="text-amber-500 font-bold px-1">»</span>
          <div className="text-center flex-1">
            <span className="font-bold text-stone-200 block text-sm">Pan-India</span>
            <span className="text-[10px] text-stone-400">Varanasi, Hampi, Madurai</span>
          </div>
        </div>
      </section>

      {/* Embedded Hackathon Documents / Artifacts Reference */}
      <section className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2.5">
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
          Submitted Hackathon Media Attachments
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <div>
                <span className="font-bold text-stone-200">Virasat_Edge_Master_Hackathon_Blueprint.pdf</span>
                <span className="text-[10px] text-stone-400 block">
                  Aravalli Build Championship Architecture & Flutter Wireflows
                </span>
              </div>
            </div>
            <a
              href="assets/aistudio/Virasat_Edge_Master_Hackathon_Blueprint_0fa41ae6.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
            >
              <span>View PDF</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-bold text-stone-200">Virasat_Edge_Explainer_Video.mp4</span>
                <span className="text-[10px] text-stone-400 block">
                  NotebookLM Heritage Track Explainer presentation
                </span>
              </div>
            </div>
            <a
              href="assets/aistudio/WhatsApp_Video_2026-10-21_at_9.19.32_AM_2eb1b1a4.mp4"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <span>Watch Video</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
