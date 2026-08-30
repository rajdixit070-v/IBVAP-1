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
  Globe,
  ShieldCheck,
  Activity,
  FolderLock
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = true }) => {
  const sections: NavSection[] = [
    {
      title: 'COMMAND & OPERATIONS',
      items: [
        {
          id: 'dashboard',
          label: 'Command Overview',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'soc',
          label: 'SOC Command Center',
          icon: Flame,
          badge: 'LIVE'
        },
        {
          id: 'live',
          label: 'Live Video Wall',
          icon: Video,
          badge: 'FEED'
        },
        {
          id: 'cameras',
          label: 'Camera Management',
          icon: Cctv,
          badge: null
        },
        {
          id: 'health',
          label: 'System Health Center',
          icon: HeartPulse,
          badge: null
        }
      ]
    },
    {
      title: 'PERIMETER & SENSORS',
      items: [
        {
          id: 'intelligence',
          label: 'Virtual Perimeter / Zones',
          icon: ShieldAlert,
          badge: 'ZONES'
        },
        {
          id: 'ai-pipeline',
          label: 'AI Inference Pipeline',
          icon: Cpu,
          badge: 'YOLO'
        },
        {
          id: 'anpr',
          label: 'Vehicle Intelligence (ANPR)',
          icon: Car,
          badge: 'ANPR'
        },
        {
          id: 'face',
          label: 'Facial Watchlist Matrix',
          icon: Fingerprint,
          badge: 'FACE'
        },
        {
          id: 'edge',
          label: 'Edge Fleet & Sync',
          icon: Server,
          badge: 'EDGE'
        }
      ]
    },
    {
      title: 'TACTICAL INTELLIGENCE',
      items: [
        {
          id: 'multimodal',
          label: 'Multimodal AI Intelligence',
          icon: BrainCircuit,
          badge: 'CORE'
        },
        {
          id: 'behaviour',
          label: 'Behaviour Intelligence',
          icon: Activity,
          badge: null
        },
        {
          id: 'cross-camera',
          label: 'Movement & Re-ID',
          icon: Compass,
          badge: 'CORRIDORS'
        },
        {
          id: 'predictive',
          label: 'Predictive Intelligence',
          icon: TrendingUp,
          badge: null
        }
      ]
    },
    {
      title: 'SECURITY & RESPONSE',
      items: [
        {
          id: 'incidents',
          label: 'Incidents & Playbooks',
          icon: FileCheck,
          badge: 'SOP'
        },
        {
          id: 'events',
          label: 'Security Threat Feed',
          icon: Bell,
          badge: 'THREATS'
        },
        {
          id: 'evidence',
          label: 'Forensic Evidence Vault',
          icon: FolderLock,
          badge: 'VAULT'
        },
        {
          id: 'security',
          label: 'Enterprise Zero-Trust',
          icon: ShieldCheck,
          badge: '88/100'
        },
        {
          id: 'federation',
          label: 'Multi-Site Federation',
          icon: Globe,
          badge: null
        }
      ]
    }
  ];

  return (
    <aside
      className={`${
        isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none border-r-0'
      } h-full shrink-0 bg-[#090e17] border-r border-[#1e293b]/80 flex flex-col justify-between select-none overflow-hidden transition-all duration-300 z-20 shadow-2xl`}
    >
      {/* Scrollable Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-3 py-1 font-bold flex items-center justify-between">
              <span>{section.title}</span>
              <span className="w-8 h-[1px] bg-slate-800" />
            </div>

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                  className={`w-full relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : item.disabled
                      ? 'text-slate-600 cursor-not-allowed opacity-50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {/* Active Left Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-cyan-400 shadow-sm shadow-cyan-400" />
                  )}

                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-cyan-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate tracking-wide">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isActive
                          ? 'bg-cyan-400 text-slate-950 font-black'
                          : item.badge === 'LIVE'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                          : item.badge === '88/100'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Military Readiness HUD Footer */}
      <div className="p-3 border-t border-[#1e293b]/80 bg-[#070b12] shrink-0">
        <div className="bg-[#0e1626] p-2.5 rounded-lg border border-[#1e293b] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">AI DETECTOR:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              YOLOv8 ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">ZERO-TRUST:</span>
            <span className="text-cyan-400 font-bold">ENFORCED (88)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
