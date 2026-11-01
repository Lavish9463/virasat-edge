/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, Star, Headphones, Navigation, Bookmark, ChevronRight, Footprints } from 'lucide-react';
import { Artisan, LaneBeacon, StreetLane } from '../types';
import { nearestStreetLanes } from '../utils/presence';
import { ArtisanImage } from './ArtisanImage';

interface DiscoverTabProps {
  activeBeacon: LaneBeacon;
  /** Street lane the visitor is inside, or null until they arrive (masters only show once there). */
  currentStreetMinor: number | null;
  streets: StreetLane[];
  artisans: Artisan[];
  onSelectArtisan: (artisan: Artisan) => void;
  onPlayAudio: (artisan: Artisan) => void;
  onStartNavigation: (artisan: Artisan) => void;
  savedArtisanIds: string[];
  onToggleSaveArtisan: (id: string) => void;
}

/** Compact one-line artisan entry used for browsing lanes the visitor isn't standing in. */
const ArtisanRow: React.FC<{ artisan: Artisan; detail: string; onSelect: (artisan: Artisan) => void }> = ({
  artisan,
  detail,
  onSelect,
}) => (
  <button
    onClick={() => onSelect(artisan)}
    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-stone-900 border border-stone-800 text-left"
  >
    <ArtisanImage
      src={artisan.images[0]}
      alt={artisan.name}
      className="w-12 h-12 rounded-xl object-cover shrink-0"
      loading="lazy"
    />
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-stone-100 truncate">{artisan.name}</span>
      <span className="block text-xs text-stone-400 truncate">{detail}</span>
    </span>
    <span className="text-xs font-semibold text-amber-400 shrink-0">★ {artisan.verifiedHeritageScore}</span>
    <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
  </button>
);

/**
 * "Nearby" tab. Before the visitor reaches a lane it only lists the other heritage lanes; once they
 * are inside a street lane it shows that lane's masters and the nearest street lanes to browse.
 */
export const DiscoverTab: React.FC<DiscoverTabProps> = ({
  activeBeacon,
  currentStreetMinor,
  streets,
  artisans,
  onSelectArtisan,
  onPlayAudio,
  onStartNavigation,
  savedArtisanIds,
  onToggleSaveArtisan,
}) => {
  const laneName = activeBeacon.laneName.split('(')[0].trim();
  const currentStreet = streets.find((s) => s.minor === currentStreetMinor) ?? null;
  const placeArtisans = artisans.filter((a) => a.laneId === activeBeacon.id);
  const inStreet = (minor: number) => placeArtisans.filter((a) => a.streetMinor === minor);
  const laneArtisans = currentStreet ? inStreet(currentStreet.minor) : [];
  const nearestLanes = currentStreet ? nearestStreetLanes(currentStreet.minor, streets) : [];
  const otherArtisans = artisans.filter((a) => a.laneId !== activeBeacon.id);

  return (
    <div className="p-4 space-y-6">
      {currentStreet && (
        <section aria-label={`Artisans in ${laneName}`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-stone-100">Masters in {laneName}</h3>
            <span className="shrink-0 text-xs font-semibold text-emerald-300">{currentStreet.name}</span>
          </div>

          {laneArtisans.length === 0 && (
            <p className="rounded-3xl border border-dashed border-stone-700 p-4 text-sm text-stone-400">
              No workshops are listed in {currentStreet.name} yet — browse the nearest lanes below.
            </p>
          )}

          {laneArtisans.map((artisan) => {
            const isSaved = savedArtisanIds.includes(artisan.id);
            return (
              <article key={artisan.id} className="rounded-3xl bg-stone-900 border border-stone-800 overflow-hidden">
                <button
                  onClick={() => onSelectArtisan(artisan)}
                  className="relative block w-full h-40 bg-stone-950 text-left"
                  aria-label={`Open ${artisan.name}`}
                >
                  <ArtisanImage
                    src={artisan.images[0]}
                    alt={artisan.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
                  <span className="absolute top-3 left-3 flex items-center gap-1 bg-stone-950/80 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-300">
                    <MapPin className="w-3.5 h-3.5" />
                    {artisan.distanceMeters} m inside
                  </span>
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">{artisan.categoryLabel}</p>
                    <h4 className="text-lg font-bold text-stone-50 leading-tight">{artisan.name}</h4>
                  </div>
                </button>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 font-bold text-amber-300">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {artisan.verifiedHeritageScore}
                      <span className="font-normal text-stone-400 text-xs ml-1">
                        · {artisan.verifiedReviewsCount} verified visits
                      </span>
                    </span>
                    <button
                      onClick={() => onToggleSaveArtisan(artisan.id)}
                      className={`p-2 rounded-full border transition ${
                        isSaved ? 'bg-amber-500 text-stone-950 border-amber-400' : 'bg-stone-950 text-stone-300 border-stone-700'
                      }`}
                      aria-label={isSaved ? 'Remove from saved' : 'Save artisan'}
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                  <p className="text-sm text-stone-300 line-clamp-2 leading-relaxed">{artisan.bio}</p>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onPlayAudio(artisan)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 text-xs text-stone-200"
                    >
                      <Headphones className="w-4 h-4 text-amber-400" />
                      Story
                    </button>
                    <button
                      onClick={() => onStartNavigation(artisan)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 text-xs text-stone-200"
                    >
                      <Navigation className="w-4 h-4 text-emerald-400" />
                      Directions
                    </button>
                    <button
                      onClick={() => onSelectArtisan(artisan)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl bg-amber-500 text-xs font-bold text-stone-950"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Visit & review
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {nearestLanes.length > 0 && (
        <section aria-label="In nearest lanes" className="space-y-2">
          <h3 className="text-sm font-bold text-stone-300">In nearest lanes</h3>
          {nearestLanes.map((street) => {
            const masters = inStreet(street.minor);
            return (
              <div key={street.minor} className="rounded-3xl border border-stone-800 bg-stone-950/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-100">
                    <Footprints className="w-4 h-4 text-amber-400" />
                    {street.name}
                  </span>
                  <span className="text-xs text-stone-400">
                    {masters.length === 0
                      ? 'No workshops yet'
                      : `${masters.length} master${masters.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {masters.map((artisan) => (
                  <ArtisanRow
                    key={artisan.id}
                    artisan={artisan}
                    detail={`${artisan.categoryLabel} · ${artisan.distanceMeters} m inside`}
                    onSelect={onSelectArtisan}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}

      {otherArtisans.length > 0 && (
        <section aria-label="Other heritage lanes" className="space-y-2">
          <h3 className="text-sm font-bold text-stone-300">Other heritage lanes</h3>
          {otherArtisans.map((artisan) => (
            <ArtisanRow
              key={artisan.id}
              artisan={artisan}
              detail={`${artisan.categoryLabel} · ${artisan.laneName}`}
              onSelect={onSelectArtisan}
            />
          ))}
        </section>
      )}
    </div>
  );
};
