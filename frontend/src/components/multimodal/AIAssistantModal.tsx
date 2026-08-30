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
  ExternalLink
} from 'lucide-react';
import { multimodalService } from '../../services/multimodalService';
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

const SAMPLE_QUERIES = [
  'What is system status?',
  'Operational modules ka use aur functionality btao',
  'Camera kaise add karege?',
  'How to draw a geofence zone?',
  'How to add vehicle watchlist plate?',
  'How to register suspect face?',
  'How to run Incident SOP playbooks?',
  'Kaise run krege starting se?'
];

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `👋 **Jai Hind, Commander!** I am your tactical AI Virtual Assistant.\n\nAap mujhse platform ke kisi bhi module, live telemetry, setup, cameras, geofencing ya threat intelligence ke bare me kuch bhi puch sakte hain.\n\n💡 *Neeche diye gaye quick prompts click karein ya apna sawal type karein:*`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  safety_notice: 'Zero-trust verified intelligence assistant. Read-only database citations.'
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectEvent
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                IBVAP Tactical AI Copilot
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                  ONLINE • LIVE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Natural Language Intelligence, Operational Guidance & Verified Citations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleResetChat}
              title="Reset conversation"
              className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#090d16]/80 font-sans text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.isError
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {msg.isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 space-y-3 leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-600 to-sky-700 text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-tl-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 pb-1 border-b border-white/10">
                  <span className="font-semibold uppercase tracking-wider text-slate-300">
                    {msg.role === 'user' ? 'Commander (You)' : 'IBVAP AI Copilot'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Text Body */}
                <div className="text-xs text-slate-100 whitespace-pre-line leading-relaxed font-sans">
                  {msg.text}
                </div>

                {/* Cited Evidence IDs */}
                {msg.cited_event_ids && msg.cited_event_ids.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-slate-400">Evidence Citations:</span>
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
                      Verified Matching Threat Events ({msg.results.length})
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
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                ev.risk_level === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : ev.risk_level === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}>
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
                <div className="w-7 h-7 rounded-lg bg-sky-600/30 text-sky-200 border border-sky-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl rounded-tl-none p-3 shadow-lg flex items-center gap-3 text-cyan-400 font-mono text-xs">
                <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing telemetry & synthesizing factual guidance...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex gap-2 overflow-x-auto shrink-0 scrollbar-thin">
          {SAMPLE_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(sq)}
              disabled={loading}
              className="text-[11px] px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-cyan-900/50 border border-slate-700/80 text-slate-300 hover:text-white whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {sq}
            </button>
          ))}
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
                placeholder="Ask e.g. 'Operational modules ka use btao', 'How to add a camera?', 'System status'..."
                disabled={loading}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
