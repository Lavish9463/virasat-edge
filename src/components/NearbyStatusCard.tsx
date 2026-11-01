/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Radio, MapPin, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import type { ScannerBlocker } from '../utils/scannerBlocker';

export type NearbyState = 'here' | 'near' | 'searching' | 'blocked';

interface NearbyStatusCardProps {
  state: NearbyState;
  laneName: string;
  /** Street lane the detected beacon belongs to (null when no lane is detected). */
  streetName: string | null;
  landmark: string;
  /** Masters in that street lane. */
  artisanCount: number;
  /** Plain-language crowd status, e.g. "Quiet now". */
  crowdLabel: string;
  /** 1 (far) – 4 (very close); 0 when no signal. */
  signalLevel: 0 | 1 | 2 | 3 | 4;
  canReview: boolean;
  blocker: ScannerBlocker | null;
  onBlockerAction?: () => void;
  /** Web preview: presence comes from the demo slider, not a real beacon. */
  isDemo: boolean;
  /** Always-visible extra content (the demo slider in the web preview). */
  footer?: React.ReactNode;
}

const SIGNAL_LABEL = ['No signal', 'Far', 'Nearby', 'Close', 'Very close'] as const;

const THEME: Record<NearbyState, { ring: string; icon: string; eyebrow: string }> = {
  here: { ring: 'border-emerald-500/40 bg-emerald-950/30', icon: 'bg-emerald-500 text-stone-950', eyebrow: 'text-emerald-300' },
  near: { ring: 'border-amber-500/40 bg-amber-950/20', icon: 'bg-amber-500 text-stone-950', eyebrow: 'text-amber-300' },
  searching: { ring: 'border-stone-700 bg-stone-900', icon: 'bg-stone-800 text-stone-300', eyebrow: 'text-stone-400' },
  blocked: { ring: 'border-rose-500/40 bg-rose-950/20', icon: 'bg-rose-500/20 text-rose-300', eyebrow: 'text-rose-300' },
};

export const NearbyStatusCard: React.FC<NearbyStatusCardProps> = ({
  state,
  laneName,
  streetName,
  landmark,
  artisanCount,
  crowdLabel,
  signalLevel,
  canReview,
  blocker,
  onBlockerAction,
  isDemo,
  footer,
}) => {
  const theme = THEME[state];
  const masters =
    artisanCount === 0
      ? 'no workshops in this lane yet'
      : `${artisanCount} master artisan${artisanCount === 1 ? '' : 's'} here`;

  const eyebrow = { here: "You're here", near: 'Almost there', searching: 'Exploring', blocked: 'Action needed' }[state];
  const headline = {
    here: `You're at ${laneName}`,
    near: `${laneName} is close`,
    searching: 'Looking for a heritage lane…',
    blocked: blocker?.title ?? 'Action needed',
  }[state];
  const subline = {
    here: `${streetName ? `${streetName} · ` : ''}${masters} · ${crowdLabel}`,
    near: `Walk a little closer to ${streetName ?? 'the workshops'}.`,
    searching: isDemo
      ? 'Use the slider below to walk into the lane.'
      : 'Walk into an old-city lane — we’ll alert you when you arrive.',
    blocked: blocker?.detail ?? '',
  }[state];

  return (
    <section aria-label="Where you are" className="px-4 pt-4">
      <div className={`rounded-3xl border p-4 space-y-3.5 ${theme.ring}`}>
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 shrink-0">
            {(state === 'here' || state === 'near') &&
              [0, 0.5].map((delay) => (
                <span
                  key={delay}
                  className="absolute inset-0 rounded-full border-2 pointer-events-none animate-proximity-ripple"
                  style={
                    {
                      '--ripple-duration': state === 'here' ? '1s' : '1.6s',
                      borderColor: state === 'here' ? 'rgb(16,185,129)' : 'rgb(245,158,11)',
                      animationDelay: `${delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ${theme.icon}`}>
              {state === 'blocked' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Radio className={`w-6 h-6 ${state === 'searching' ? 'animate-pulse' : ''}`} />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.eyebrow}`}>
              {eyebrow}
              {isDemo && <span className="ml-1.5 text-stone-500 normal-case tracking-normal font-medium">· demo</span>}
            </p>
            <h2 className="text-lg font-bold text-stone-50 leading-snug">{headline}</h2>
            <p className="text-sm text-stone-300 mt-0.5">{subline}</p>
            {(state === 'here' || state === 'near') && (
              <p className="flex items-center gap-1 text-xs text-stone-400 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{landmark}</span>
              </p>
            )}
          </div>
        </div>

        {/* Signal strength in words + bars (no dBm on the main screen) */}
        {signalLevel > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400">Signal</span>
            <span className="flex items-center gap-2">
              <span className="flex items-end gap-0.5 h-4" aria-hidden>
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={`w-1.5 rounded-sm ${bar <= signalLevel ? (state === 'here' ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-stone-700'}`}
                    style={{ height: `${bar * 25}%` }}
                  />
                ))}
              </span>
              <span className="font-semibold text-stone-200">{SIGNAL_LABEL[signalLevel]}</span>
            </span>
          </div>
        )}

        {blocker?.action && onBlockerAction && (
          <button
            onClick={onBlockerAction}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold transition"
          >
            {blocker.actionLabel}
          </button>
        )}

        {state !== 'blocked' && (
          <div
            className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm ${
              canReview ? 'bg-emerald-500/15 text-emerald-200' : 'bg-stone-950/60 text-stone-400'
            }`}
          >
            {canReview ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
            <span>
              {canReview
                ? isDemo
                  ? 'You can try a review here (demo — not verified).'
                  : 'You can leave a verified review here.'
                : state === 'here'
                  ? 'Step a little closer to leave a review.'
                  : 'Reviews open when you’re inside the lane.'}
            </span>
          </div>
        )}

        {footer}
      </div>
    </section>
  );
};
