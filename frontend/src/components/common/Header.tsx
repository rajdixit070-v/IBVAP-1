import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, User as UserIcon, Bell, MapPin, LogOut, Bot, Menu, Volume2, VolumeX, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCameras } from '../../context/CameraContext';
import { NotificationDrawer } from './NotificationDrawer';
import { incidentService } from '../../services/incidentService';
import { alertSoundService } from '../../services/alertSoundService';
import { AlertsWebSocket } from '../../services/websocket';

interface HeaderProps {
  activeTab?: string;
  onNavigateToDashboard?: () => void;
  onOpenMap?: () => void;
  onOpenAssistant?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab: _activeTab,
  onNavigateToDashboard,
  onOpenMap,
  onOpenAssistant,
  onToggleSidebar,
  sidebarOpen = true
}) => {
  const { user, logout } = useAuth();
  const { summary, refreshCameras, loading } = useCameras();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMuted, setIsMuted] = useState(alertSoundService.isMuted());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    loadUnread();

    // Clock ticker every 1 second
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Listen to real-time alerts WebSocket for instant notification badge updates
    const ws = new AlertsWebSocket((msg) => {
      if (msg && (msg.event === 'ALERT_CREATED' || msg.event === 'ALERT_UPDATED')) {
        loadUnread();
      }
    });

    const interval = setInterval(() => {
      loadUnread();
    }, 4000);

    return () => {
      clearInterval(clockTimer);
      ws.close();
      clearInterval(interval);
    };
  }, []);


  const loadUnread = async () => {
    try {
      const notifs = await incidentService.getNotifications({ unread_only: true, limit: 20 });
      setUnreadCount(notifs.length);
    } catch (e) {
      // quiet fail
    }
  };

  return (
    <>
      <header className="h-14 bg-[#080d17] border-b border-[#1e293b]/80 px-3 md:px-5 flex items-center justify-between shrink-0 z-30 select-none shadow-xl">
        {/* Brand & Badge & Hamburger */}
        <div className="flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                sidebarOpen
                  ? 'text-cyan-400 bg-cyan-950/40 border-cyan-700/60 hover:bg-cyan-900/50'
                  : 'text-slate-400 bg-slate-900/80 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
              title={sidebarOpen ? "Collapse Navigation Sidebar" : "Expand Navigation Sidebar"}
              aria-label="Toggle Navigation Sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div
            onClick={onNavigateToDashboard}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="Return to Central Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center p-1 shadow-sm shadow-cyan-500/20 shrink-0 group-hover:border-cyan-400 transition-colors">
              <img src="/logo.png" alt="IBVAP Logo" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
            </div>
            <div className="flex flex-col justify-center leading-none">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base text-white tracking-widest group-hover:text-cyan-300 transition-colors">IBVAP</span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 font-bold tracking-wider">
                  C2 MATRIX
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5 hidden sm:inline">
                Intelligent Border Video Analytics
              </span>
            </div>
          </div>


          {/* Live System Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 pl-3 ml-1 border-l border-slate-800 text-[11px] font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-emerald-400 font-semibold">BUS ONLINE</span>
          </div>

          {/* Real-time Tactical Digital Clock HUD (Locked to Indian Standard Time IST) */}
          <div className="hidden md:flex items-center gap-2 bg-[#0c1424] px-3 py-1 rounded-lg border border-cyan-500/30 text-xs font-mono shadow-inner">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-bold tracking-wider">
              {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700 font-bold">
              IST
            </span>
          </div>
        </div>

        {/* Right Telemetry & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">

          {/* Quick Fleet Telemetry Pill */}
          {summary && (
            <div className="hidden xl:flex items-center gap-2 bg-[#0c1424] px-3 py-1 rounded-lg border border-[#1e293b] text-[11px] font-mono shadow-inner">
              <Radio className="w-3 h-3 text-sky-400" />
              <span className="text-slate-300">NODES: <strong className="text-white">{summary.total_cameras}</strong></span>
              <span className="text-slate-700">|</span>
              <span className="text-emerald-400 font-semibold">LIVE: {summary.healthy}</span>
              <span className="text-slate-700">|</span>
              <span className="text-amber-400 font-semibold">DEGRADED: {summary.degraded}</span>
              <span className="text-slate-700">|</span>
              <span className="text-rose-400 font-semibold">OFFLINE: {summary.offline}</span>
            </div>
          )}


          {/* AI Copilot Trigger Button */}
          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-500/15 to-sky-500/15 hover:from-cyan-500/25 hover:to-sky-500/25 text-cyan-300 hover:text-white rounded-lg border border-cyan-500/35 transition flex items-center gap-1.5 text-xs font-mono shadow-sm cursor-pointer"
              title="Open AI Virtual Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline font-bold">AI Copilot</span>
            </button>
          )}

          {/* Situational Map Trigger Button */}
          {onOpenMap && (
            <button
              onClick={onOpenMap}
              className="p-1.5 text-slate-300 hover:text-sky-300 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition flex items-center gap-1 text-xs font-mono cursor-pointer"
              title="Open Tactical Border Map"
            >
              <MapPin className="w-4 h-4 text-sky-400" />
              <span className="hidden md:inline text-[11px]">Map</span>
            </button>
          )}

          {/* Notifications Trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-1.5 text-slate-300 hover:text-sky-300 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition cursor-pointer"
            title="Alert Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-mono font-black flex items-center justify-center shadow-md animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Audio Alarm Mute/Unmute Toggle */}
          <button
            onClick={() => {
              const nextMuted = alertSoundService.toggleMute();
              setIsMuted(nextMuted);
              if (!nextMuted) {
                alertSoundService.playAlarm('INFO');
              }
            }}
            className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-xs font-mono cursor-pointer ${
              !isMuted
                ? 'text-cyan-300 bg-cyan-950/40 border-cyan-500/40 hover:bg-cyan-900/50 shadow-sm'
                : 'text-slate-500 bg-slate-900/60 border-slate-800 hover:text-slate-400'
            }`}
            title={!isMuted ? "Voice Alert & Tactical Siren Active (Click to Mute)" : "Voice Alert & Tactical Siren Muted (Click to Unmute)"}
          >
            {!isMuted ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Sync Button */}
          <button
            onClick={() => refreshCameras()}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 rounded-lg border border-transparent hover:border-slate-700 transition cursor-pointer"
            title="Refresh Fleet Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>{user?.username || 'ADMIN'}</span>
                {user?.scope_id && user?.scope_id !== '*' && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-mono">
                    DUTY: {user.scope_id}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-cyan-400 font-mono uppercase">
                {user?.scope_role || user?.role || 'COMMANDER'}
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-800/40 transition cursor-pointer"
              title="Sign Out & Return to Defense Gateway"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <NotificationDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          loadUnread();
        }}
      />
    </>
  );
};
