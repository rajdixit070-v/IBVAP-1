import React from 'react';
import { Radio, Clock, ShieldAlert } from 'lucide-react';

interface TacticalBorderHUDProps {
  currentTime: string;
  gridStatus?: string;
  bopCount?: number;
}

export const TacticalBorderHUD: React.FC<TacticalBorderHUDProps> = ({
  currentTime,
  gridStatus = 'DEFENSE GRID ACTIVE',
  bopCount = 57,
}) => {
  return (
    <>
      {/* 1. National Defense Tricolor Accent Bar at Very Top */}
      <div className="fixed top-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-[#ff9933] via-white to-[#128807] shadow-sm opacity-90" />

      {/* 2. Top Tactical Status Ribbon */}
      <header className="fixed top-2 left-0 right-0 z-20 px-4 sm:px-8 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Government of India & Authority Badge */}
          <div className="flex items-center gap-2.5 bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex flex-col text-left leading-none">
              <span className="text-[10px] font-mono font-bold text-slate-200 tracking-wider">
                GOVERNMENT OF INDIA • DEFENCE COMMAND
              </span>
              <span className="text-[9px] font-mono text-cyan-400 tracking-tight">
                CIBMS SECURE BORDER GRID
              </span>
            </div>
          </div>

          {/* Center/Right: Live Tactical IST Clock & Telemetry */}
          <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
            <div className="hidden md:flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-300 shadow-md">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-emerald-400 font-bold">{gridStatus}</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300 font-semibold">{bopCount} BOPS LINKED</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-mono shadow-md">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              <span className="text-cyan-300 font-bold tracking-wider">{currentTime || 'CONNECTING IST...'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Screen Edge Tactical Corner Bracket Reticles [ ] */}
      {/* Top Left Bracket */}
      <div className="fixed top-5 left-5 z-10 pointer-events-none hidden sm:block">
        <div className="w-10 h-10 border-t-2 border-l-2 border-cyan-400/70" />
        <div className="text-[9px] font-mono text-cyan-400/70 tracking-widest mt-1">SEC-01 [NOR]</div>
      </div>

      {/* Top Right Bracket */}
      <div className="fixed top-5 right-5 z-10 pointer-events-none hidden sm:block text-right">
        <div className="w-10 h-10 border-t-2 border-r-2 border-cyan-400/70 ml-auto" />
        <div className="text-[9px] font-mono text-cyan-400/70 tracking-widest mt-1">GRID: 28°N 77°E</div>
      </div>

      {/* Bottom Left Bracket - Soldier Tribute */}
      <div className="fixed bottom-5 left-5 z-10 pointer-events-none hidden sm:block">
        <div className="text-[10px] font-mono text-amber-400 tracking-wider mb-1 flex items-center gap-1.5">
          <span className="text-sm">🇮🇳</span>
          <span className="font-bold text-amber-300">BORDER SENTINELS • SALUTE TO BRAVE HEROES</span>
        </div>
        <div className="w-10 h-10 border-b-2 border-l-2 border-amber-400/70" />
      </div>

      {/* Bottom Right Bracket - Duty Unto Death */}
      <div className="fixed bottom-5 right-5 z-10 pointer-events-none hidden sm:block text-right">
        <div className="text-[10px] font-mono text-cyan-400 tracking-wider mb-1 flex items-center justify-end gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-cyan-300">DUTY UNTO DEATH • VALOR & VIGILANCE</span>
        </div>
        <div className="w-10 h-10 border-b-2 border-r-2 border-cyan-400/70 ml-auto" />
      </div>
    </>
  );
};

export default TacticalBorderHUD;
