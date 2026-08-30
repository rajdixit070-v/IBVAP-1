import React, { useState, useEffect } from 'react';
import { Shield, Radio, RefreshCw, User as UserIcon, Bell, MapPin, LogOut, Bot } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCameras } from '../../context/CameraContext';
import { NotificationDrawer } from './NotificationDrawer';
import { incidentService } from '../../services/incidentService';

interface HeaderProps {
  onOpenMap?: () => void;
  onOpenAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMap, onOpenAssistant }) => {
  const { user, logout } = useAuth();
  const { summary, refreshCameras, loading } = useCameras();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUnread = async () => {
    try {
      const notifs = await incidentService.getNotifications(true);
      setUnreadCount(notifs.length);
    } catch (e) {
      // quiet fail
    }
  };

  return (
    <>
      <header className="h-16 bg-[#0d131f] border-b border-[#1e293b] px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Brand & Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Shield className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-white tracking-wider">IBVAP</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 font-semibold">
                  ENTERPRISE COMMAND MATRIX
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans tracking-wide">
                Intelligent Border Video Analytics Platform
              </p>
            </div>
          </div>

          {/* Live System Indicator */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-emerald-400 font-medium">SOC COMMAND BUS ONLINE</span>
          </div>
        </div>

        {/* Right Telemetry & Controls */}
        <div className="flex items-center gap-4">
          {/* Quick Fleet Pill */}
          {summary && (
            <div className="hidden lg:flex items-center gap-3 bg-[#111a2e] px-3.5 py-1.5 rounded-lg border border-[#22324d] text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>TOTAL: <strong className="text-white">{summary.total_cameras}</strong></span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400">ONLINE: <strong>{summary.healthy}</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">DEGRADED: <strong>{summary.degraded}</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400">OFFLINE: <strong>{summary.offline}</strong></span>
            </div>
          )}

          {/* AI Virtual Assistant Trigger Button */}
          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-500/10 to-sky-500/10 hover:from-cyan-500/20 hover:to-sky-500/20 text-cyan-400 hover:text-cyan-300 rounded-lg border border-cyan-500/30 transition flex items-center gap-1.5 text-xs font-mono shadow-sm"
              title="Open AI Virtual Assistant (Operational Workflows & Telemetry)"
            >
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline font-semibold">AI Copilot</span>
            </button>
          )}

          {/* Situational Map Trigger Button */}
          {onOpenMap && (
            <button
              onClick={onOpenMap}
              className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition flex items-center gap-1 text-xs font-mono"
              title="Open Tactical Border Map"
            >
              <MapPin className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Map</span>
            </button>
          )}

          {/* Notifications Trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition"
            title="Alert Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-mono font-black flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={() => refreshCameras()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 rounded-lg border border-transparent hover:border-slate-700 transition"
            title="Refresh Fleet Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white uppercase tracking-wider">{user?.username || 'ADMIN'}</div>
              <div className="text-[10px] text-sky-400 font-mono uppercase">{user?.role || 'COMMANDER'}</div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 ml-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-800/50 transition flex items-center gap-1 text-xs font-mono"
              title="Sign Out Session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline text-[11px]">Logout</span>
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
