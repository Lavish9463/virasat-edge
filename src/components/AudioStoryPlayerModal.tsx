/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, Volume2, Sparkles, BookOpen } from 'lucide-react';
import { Artisan } from '../types';
import { ArtisanImage } from './ArtisanImage';

interface AudioStoryPlayerModalProps {
  artisan: Artisan;
  onClose: () => void;
}

export const AudioStoryPlayerModal: React.FC<AudioStoryPlayerModalProps> = ({
  artisan,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(15);
  const [showTranscript, setShowTranscript] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 2));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Derive the elapsed timestamp from the artisan's stated story duration (e.g. "2m 14s").
  const totalSeconds = (() => {
    const mins = artisan.audioStoryDuration.match(/(\d+)\s*m/);
    const secs = artisan.audioStoryDuration.match(/(\d+)\s*s/);
    return (mins ? parseInt(mins[1], 10) : 0) * 60 + (secs ? parseInt(secs[1], 10) : 0);
  })();
  const elapsedSeconds = Math.floor((progress / 100) * totalSeconds);
  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-modal-title"
      className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-stone-100 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Oral Heritage Audio Archive
              </span>
              <h3 id="audio-modal-title" className="text-sm font-bold text-stone-100 truncate">
                {artisan.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            aria-label="Close audio player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 bg-stone-950 p-3 rounded-2xl border border-stone-800">
            <ArtisanImage
              src={artisan.images[0]}
              alt={artisan.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-700"
            />
            <div className="overflow-hidden">
              <span className="text-[10px] text-amber-400 font-semibold uppercase">
                {artisan.categoryLabel}
              </span>
              <h4 className="text-sm font-bold text-stone-100 truncate">
                {artisan.audioStoryTitle}
              </h4>
              <p className="text-xs text-stone-400 mt-0.5">{artisan.generation}</p>
            </div>
          </div>

          {/* Animated Audio Waveform */}
          <div className="flex items-center justify-center gap-1 h-12 px-2 bg-stone-950/50 rounded-xl border border-stone-800/80">
            {[40, 65, 80, 50, 95, 75, 45, 60, 90, 85, 35, 70, 95, 60, 40, 75, 85, 55, 65, 30].map(
              (height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    i * 5 <= progress
                      ? 'bg-amber-400'
                      : 'bg-stone-700'
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(12, height * (0.6 + Math.random() * 0.4))}%` : '20%',
                  }}
                />
              )
            )}
          </div>

          {/* Scrub Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              aria-label="Seek audio"
            />
            <div className="flex justify-between text-[10px] text-stone-400 font-mono">
              <span>{formatTime(elapsedSeconds)}</span>
              <span>{artisan.audioStoryDuration}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              onClick={() => setProgress(0)}
              className="p-2 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              title="Restart"
              aria-label="Restart audio"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-4 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/30 transition transform hover:scale-105"
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-2 rounded-full border transition ${
                showTranscript
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200 border-stone-800'
              }`}
              title="Toggle Transcript"
              aria-label="Toggle transcript"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          </div>

          {/* Transcript Box */}
          {showTranscript && (
            <div className="p-3 bg-stone-950/80 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Master Artisan Oral Transcript
              </span>
              <p className="leading-relaxed italic text-[11px]">
                "{artisan.audioStoryTranscript}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
