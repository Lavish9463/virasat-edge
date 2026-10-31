/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Bookmark,
  MapPin,
  Star,
  Navigation,
  Headphones,
  Trash2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Artisan } from '../types';
import { ArtisanImage } from './ArtisanImage';

interface FavoritesTabProps {
  savedArtisans: Artisan[];
  onSelectArtisan: (artisan: Artisan) => void;
  onRemoveFavorite: (id: string) => void;
  onStartNavigation: (artisan: Artisan) => void;
  onPlayAudio: (artisan: Artisan) => void;
  onExploreArtisans: () => void;
}

export const FavoritesTab: React.FC<FavoritesTabProps> = ({
  savedArtisans,
  onSelectArtisan,
  onRemoveFavorite,
  onStartNavigation,
  onPlayAudio,
  onExploreArtisans,
}) => {
  const totalDistance = savedArtisans.reduce((sum, a) => sum + a.distanceMeters, 0);

  return (
    <div className="p-4 space-y-4 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-50 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-400 fill-current" />
            <span>Saved Heritage Workshops</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Your personalized walking trail through authentic craftsmen
          </p>
        </div>

        <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30">
          {savedArtisans.length} Saved
        </span>
      </div>

      {savedArtisans.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-200">No artisans bookmarked yet</h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            Explore the Radar or Artisans tab and tap the bookmark icon to save authentic master workshops for your walking tour.
          </p>
          <button
            onClick={onExploreArtisans}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover Authentic Artisans</span>
          </button>
        </div>
      ) : (
        <>
          {/* Walking Trail Summary */}
          <div className="p-3.5 bg-gradient-to-r from-stone-900 to-stone-950 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-stone-200">Quiet Heritage Walking Trail</div>
              <p className="text-[11px] text-stone-400">
                {savedArtisans.length} workshops • ~{savedArtisans.length * 15} mins quiet discovery
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-400 font-mono">
                ~{totalDistance + 80}m total
              </span>
              <span className="text-[10px] text-stone-400 block">Off-road alleyways</span>
            </div>
          </div>

          {/* List of saved artisans */}
          <div className="space-y-3">
            {savedArtisans.map((artisan) => (
              <div
                key={artisan.id}
                className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 transition shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ArtisanImage
                      src={artisan.images[0]}
                      alt={artisan.name}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-700 shrink-0"
                      loading="lazy"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                        {artisan.categoryLabel}
                      </span>
                      <h4 className="text-sm font-bold text-stone-100">{artisan.name}</h4>
                      <p className="text-xs text-stone-400">
                        {artisan.laneName} • {artisan.distanceMeters}m inside
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveFavorite(artisan.id)}
                    className="p-2 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition"
                    title="Remove from saved"
                    aria-label={`Remove ${artisan.name} from saved`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 text-xs">
                  <button
                    onClick={() => onPlayAudio(artisan)}
                    className="flex items-center gap-1 text-amber-300 hover:text-amber-200"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Audio ({artisan.audioStoryDuration})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartNavigation(artisan)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/60 font-semibold"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Directions</span>
                    </button>

                    <button
                      onClick={() => onSelectArtisan(artisan)}
                      className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg transition"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
