import React from 'react';
import {
  LayoutDashboard,
  Video,
  Cctv,
  ShieldAlert,
  Cpu,
  Bell,
  Car,
  Fingerprint,
  Server,
  Flame,
  FileCheck,
  Compass,
  BrainCircuit,
  TrendingUp,
  HeartPulse,
  Globe
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = true }) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Command Overview',
      icon: LayoutDashboard,
      badge: null,
      disabled: false
    },
    {
      id: 'soc',
      label: 'SOC Command Center',
      icon: Flame,
      badge: 'LIVE SOC',
      disabled: false
    },
    {
      id: 'health',
      label: 'System Health Center',
      icon: HeartPulse,
      badge: 'HEALTH',
      disabled: false
    },
    {
      id: 'federation',
      label: 'Multi-Site Central Command',
      icon: Globe,
      badge: 'FEDERATION',
      disabled: false
    },
    {
      id: 'multimodal',
      label: 'Multimodal AI Intelligence',
      icon: BrainCircuit,
      badge: 'AI CORE',
      disabled: false
    },
    {
      id: 'security',
      label: 'Enterprise Zero-Trust Security',
      icon: ShieldAlert,
      badge: 'ZERO-TRUST',
      disabled: false
    },
    {
      id: 'predictive',
      label: 'Predictive Intelligence',
      icon: TrendingUp,
      badge: 'PREDICTIVE',
      disabled: false
    },
    {
      id: 'behaviour',
      label: 'Behaviour Intelligence',
      icon: BrainCircuit,
      badge: 'BEHAVIOUR',
      disabled: false
    },
    {
      id: 'cross-camera',
      label: 'Movement Intelligence',
      icon: Compass,
      badge: 'RE-ID',
      disabled: false
    },
    {
      id: 'incidents',
      label: 'Incidents & Response',
      icon: FileCheck,
      badge: 'PLAYBOOKS',
      disabled: false
    },
    {
      id: 'cameras',
      label: 'Camera Management',
      icon: Cctv,
      badge: 'STREAMS',
      disabled: false
    },
    {
      id: 'live',
      label: 'Live Video Wall',
      icon: Video,
      badge: 'LIVE',
      disabled: false
    },
    {
      id: 'ai-pipeline',
      label: 'AI Inference Pipeline',
      icon: Cpu,
      badge: 'YOLO+TRACK',
      disabled: false
    },
    {
      id: 'intelligence',
      label: 'Virtual Perimeter / Zones',
      icon: ShieldAlert,
      badge: 'FENCING',
      disabled: false
    },
    {
      id: 'anpr',
      label: 'Vehicle Intelligence (ANPR)',
      icon: Car,
      badge: 'ANPR',
      disabled: false
    },
    {
      id: 'face',
      label: 'Facial Watchlist Matrix',
      icon: Fingerprint,
      badge: 'FACE',
      disabled: false
    },
    {
      id: 'edge',
      label: 'Edge Fleet & Sync',
      icon: Server,
      badge: 'EDGE',
      disabled: false
    },
    {
      id: 'events',
      label: 'Security Incident Feed',
      icon: Bell,
      badge: 'ALERTS',
      disabled: false
    }
  ];

  return (
    <aside
      className={`${
        isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none border-r-0'
      } h-full shrink-0 bg-[#0d131f] border-r border-[#1e293b] flex flex-col justify-between select-none overflow-hidden transition-all duration-300 z-20`}
    >
      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-3 py-2 shrink-0">
          OPERATIONAL MODULES
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && setActiveTab(item.id)}
              disabled={item.disabled}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : item.disabled
                  ? 'text-slate-600 cursor-not-allowed opacity-60'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : item.disabled ? 'text-slate-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : item.disabled
                      ? 'bg-slate-800 text-slate-600'
                      : item.badge === 'LIVE SOC'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                      : item.badge === 'ZERO-TRUST'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : item.badge === 'AI CORE' || item.badge === 'FEDERATION'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : item.badge === 'PREDICTIVE' || item.badge === 'BEHAVIOUR' || item.badge === 'RE-ID'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#1e293b] bg-[#0a0e17]/80 shrink-0">
        <div className="bg-[#111a2e] p-3 rounded-lg border border-[#1e293b] space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Forecast Horizon:</span>
            <span className="text-cyan-400 font-mono font-bold">60 MIN</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Decision Support:</span>
            <span className="text-emerald-400 font-mono font-bold">PREDICTIVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
