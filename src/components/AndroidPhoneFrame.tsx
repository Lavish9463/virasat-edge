/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wifi, BatteryMedium, Signal, Radio, Sparkles, Bookmark, Info, Cloud, CloudOff } from 'lucide-react';
import { AndroidTab } from '../types';

const NAV_ITEMS: { id: AndroidTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'discover', label: 'Nearby', Icon: Radio },
  { id: 'artisans', label: 'Artisans', Icon: Sparkles },
  { id: 'favorites', label: 'Saved', Icon: Bookmark },
  { id: 'about', label: 'About', Icon: Info },
];

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  React.useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return isOnline;
}

interface AndroidPhoneFrameProps {
  children: React.ReactNode;
  activeTab: AndroidTab;
  onTabChange: (tab: AndroidTab) => void;
  isInsideBeaconZone: boolean;
  activeLaneName?: string;
  isPhoneFrameMode: boolean;
  onToggleFrameMode: () => void;
  savedCount: number;
}

export const AndroidPhoneFrame: React.FC<AndroidPhoneFrameProps> = ({
  children,
  activeTab,
  onTabChange,
  isInsideBeaconZone,
  activeLaneName,
  isPhoneFrameMode,
  onToggleFrameMode,
  savedCount,
}) => {
  const [currentTime, setCurrentTime] = React.useState('10:42');
  const mainRef = React.useRef<HTMLElement | null>(null);
  const isOnline = useOnlineStatus();

  const bleBadge = isInsideBeaconZone && (
    <span
      className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30 animate-pulse"
      title="You are inside a heritage lane"
    >
      <Radio className="w-2.5 h-2.5" />
      <span>In a lane</span>
    </span>
  );

  const syncChip = isOnline ? (
    <span
      className="flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30"
      title="Real-time multi-device Firestore synchronization active"
    >
      <Cloud className="w-2.5 h-2.5 text-emerald-400" />
      <span className="font-mono">Sync</span>
    </span>
  ) : (
    <span
      className="flex items-center gap-1 text-[9px] bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded-full border border-stone-700"
      title="Offline — changes are saved on this phone and sync when you reconnect"
    >
      <CloudOff className="w-2.5 h-2.5 text-stone-400" />
      <span className="font-mono">Offline</span>
    </span>
  );

  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const content = (
    <div className="flex flex-col h-full bg-stone-900 text-stone-100 select-none overflow-hidden relative font-sans">
      {/* Top bar (respects the notch / status-bar inset on edge-to-edge devices).
          Desktop phone mock-up: a simulated Android status bar. Real phone / mobile web: an app bar,
          because the device already draws its own status bar above it. */}
      <header
        className="h-10 bg-stone-950/90 backdrop-blur-md px-5 flex items-center justify-between text-xs font-medium text-stone-300 z-30 shrink-0 border-b border-stone-800/60"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(2.5rem + env(safe-area-inset-top))' }}
      >
        {isPhoneFrameMode ? (
          <>
            <div className="flex items-center gap-2">
              <span>{currentTime}</span>
              {bleBadge}
            </div>

            {/* Center Punch Hole Camera */}
            <div className="w-3.5 h-3.5 rounded-full bg-black border border-stone-800/80 shadow-inner" />

            <div className="flex items-center gap-2 text-stone-400">
              {syncChip}
              <Signal className="w-3.5 h-3.5 text-stone-200" />
              <Wifi className="w-3.5 h-3.5 text-stone-200" />
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono">92%</span>
                <BatteryMedium className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center text-stone-950 font-bold text-[10px] shrink-0">
                VE
              </div>
              <span className="text-sm font-bold text-stone-100 truncate">Virasat Edge</span>
              {bleBadge}
            </div>
            {syncChip}
          </>
        )}
      </header>

      {/* Main App Content Viewport */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-stone-700 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      {/* Bottom navigation (respects gesture-bar inset) */}
      <nav
        aria-label="Main navigation"
        className="absolute bottom-0 inset-x-0 h-16 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800/80 px-2 flex items-center justify-around z-30 shadow-2xl"
        style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                isActive ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <span className={`px-4 py-1 rounded-full transition-colors ${isActive ? 'bg-amber-500/20' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-xs mt-0.5">{label}</span>
              {id === 'discover' && isInsideBeaconZone && (
                <span className="absolute top-2 right-[calc(50%-1.5rem)] w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-stone-950" />
              )}
              {id === 'favorites' && savedCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-1.75rem)] min-w-4 h-4 px-1 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Android System Gesture Bar (only shown in the simulated desktop phone frame) */}
      {isPhoneFrameMode && (
        <div className="absolute bottom-1 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="w-32 h-1 bg-stone-500/50 rounded-full" />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-0 md:p-6 overflow-hidden">
      {/* Top Banner Control Bar for judges & evaluators */}
      <div className="w-full max-w-5xl mb-4 px-4 hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-stone-950 font-bold shadow-lg shadow-amber-500/20">
            VE
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-100 flex items-center gap-2">
              Virasat Edge — Android Proximity App
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-normal">
                DevFest Udaipur Heritage Track
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              ESP32 BLE Proximity Sensing • Proof-of-Presence Anti-Bot Reviews • Privacy Edge Headcount
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFrameMode}
            className="flex items-center gap-2 text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-lg border border-stone-700 transition"
            aria-label="Toggle Android phone frame or expanded view"
          >
            {isPhoneFrameMode ? '🖥️ Switch to Full View' : '📱 Switch to Phone Frame'}
          </button>
        </div>
      </div>

      {/* Phone container or responsive frame */}
      {isPhoneFrameMode ? (
        <div className="relative w-full max-w-[420px] h-[860px] max-h-[95vh] rounded-[48px] p-3 bg-stone-950 shadow-[0_25px_70px_rgba(0,0,0,0.8)] border-[6px] border-stone-800 ring-1 ring-stone-700/60 overflow-hidden flex flex-col">
          {/* Inner bezel wrapper */}
          <div className="w-full h-full rounded-[38px] overflow-hidden flex flex-col relative bg-stone-900 border border-stone-800">
            {content}
          </div>
        </div>
      ) : (
        <div className="w-full h-[100dvh] md:max-w-5xl md:h-[92vh] md:rounded-2xl overflow-hidden md:border border-stone-800 bg-stone-900 md:shadow-2xl relative flex flex-col">
          {content}
        </div>
      )}
    </div>
  );
};
