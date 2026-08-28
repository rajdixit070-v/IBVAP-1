import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Activity
} from 'lucide-react';
import { multimodalService } from '../../services/multimodalService';
import { EventGraphData, EventTimelineItem, MultimodalSecurityEvent } from '../../types/multimodal';

interface EventGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: MultimodalSecurityEvent | null;
}

export const EventGraphModal: React.FC<EventGraphModalProps> = ({ isOpen, onClose, event }) => {
  const [activeView, setActiveView] = useState<'graph' | 'timeline'>('graph');
  const [graphData, setGraphData] = useState<EventGraphData | null>(null);
  const [timelineData, setTimelineData] = useState<EventTimelineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && event) {
      setLoading(true);
      Promise.all([
        multimodalService.getEventGraph(event.event_id),
        multimodalService.getEventTimeline(event.event_id)
      ])
        .then(([g, t]) => {
          setGraphData(g);
          setTimelineData(t);
        })
        .catch((err) => console.error('Failed to load event graph/timeline:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  {event.event_id}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                    event.risk_level === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : event.risk_level === 'HIGH'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {event.risk_level} THREAT ({event.risk_score}/100)
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100 mt-1">{event.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveView('graph')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeView === 'graph'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Signal Graph
              </button>
              <button
                onClick={() => setActiveView('timeline')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeView === 'timeline'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                7-Stage Timeline
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-cyan-400 text-sm font-mono animate-pulse">
              Computing Explainable Multimodal Visuals...
            </div>
          ) : activeView === 'graph' ? (
            /* Graph Visual View */
            <div className="space-y-6">
              <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400 font-mono mb-1 uppercase tracking-wider">
                  Correlation Summary & Causality
                </div>
                <p className="text-sm text-slate-200">
                  {graphData?.explanation_summary || event.title}
                </p>
              </div>

              {/* Node Relationship Map */}
              <div className="bg-[#0b1120] p-6 rounded-xl border border-cyan-900/40 relative overflow-hidden">
                <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Connected Multimodal Signal Nodes
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                  {graphData?.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-3.5 bg-slate-900/90 border border-slate-700/60 rounded-lg hover:border-cyan-500/50 transition-all shadow-md"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-cyan-400 font-bold">{node.node_type}</span>
                        {node.confidence !== undefined && node.confidence !== null && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {Math.round(node.confidence * 100)}% CONF
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-100">{node.label}</div>
                      {node.details && Object.keys(node.details).length > 0 && (
                        <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                          {JSON.stringify(node.details)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Edges Summary */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="text-xs font-mono text-slate-400 mb-2 uppercase">
                    Causal Signal Pathways:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {graphData?.edges.map((edge, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5"
                      >
                        <span className="text-cyan-400">{edge.source}</span>
                        <span className="text-slate-500">─({edge.relationship})─►</span>
                        <span className="text-purple-400">{edge.target}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 7-Stage Chronological Timeline View */
            <div className="space-y-4">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-purple-500 before:to-rose-500">
                {timelineData.map((item, idx) => (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-cyan-400 group-hover:scale-125 transition-transform" />

                    <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 hover:border-cyan-500/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            STAGE {idx + 1}: {item.stage}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{item.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{item.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-900">
                        <span>Source: {item.source_component}</span>
                        {item.confidence !== undefined && item.confidence !== null && (
                          <span className="text-cyan-400">
                            Confidence: {Math.round(item.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60 text-xs font-mono text-slate-400">
          <div>Primary Sensor: {event.primary_camera_id}</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-sans text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
