/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  MapPin,
  Star,
  Navigation,
  Headphones,
  ShieldCheck,
  Lock,
  Bookmark,
  CheckCircle,
  Award,
  Sparkles,
  MessageSquarePlus,
} from 'lucide-react';
import { Artisan } from '../types';
import { ArtisanImage } from './ArtisanImage';

interface ArtisanDetailModalProps {
  artisan: Artisan;
  onClose: () => void;
  /** Proof-of-Presence for THIS artisan's lane (presence is per lane). */
  canReview: boolean;
  /** Why reviews are unlocked / what to do to unlock them. */
  gateMessage: string;
  onOpenReviewModal: () => void;
  onStartNavigation: () => void;
  onPlayAudio: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}

export const ArtisanDetailModal: React.FC<ArtisanDetailModalProps> = ({
  artisan,
  onClose,
  canReview,
  gateMessage,
  onOpenReviewModal,
  onStartNavigation,
  onPlayAudio,
  isSaved,
  onToggleSave,
}) => {
  // "Rs. 600 - Rs. 8,500" / "₹450 - ₹4,500" -> "From ₹600"
  const priceMatch = artisan.pricingRange.match(/(?:₹|Rs\.?)\s*([\d,]+)/);
  const startingPrice = priceMatch ? `From ₹${priceMatch[1]}` : artisan.pricingRange;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="artisan-detail-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-stone-100">
        {/* Sticky Header */}
        <div className="relative h-56 sm:h-64 w-full bg-stone-950 shrink-0">
          <ArtisanImage src={artisan.images[0]} alt={artisan.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />

          {/* Close & Bookmark Buttons */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-stone-950/70 text-stone-300 hover:text-white border border-stone-700/80 backdrop-blur-md"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleSave}
                className={`p-2 rounded-full border backdrop-blur-md transition ${
                  isSaved
                    ? 'bg-amber-500 text-stone-950 border-amber-400'
                    : 'bg-stone-950/70 text-stone-300 border-stone-700/80 hover:text-white'
                }`}
                aria-label={isSaved ? 'Bookmarked' : 'Bookmark artisan'}
              >
                <Bookmark className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>

          {/* Header Info */}
          <div className="absolute bottom-3 left-4 right-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
              {artisan.categoryLabel} • Est. {artisan.estYear}
            </span>
            <h2
              id="artisan-detail-title"
              className="text-xl font-bold text-stone-50 mt-1 leading-tight"
            >
              {artisan.name}
            </h2>
            <p className="text-xs text-amber-200/90 font-medium">{artisan.title}</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-stone-700 flex-1">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-stone-950/70 rounded-2xl border border-stone-800 text-center">
            <div>
              <div className="text-xs text-stone-400">Exact Distance</div>
              <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                {artisan.distanceMeters}m inside
              </div>
            </div>
            <div className="border-x border-stone-800">
              <div className="text-xs text-stone-400">Verified Rating</div>
              <div className="text-sm font-bold text-stone-100 flex items-center justify-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{artisan.verifiedHeritageScore}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-stone-400">Authentic Pricing</div>
              <div className="text-xs font-bold text-emerald-400 mt-1 truncate">{startingPrice}</div>
            </div>
          </div>

          {/* Action Row: Audio Story & 1-Tap Google Maps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={onPlayAudio}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-amber-300 font-semibold text-xs transition"
            >
              <Headphones className="w-4 h-4" />
              <span>Listen to Oral History ({artisan.audioStoryDuration})</span>
            </button>

            <button
              onClick={onStartNavigation}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-stone-950 font-bold text-xs transition shadow-md"
            >
              <Navigation className="w-4 h-4" />
              <span>1-Tap Google Maps Route</span>
            </button>
          </div>

          {/* Location & Walking Hint */}
          <div className="p-3 bg-stone-950/50 rounded-xl border border-stone-800 space-y-1">
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-200">Workshop Location:</span>
                <p className="text-stone-300 mt-0.5">{artisan.exactAddress}</p>
                <p className="text-[11px] text-amber-300/80 italic mt-1">
                  Walking guide: {artisan.walkingDirectionsStep}
                </p>
              </div>
            </div>
          </div>

          {/* Lineage & Craft Biography */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Heritage Lineage & Craft Master Story</span>
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">{artisan.bio}</p>
            <blockquote className="p-3 rounded-xl bg-amber-950/20 border-l-2 border-amber-500 text-xs text-stone-300 italic">
              "{artisan.craftHeritageStory}"
            </blockquote>
          </div>

          {/* Verified Heritage Badges */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Authenticity Guarantees
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {artisan.heritageBadges.map((badge, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-stone-950/60 border border-stone-800 text-xs text-stone-200"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Signature Creations
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {artisan.specialties.map((spec, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 text-xs border border-stone-700/60"
                >
                  • {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Proof-of-Presence Anti-Bot Review Section */}
          <section className="pt-4 border-t border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Reviews from verified visitors</span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  Only people who were really at the workshop can post here.
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-amber-300 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{artisan.verifiedHeritageScore} / 5</span>
              </div>
            </div>

            {/* Anti-Bot Presence Status Card */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                canReview
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-stone-950/80 border-stone-800 text-stone-400'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {canReview ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <strong className={canReview ? 'text-emerald-300 block' : 'text-stone-300 block'}>
                    {canReview
                      ? 'You can review this workshop'
                      : 'Reviews open at the workshop'}
                  </strong>
                  <p className="text-[11px] mt-0.5">{gateMessage}</p>
                </div>
              </div>

              <button
                onClick={onOpenReviewModal}
                disabled={!canReview}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  canReview
                    ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md cursor-pointer'
                    : 'bg-stone-800 text-stone-400 border border-stone-700 cursor-not-allowed'
                }`}
                aria-label="Write a verified review"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Write Review</span>
              </button>
            </div>

            {/* Reviews Feed */}
            <div className="space-y-2.5">
              {artisan.reviews.map((rev) => {
                const isSimulated = rev.presenceSource === 'simulator' || rev.isVerifiedPresence === false;
                return (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                          {(rev.userName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-stone-200 flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="truncate">{rev.userName}</span>
                          <span className="text-[10px] text-stone-400">({rev.userCity})</span>
                          {isSimulated ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 rounded-full font-medium">
                              Simulated (preview)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 rounded-full font-medium">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Verified On-Site
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{Number(rev.rating).toFixed(1)}</span>
                      </div>
                    </div>

                    <p className="text-stone-300 text-[11px] leading-relaxed">{rev.comment}</p>

                    <div className="flex items-end justify-between gap-2 text-[10px] text-stone-400 pt-1 border-t border-stone-800/60">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(rev.tags || []).map((tag, i) => (
                          <span key={i} className="bg-stone-800 px-1.5 py-0.5 rounded text-stone-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <span className="shrink-0">{rev.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Quick Action */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 text-stone-400 hover:text-stone-200"
          >
            Back to Directory
          </button>

          <button
            onClick={onStartNavigation}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Walk to Workshop (1-Tap Map)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
