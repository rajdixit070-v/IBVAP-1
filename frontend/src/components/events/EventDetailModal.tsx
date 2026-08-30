import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { SecurityEvent } from '../../types/event';
import { RiskBadge } from './RiskBadge';
import { eventService } from '../../services/eventService';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  TrendingUp,
  Camera,
  MapPin
} from 'lucide-react';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SecurityEvent | null;
  onStatusUpdated?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onStatusUpdated
}) => {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!event) return null;

  const handleUpdateStatus = async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      await eventService.updateEventStatus(event.event_id, status, comment);
      setComment('');
      if (onStatusUpdated) onStatusUpdated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update event status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`SECURITY INCIDENT // ${event.event_id}`}
      subtitle={`Camera: ${event.camera_id} • Target Track #${event.track_id} (${event.object_type})`}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  {event.event_type.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs font-mono text-sky-400 font-bold">
                  {event.zone_name || 'Restricted Perimeter'}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                First Detected: {new Date(event.started_at).toLocaleTimeString()} • Status: <strong className="text-white">{event.status}</strong>
              </div>
            </div>
          </div>

          <RiskBadge level={event.risk_level} score={event.risk_score} />
        </div>

        {/* Tactical Sensor & Geospatial Location Card */}
        <div className="p-3.5 bg-[#0d1527] border border-[#1e293b] rounded-xl flex items-center justify-between font-mono text-xs shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase">DETECTION LOCATION & SENSOR SECTOR:</span>
              <div className="text-white font-bold text-[12px]">
                {event.location_description || `${event.camera_id} // Perimeter Sector 1`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase">TARGET BEARING:</span>
            <div className="text-emerald-400 font-bold text-[11px]">
              {event.last_direction || 'STATIONARY'} • {event.last_speed ? `${Math.round(event.last_speed)} px/s` : '0 px/s'}
            </div>
          </div>
        </div>

        {/* Forensic Visual Proof / Evidence Snapshot */}
        {(event.evidence_url || event.evidence_id) && (
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-400 uppercase">
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                VERIFIED FORENSIC EVIDENCE SNAPSHOT
              </span>
              <span className="text-[10px] text-emerald-400 font-normal">
                CRYPTOGRAPHIC SHA-256 PROOF
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black/60 aspect-video">
              <img
                src={event.evidence_url || `/api/v1/evidence/${event.evidence_id}/file`}
                alt="Intrusion Forensic Evidence"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).parentElement?.parentElement?.classList.add('hidden');
                }}
              />
              <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                RECORD ID: {event.evidence_id || 'EVD-ATTACHED'}
              </div>
            </div>
          </div>
        )}

        {/* Explainable Threat Risk Factor Breakdown */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              EXPLAINABLE RISK FACTOR BREAKDOWN ({event.risk_score}/100)
            </h4>
            <span className="text-[11px] font-mono text-slate-400">
              Deterministic Weights
            </span>
          </div>

          <div className="space-y-2">
            {event.factors.length === 0 ? (
              <p className="text-xs text-slate-400">Standard baseline risk assessment.</p>
            ) : (
              event.factors.map((factor, idx) => (
                <div
                  key={idx}
                  className="bg-[#0c1322] border border-[#1e293b] rounded-lg p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-slate-200 uppercase">
                      {factor.factor.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-slate-400">{factor.description}</p>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                      factor.weight > 0
                        ? 'bg-rose-950/60 border-rose-500/30 text-rose-400'
                        : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {factor.weight > 0 ? `+${factor.weight}` : factor.weight}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Legal / Ethical Human Verification Notice */}
          <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-[11px] text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Operational Disclaimer:</strong> AI-generated threat assessment is advisory. Human operator verification is mandatory prior to physical interdiction.
            </p>
          </div>
        </div>

        {/* Chronological Incident Timeline */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Clock className="w-4 h-4" />
            CHRONOLOGICAL INCIDENT TIMELINE
          </h4>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2">
            {event.timeline.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs">
                <span className="font-mono text-slate-500 shrink-0 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px]">
                  {entry.timestamp}
                </span>
                <span className="text-slate-300 font-mono leading-relaxed">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operator Resolution & Actions */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <FileText className="w-4 h-4" />
            OPERATOR ACTION & LOG
          </h4>

          <input
            type="text"
            placeholder="Add operational notes or dispatch summary (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              onClick={() => handleUpdateStatus('DISMISSED')}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
              DISMISS FALSE ALARM
            </button>

            <button
              onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              ACKNOWLEDGE EVENT
            </button>

            <button
              onClick={() => handleUpdateStatus('RESOLVED')}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              RESOLVE INCIDENT
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
