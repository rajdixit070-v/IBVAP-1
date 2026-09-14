import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bot,
  Send,
  ShieldAlert,
  Search,
  RotateCcw,
  AlertTriangle,
  User,
  ExternalLink,
  Volume2,
  Copy,
  Check,
  Sparkles,
  Building2,
  Radio,
  Camera as CameraIcon,
  Flame,
  MapPin,
  BellRing,
  Lock,
  Car,
  Rocket,
  Maximize2,
  Minimize2,
  HeartPulse,
  Compass
} from 'lucide-react';
import { multimodalService } from '../../services/multimodalService';
import { alertSoundService } from '../../services/alertSoundService';
import { MultimodalSecurityEvent } from '../../types/multimodal';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  parsed_filters?: any;
  cited_event_ids?: string[];
  cited_camera_ids?: string[];
  results?: MultimodalSecurityEvent[];
  safety_notice?: string;
  isError?: boolean;
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent?: (event: MultimodalSecurityEvent) => void;
}

interface QueryCategory {
  id: string;
  label: string;
  icon: any;
  color: string;
  queries: string[];
}

const QUERY_CATEGORIES: QueryCategory[] = [
  {
    id: 'top',
    label: '🌟 Top Queries',
    icon: Sparkles,
    color: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
    queries: [
      'Commander kaise appoint karein aur checkpost kaise banayein?',
      'Checkpost ke Latitude & Longitude coordinates kaise dalein?',
      'System Health Center me kya kya features hain?',
      'HQ monitoring aur real-time incident sync kaise hota hai?',
      'Live fleet status aur database telemetry report dikhao',
      'Default admin aur officer login password kya hai?',
      'Camera kaise add karege RTSP stream se?',
      'Project ka overview aur architecture kya hai?'
    ]
  },
  {
    id: 'checkpost',
    label: '🏛️ Commander & Checkpost',
    icon: Compass,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
    queries: [
      'Commander kaise appoint karein aur checkpost kaise banayein?',
      'Checkpost ke Latitude & Longitude coordinates kaise dalein?',
      'Checkpost Defense Priority SLA (Critical/High/Normal) kya hai?',
      'Frontier sectors (Punjab, Rajasthan, Sikkim) kaise assign karein?',
      'Checkpost Tactical GIS Border Map par kaise pin hoti hai?'
    ]
  },
  {
    id: 'health',
    label: '🩺 System Health Center',
    icon: HeartPulse,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
    queries: [
      'System Health Center me kya kya features hain?',
      'Operational Alert Banner me offline camera ya checkpost warning kaise aati hai?',
      'Evidence Video Storage aur recording buffer days kitne bache hain?',
      'HQ Stream link latency aur packet loss report dikhao',
      'System Health score (/100) kaise calculate hota hai?'
    ]
  },
  {
    id: 'admin',
    label: '🏢 HQ Admin Guide',
    icon: Building2,
    color: 'text-sky-400 border-sky-500/30 bg-sky-950/20',
    queries: [
      'Admin ka kya kaam hai aur HQ Command Center kaise chalayein?',
      'New Field Officers aur User permissions kaise manage karein?',
      'Multi-Site Federation aur National Map kaise monitor karein?',
      'Field officers se aane wale Daily SITREPs aur Evidence kaise review karein?',
      'Major intrusion par Quick Reaction Team (QRT) response kaise authorize karein?'
    ]
  },
  {
    id: 'officer',
    label: '🛰️ Field Officer Duties',
    icon: Radio,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
    queries: [
      'Checkpost Field Officer ki primary duties kya hain?',
      'Ground checkpost par new physical camera kaise integrate karein?',
      'Live Video Wall aur PTZ Joystick zoom kaise operate karein?',
      'Perimeter Zero-Line par Virtual Tripwire / Geofence kaise banayein?',
      'Sandigh movement par Evidence snapshot aur HQ Dispatch kaise karein?'
    ]
  },
  {
    id: 'camera',
    label: '📹 Cameras & Video',
    icon: CameraIcon,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
    queries: [
      'Camera kaise add karege?',
      'RTSP Stream URL format kya hai aur credentials kaise secure hote hain?',
      'Live Multi-View Video Wall me 1x1, 2x2, 3x3 grids kaise switch karein?',
      'PTZ Camera ke preset positions aur optical zoom kaise set karein?',
      'Camera status OFFLINE hone par troubleshoot kaise karein?'
    ]
  },
  {
    id: 'drone_thermal',
    label: '⚡ Drone & Thermal',
    icon: Flame,
    color: 'text-rose-400 border-rose-500/30 bg-rose-950/20',
    queries: [
      'Drone Fleet Operations me autonomous patrol mission kaise launch karein?',
      'Target Handoff kya hai aur ground camera se drone ko target kaise transfer hota hai?',
      'Thermal Vision me 5 Tactical Shader Palettes (FLIR Ironbow, NVG, White Hot) kaise use karein?',
      'Spot Pyrometer kya hai aur surface temperature kaise measure karein?',
      'Multi-Sensor Bayesian Fusion me Optical, Radar aur Seismic sensors kaise correlate hote hain?'
    ]
  },
  {
    id: 'gis',
    label: '🗺️ GIS Intelligence',
    icon: MapPin,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/20',
    queries: [
      'GIS Layer Stack kya hai aur map par satellite, thermal, terrain overlays kaise enable karein?',
      'GIS Coordinate Finder se Latitude/Longitude par direct jump kaise karein?',
      'Border blind spots aur elevation terrain analysis kaise karein?'
    ]
  },
  {
    id: 'alerts',
    label: '🚨 Siren & Alerts',
    icon: BellRing,
    color: 'text-orange-400 border-orange-500/30 bg-orange-950/20',
    queries: [
      'Alert aane par Tactical Siren aur Voice Announcement kaise bachta hai?',
      'Alert ko acknowledge karke Incident case file me escalate kaise karein?',
      'QRT (Quick Reaction Team) dispatch aur SOP checklist execution kaise karein?',
      'Voice Alert sound ko Mute ya Unmute kaise karein?'
    ]
  },
  {
    id: 'forensics',
    label: '🔐 Forensics & Security',
    icon: Lock,
    color: 'text-violet-400 border-violet-500/30 bg-violet-950/20',
    queries: [
      'Forensic Evidence Vault kya hai aur SHA-256 digital signature kaise verify hota hai?',
      'Court-admissible tamper-proof incident evidence report kaise export karein?',
      'Zero-Trust RBAC roles aur Encrypted Audit Logs kaise inspect karein?'
    ]
  },
  {
    id: 'anpr_face',
    label: '🚗 ANPR & Biometrics',
    icon: Car,
    color: 'text-teal-400 border-teal-500/30 bg-teal-950/20',
    queries: [
      'Stolen ya suspect vehicles ki ANPR watchlist me plate number kaise add karein?',
      'Suspect face photograph upload karke 128D biometric recognition kaise karein?',
      'Loitering aur sprint running jaise behaviour anomalies kaise detect hote hain?'
    ]
  },
  {
    id: 'setup',
    label: '🚀 Setup & Maintenance',
    icon: Rocket,
    color: 'text-pink-400 border-pink-500/30 bg-pink-950/20',
    queries: [
      'Starting se project run aur access kaise karein?',
      'Default admin aur officer credentials kya hain?',
      'System Health Center me real-time monitoring kaise dekhein?'
    ]
  }
];

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `👋 **Jai Hind, Commander!** I am your Tactical AI Copilot.

Aap **Checkpost Commander Appointment**, **GPS Latitude/Longitude Coordinates**, **System Health Center**, **HQ Monitoring**, **Cameras**, **Drone Patrols**, **Thermal Palettes**, **GIS Layers**, **Audio Siren Alerts**, ya **Forensic Evidence** ke baare me platform se related koi bhi sawal puch sakte hain.

💡 *Neeche di gayi categories me se direct question select karein ya apna custom question niche type karein:*`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  safety_notice: 'Zero-trust verified intelligence copilot. Real-time production database citations & mission guidance.'
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectEvent
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [activeCategory, setActiveCategory] = useState<string>('top');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSearch = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await multimodalService.queryAssistant(trimmed);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: res.explanation || 'No explanation returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsed_filters: res.parsed_filters,
        cited_event_ids: res.cited_event_ids,
        cited_camera_ids: res.cited_camera_ids,
        results: res.results,
        safety_notice: res.safety_notice
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Failed to query AI assistant:', err);
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        isError: true,
        text: `⚠️ **Communication Error**: ${
          err?.response?.data?.detail ||
          err?.message ||
          'Server unreachable. Please verify backend is running on http://localhost:8000'
        }`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        safety_notice: 'Request could not be completed. Check network and backend logs.'
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([INITIAL_WELCOME]);
    setQuery('');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeakText = (msgId: string, text: string) => {
    if (speakingId === msgId) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }

    setSpeakingId(msgId);
    alertSoundService.speakVoiceAlert(text);
    const words = text.split(' ').length;
    const durationMs = Math.min(30000, Math.max(3000, words * 320));
    setTimeout(() => {
      setSpeakingId((prev) => (prev === msgId ? null : prev));
    }, durationMs);
  };

  if (!isOpen) return null;

  const currentCategoryData = QUERY_CATEGORIES.find((c) => c.id === activeCategory) || QUERY_CATEGORIES[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in">
      {/* Right-Side Slide-Over Drawer Container */}
      <div
        className={`h-full flex flex-col bg-[#0b101c] border-l border-cyan-500/40 shadow-2xl shadow-cyan-950/80 transition-all duration-300 ${
          isExpanded ? 'w-full max-w-4xl' : 'w-full sm:w-[500px] md:w-[560px]'
        }`}
      >
        {/* Header Bar */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-wide">
                  IBVAP Tactical AI Copilot
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold">
                  RIGHT-SIDE COPILOT
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Instant Mission Guidance, Telemetry & Operational Workflow Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Dock to Right Side" : "Expand View"}
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleResetChat}
              title="Reset conversation"
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              title="Close Copilot"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#080d18] font-sans text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow ${
                    msg.isError
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {msg.isError ? <AlertTriangle className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl p-3.5 space-y-2.5 leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-600 to-sky-700 text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-tl-none'
                    : 'bg-slate-900/95 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 pb-1 border-b border-white/10">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    {msg.role === 'user' ? (
                      <>
                        <User className="w-3 h-3 text-cyan-300" />
                        Commander (You)
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-cyan-400" />
                        IBVAP AI Copilot
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {msg.role === 'assistant' && !msg.isError && (
                      <>
                        <button
                          onClick={() => handleSpeakText(msg.id, msg.text)}
                          className={`p-1 rounded hover:bg-white/10 transition cursor-pointer ${
                            speakingId === msg.id ? 'text-cyan-300 animate-pulse' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Read aloud with Voice"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Text Body */}
                <div className="text-xs text-slate-100 whitespace-pre-line leading-relaxed font-sans selection:bg-cyan-500/30">
                  {msg.text}
                </div>

                {/* Cited Evidence IDs */}
                {msg.cited_event_ids && msg.cited_event_ids.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-slate-400 font-semibold">Evidence Citations:</span>
                    {msg.cited_event_ids.map((id) => (
                      <span
                        key={id}
                        className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}

                {/* Matched Events List */}
                {msg.results && msg.results.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                      Verified Threat Events ({msg.results.length})
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {msg.results.map((ev) => (
                        <div
                          key={ev.event_id}
                          onClick={() => {
                            if (onSelectEvent) {
                              onSelectEvent(ev);
                              onClose();
                            }
                          }}
                          className="p-2.5 bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-lg cursor-pointer transition flex items-center justify-between group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-cyan-300 font-bold">{ev.event_id}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                  ev.risk_level === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : ev.risk_level === 'HIGH'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-cyan-500/20 text-cyan-300'
                                }`}
                              >
                                {ev.risk_level} ({ev.risk_score})
                              </span>
                              <span className="text-slate-400 text-[11px] font-mono">
                                {ev.primary_camera_id} • {ev.bop_name}
                              </span>
                            </div>
                            <div className="text-slate-300 text-xs mt-0.5 group-hover:text-white">
                              {ev.title}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safety Notice */}
                {msg.safety_notice && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                    <ShieldAlert className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{msg.safety_notice}</span>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-sky-600/30 text-sky-200 border border-sky-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl rounded-tl-none p-3 shadow-lg flex items-center gap-2.5 text-cyan-400 font-mono text-xs">
                <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing mission query & synthesizing verified operational guidance...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Categorized Suggested Questions Section */}
        <div className="bg-slate-900/95 border-t border-slate-800 p-2 space-y-2 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {QUERY_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-medium flex items-center gap-1 whitespace-nowrap transition cursor-pointer border ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-700/80'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Question Chips for Active Category */}
          <div className="flex gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
            {currentCategoryData.queries.map((qText, idx) => (
              <button
                key={idx}
                onClick={() => handleSearch(qText)}
                disabled={loading}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-cyan-950/40 active:bg-cyan-900/60 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-200 whitespace-nowrap transition-all cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5 group shadow-sm font-sans"
              >
                <span className="text-cyan-400 font-mono text-[9px] group-hover:translate-x-0.5 transition">›</span>
                <span className="truncate max-w-[280px]">{qText}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question (e.g. 'Commander appoint', 'GPS coordinates', 'System health')..."
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
