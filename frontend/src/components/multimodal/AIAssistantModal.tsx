import React, { useState } from 'react';
import {
  X,
  Bot,
  Send,
  ShieldAlert,
  Search,
  CheckCircle
} from 'lucide-react';
import { multimodalService } from '../../services/multimodalService';
import { AIAssistantResponse, MultimodalSecurityEvent } from '../../types/multimodal';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent?: (event: MultimodalSecurityEvent) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectEvent
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIAssistantResponse | null>(null);

  const sampleQueries = [
    'What is system status?',
    'How to add a camera?',
    'How to draw a geofence zone?',
    'How to add vehicle watchlist plate?',
    'How to register suspect face?',
    'How to run Incident SOP playbooks?',
    'Show high risk night time events',
    'Check AI model engines status'
  ];

  const handleSearch = async (qText: string) => {
    if (!qText.trim()) return;
    setLoading(true);
    try {
      const res = await multimodalService.queryAssistant(qText.trim());
      setResponse(res);
    } catch (err) {
      console.error('Failed to query AI assistant:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-950/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Multimodal AI Search & Intelligence Assistant
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  FACTUAL EVIDENCE ONLY
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Natural language query assistant with verified database citations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query Input */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask e.g. 'Show high-risk night events in BOP Alpha'..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Analyze
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {sampleQueries.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Content / Results */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-cyan-400 text-sm font-mono animate-pulse">
              <Bot className="w-8 h-8 mb-2" />
              Synthesizing Multi-Signal Database Records & Citations...
            </div>
          ) : response ? (
            <div className="space-y-4">
              {/* Explanation Card */}
              <div className="bg-slate-950/80 p-4 rounded-lg border border-cyan-900/40">
                <div className="text-xs font-mono text-cyan-400 mb-1 flex items-center gap-1.5 uppercase">
                  <CheckCircle className="w-3.5 h-3.5" /> AI Synthesis & Citations
                </div>
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
                  {response.explanation}
                </div>

                {/* Citations list */}
                {response.cited_event_ids.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-900 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>Cited Events:</span>
                    {response.cited_event_ids.map((id) => (
                      <span key={id} className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Matched Events List */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Verified Matched Events ({response.results.length})
                </div>
                {response.results.map((ev) => (
                  <div
                    key={ev.event_id}
                    onClick={() => onSelectEvent && onSelectEvent(ev)}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg hover:border-cyan-500/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-cyan-400 font-bold">{ev.event_id}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            ev.risk_level === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400'
                              : ev.risk_level === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {ev.risk_level} ({ev.risk_score})
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {ev.primary_camera_id} • {ev.bop_name}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-200">{ev.title}</div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(ev.event_occurred_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Safety notice */}
              <div className="p-3 bg-slate-950 border border-slate-900 rounded text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>{response.safety_notice}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Enter a natural language search query above or choose a sample prompt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
