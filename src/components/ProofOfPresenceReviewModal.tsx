/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Star, ShieldCheck, Check, Radio, Lock } from 'lucide-react';
import { Artisan, VerifiedReview } from '../types';

interface ProofOfPresenceReviewModalProps {
  artisan: Artisan;
  /** Identity of the beacon that proves presence, e.g. "ESP32-VEDGE-01 · major 101 / minor 2001". */
  beaconLabel: string;
  currentRssi: number;
  /** 'ble' = real beacon detected by the phone (verified); 'simulator' = web-preview simulation. */
  presenceSource: 'ble' | 'simulator';
  /** Re-evaluated live: if the visitor walks out of range, publishing locks again. */
  canSubmit: boolean;
  lockMessage: string;
  onClose: () => void;
  onSubmitReview: (review: VerifiedReview) => void;
}

const availableTags = [
  'Authentic Handcrafted',
  'Master Demonstration',
  'Fair Direct Price',
  'Pure Natural Materials',
  'Zero Middleman Markup',
  'Warm Heritage Hospitality',
];

export const ProofOfPresenceReviewModal: React.FC<ProofOfPresenceReviewModalProps> = ({
  artisan,
  beaconLabel,
  currentRssi,
  presenceSource,
  canSubmit,
  lockMessage,
  onClose,
  onSubmitReview,
}) => {
  const [rating, setRating] = useState(5);
  const [userName, setUserName] = useState('');
  const [userCity, setUserCity] = useState('');
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Authentic Handcrafted', 'Fair Direct Price']);
  const [validationError, setValidationError] = useState('');

  const isSimulated = presenceSource === 'simulator';

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Presence is checked again at the moment of publishing, not just when the form opened.
    if (!canSubmit) {
      setValidationError(lockMessage);
      return;
    }
    if (!userName.trim()) {
      setValidationError('Please enter your name.');
      return;
    }
    if (comment.trim().length < 10) {
      setValidationError('Please share at least a short 10-character genuine experience.');
      return;
    }

    const newReview: VerifiedReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userName: userName.trim(),
      userCity: userCity.trim() || 'Heritage Visitor',
      // A real date (not "Just now"), since the review syncs to other phones and stays forever.
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      rating,
      comment: comment.trim(),
      proofOfPresenceBeaconId: beaconLabel,
      verifiedRssi: currentRssi,
      tags: selectedTags,
      isVerifiedPresence: !isSimulated,
      presenceSource,
    };

    onSubmitReview(newReview);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-stone-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="review-modal-title" className="text-sm font-bold text-stone-100">
                {isSimulated ? 'Review (Web Preview)' : 'Verified On-Site Review'}
              </h3>
              <p className="text-[11px] text-amber-300">for {artisan.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            aria-label="Close review dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presence banner (live) */}
        {canSubmit ? (
          <div
            className={`border-b px-4 py-2 flex items-center justify-between gap-2 text-[11px] shrink-0 ${
              isSimulated
                ? 'bg-sky-950/40 border-sky-500/30 text-sky-200'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isSimulated ? 'Simulated presence — not a verified review' : 'Physical presence verified by your phone'}
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-current/40 shrink-0">
              {currentRssi} dBm
            </span>
          </div>
        ) : (
          <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-2 flex items-start gap-1.5 text-[11px] text-rose-200 shrink-0">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Signal lost.</strong> {lockMessage}
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {validationError}
            </div>
          )}

          {/* Star Rating Picker */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1.5">Authentic Experience Rating</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 rounded-lg hover:bg-stone-800 transition"
                  aria-label={`Rate ${star} stars`}
                  aria-pressed={star <= rating}
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-600 hover:text-stone-500'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-amber-300 ml-1">
                {rating === 5 ? 'Master Craftsperson' : `${rating} / 5`}
              </span>
            </div>
          </div>

          {/* Name & City */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="review-name" className="block text-xs text-stone-400 mb-1">
                Your Name *
              </label>
              <input
                id="review-name"
                type="text"
                placeholder="e.g. Ramesh Sharma"
                value={userName}
                maxLength={40}
                autoComplete="name"
                onChange={(e) => {
                  setUserName(e.target.value);
                  setValidationError('');
                }}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="review-city" className="block text-xs text-stone-400 mb-1">
                Your City / Country
              </label>
              <input
                id="review-city"
                type="text"
                placeholder="e.g. Jaipur or Berlin"
                value={userCity}
                maxLength={30}
                onChange={(e) => setUserCity(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Experience Tags */}
          <div>
            <span className="block text-xs text-stone-400 mb-1.5">Highlight Authenticity Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="review-comment" className="block text-xs text-stone-400 mb-1">
              Your Authentic Feedback * (What did you observe at the workshop?)
            </label>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={600}
              placeholder="e.g. Saw the master grinding natural mineral stones in the mortar; no commercial rush or inflated commission."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setValidationError('');
              }}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
              required
            />
            <div className="text-right text-[10px] text-stone-500">{comment.length}/600</div>
          </div>

          {/* Anti-Bot Explanation Note */}
          <div className="p-3 bg-stone-950/60 rounded-xl border border-stone-800/80 text-[10px] text-stone-400 leading-relaxed">
            🛡️ <strong>Why this matters:</strong>{' '}
            {isSimulated
              ? 'In the installed Android app, reviews can only be published while the phone detects the real lane beacon. Web-preview reviews stay on this device and are labelled “Simulated”.'
              : 'Unlike portals where competitors buy fake 1-star attacks or shops pay click-farms for 5-stars, your review is signed by your phone’s physical proximity to beacon '}
            {!isSimulated && <span className="font-mono text-amber-400">{beaconLabel}</span>}
            {!isSimulated && '.'}
          </div>

          {/* Submit */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs px-3 py-2 text-stone-400 hover:text-stone-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-950 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
            >
              {!canSubmit && <Lock className="w-3.5 h-3.5" />}
              {isSimulated ? 'Post Simulated Review' : 'Publish Verified Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
