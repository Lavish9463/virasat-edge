/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  MapPin,
  Star,
  Headphones,
  Navigation,
  Bookmark,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Artisan } from '../types';
import { ArtisanImage } from './ArtisanImage';

interface ArtisansTabProps {
  artisans: Artisan[];
  onSelectArtisan: (artisan: Artisan) => void;
  onPlayAudio: (artisan: Artisan) => void;
  onStartNavigation: (artisan: Artisan) => void;
  savedArtisanIds: string[];
  onToggleSaveArtisan: (id: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const ArtisansTab: React.FC<ArtisansTabProps> = ({
  artisans,
  onSelectArtisan,
  onPlayAudio,
  onStartNavigation,
  savedArtisanIds,
  onToggleSaveArtisan,
  selectedCategory,
  onSelectCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'experience'>('distance');

  const categories = [
    { id: 'all', label: 'All Crafts' },
    { id: 'miniature_art', label: 'Miniature Art' },
    { id: 'pottery', label: 'Blue Pottery' },
    { id: 'handloom', label: 'Dabu Handloom' },
    { id: 'silver', label: 'Silver Filigree' },
    { id: 'puppets', label: 'Mewar Puppets' },
    { id: 'sweets', label: 'Heritage Sweets' },
    { id: 'leather_craft', label: 'Camel Mojari' },
  ];

  const filtered = artisans
    .filter((a) => {
      const matchesCat = selectedCategory === 'all' || a.craftCategory === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.categoryLabel.toLowerCase().includes(q) ||
        a.laneName.toLowerCase().includes(q) ||
        a.bio.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distanceMeters - b.distanceMeters;
      if (sortBy === 'rating') return b.verifiedHeritageScore - a.verifiedHeritageScore;
      if (sortBy === 'experience') return a.estYear - b.estYear;
      return 0;
    });

  return (
    <div className="p-4 space-y-4 text-stone-100">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search master painters, weavers, silversmiths..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-stone-900 border border-stone-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Categories chips */}
      <div className="overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sorting bar & count */}
      <div className="flex items-center justify-between text-xs text-stone-400 px-1">
        <span>
          Showing <strong className="text-stone-200">{filtered.length}</strong> master artisans
        </span>

        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-stone-900 border border-stone-800 text-stone-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="distance">Nearest Distance</option>
            <option value="rating">Highest Verified Rating</option>
            <option value="experience">Oldest Heritage Lineage</option>
          </select>
        </div>
      </div>

      {/* Artisans list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-stone-900 border border-stone-800 text-stone-400 text-xs">
            No artisans match your search criteria.
          </div>
        ) : (
          filtered.map((artisan) => {
            const isSaved = savedArtisanIds.includes(artisan.id);
            return (
              <div
                key={artisan.id}
                onClick={() => onSelectArtisan(artisan)}
                className="group p-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 transition cursor-pointer shadow-lg space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ArtisanImage
                      src={artisan.images[0]}
                      alt={artisan.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-700 group-hover:scale-105 transition"
                      loading="lazy"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                        {artisan.categoryLabel} • Est. {artisan.estYear}
                      </span>
                      <h4 className="text-sm font-bold text-stone-100 leading-tight">
                        {artisan.name}
                      </h4>
                      <p className="text-xs text-stone-400 mt-0.5">{artisan.generation}</p>
                      <div className="flex items-center gap-1 text-[11px] text-amber-300/80 mt-1">
                        <MapPin className="w-3 h-3 text-amber-500" />
                        <span>
                          {artisan.distanceMeters}m inside {artisan.laneName.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 bg-stone-950 px-2 py-0.5 rounded-lg border border-stone-800 text-amber-300 font-bold text-xs">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{artisan.verifiedHeritageScore}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaveArtisan(artisan.id);
                      }}
                      className={`p-1.5 rounded-lg border transition ${
                        isSaved
                          ? 'bg-amber-500 text-stone-950 border-amber-400'
                          : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-white'
                      }`}
                      aria-label={isSaved ? 'Bookmarked' : 'Bookmark artisan'}
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                  {artisan.bio}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayAudio(artisan);
                    }}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Story ({artisan.audioStoryDuration})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartNavigation(artisan);
                      }}
                      className="p-1 rounded-lg bg-stone-800 text-stone-300 hover:text-white"
                      title="1-Tap Walking Navigation"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
