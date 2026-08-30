import React, { useState, useEffect } from 'react';
import { SecurityEvent, SecurityEventsSummary } from '../types/event';
import { eventService, SecurityEventsWebSocket } from '../services/eventService';
import { RiskBadge } from '../components/events/RiskBadge';
import { EventDetailModal } from '../components/events/EventDetailModal';
import {
  ShieldAlert,
  AlertTriangle,
  Filter,
  RefreshCw,
  Clock,
  TrendingUp
} from 'lucide-react';

export const SecurityEventsPage: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [summary, setSummary] = useState<SecurityEventsSummary | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    loadData();

    // Listen to real-time security events WebSocket
    const ws = new SecurityEventsWebSocket((msg: { event: string; data: SecurityEvent }) => {
      if (msg.event === 'NEW_SECURITY_EVENT' || msg.event === 'SECURITY_EVENT_UPDATED') {
        loadData();
      }
    });

    const interval = setInterval(loadData, 5000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [selectedCamera, selectedRiskLevel, selectedEventType, selectedStatus]);

  const loadData = async () => {
    try {
      const [eventsData, summaryData] = await Promise.all([
        eventService.getEvents({
          camera_id: selectedCamera || undefined,
          risk_level: selectedRiskLevel || undefined,
          event_type: selectedEventType || undefined,
          status: selectedStatus || undefined,
          limit: 100
        }),
        eventService.getSummary()
      ]);
      setEvents(eventsData);
      setSummary(summaryData);
    } catch (e) {
      console.error('Failed to load security events', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#21121d] via-[#0f172a] to-[#0d131f] border border-[#3b192e] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
              SECURITY OPERATIONS CENTER (SOC)
            </span>
            <span className="text-slate-400 font-mono text-xs">• REAL-TIME THREAT INTELLIGENCE FEED</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Border Security Incident Log & Risk Matrix
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Consolidated threat intelligence event stream. Real-time logging of perimeter breaches, loitering, stationary targets, wrong-direction movement, and coordinated group crossings with explainable risk scoring.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {/* Threat Summary Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">CRITICAL THREATS</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {summary?.critical_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-orange-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-orange-400 font-bold">HIGH RISK EVENTS</span>
            <div className="text-2xl font-mono font-black text-orange-400">
              {summary?.high_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 font-bold">MEDIUM RISKS</span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {summary?.medium_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">LOW SEVERITY</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {summary?.low_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-semibold font-mono">
          <Filter className="w-4 h-4 text-sky-400" />
          FILTERS:
        </div>

        <select
          value={selectedRiskLevel}
          onChange={(e) => setSelectedRiskLevel(e.target.value)}
          className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
        >
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">🔴 Critical (81-100)</option>
          <option value="HIGH">🟠 High (61-80)</option>
          <option value="MEDIUM">🟡 Medium (31-60)</option>
          <option value="LOW">🟢 Low (0-30)</option>
        </select>

        <select
          value={selectedEventType}
          onChange={(e) => setSelectedEventType(e.target.value)}
          className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
        >
          <option value="">All Incident Types</option>
          <option value="ZONE_INTRUSION">Zone Intrusion</option>
          <option value="LOITERING">Loitering Behaviour</option>
          <option value="WRONG_DIRECTION">Wrong-Direction Movement</option>
          <option value="STATIONARY_VEHICLE">Suspicious Stationary Vehicle</option>
          <option value="GROUP_MOVEMENT">Group Movement</option>
          <option value="RAPID_MOVEMENT">Rapid Abnormal Movement</option>
          <option value="ZONE_EXIT">Zone Exit</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          <option value="DISMISSED">DISMISSED</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>

        <input
          type="text"
          placeholder="Filter by Camera ID (e.g. CAM-001)..."
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
        />
      </div>

      {/* Security Events Table */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-4 py-3">RISK SCORE</th>
                <th className="px-4 py-3">INCIDENT TYPE</th>
                <th className="px-4 py-3">CAMERA & SECTOR</th>
                <th className="px-4 py-3">TARGET</th>
                <th className="px-4 py-3">ZONE</th>
                <th className="px-4 py-3">TIME</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No security events found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr
                    key={evt.event_id}
                    onClick={() => setSelectedEvent(evt)}
                    className="hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <RiskBadge level={evt.risk_level} score={evt.risk_score} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white uppercase">
                        {evt.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sky-400 font-bold">{evt.camera_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {evt.evidence_url && (
                          <img
                            src={evt.evidence_url}
                            alt="Snapshot"
                            className="w-9 h-7 rounded object-cover border border-slate-700 bg-black shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).classList.add('hidden');
                            }}
                          />
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 uppercase text-[10px]">
                          {evt.object_type} #{evt.track_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {evt.zone_name || 'Restricted Wire'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(evt.started_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          evt.status === 'ACTIVE'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                            : evt.status === 'ACKNOWLEDGED'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-500/30'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-semibold transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
          onStatusUpdated={loadData}
        />
      )}
    </div>
  );
};
