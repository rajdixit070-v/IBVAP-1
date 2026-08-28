import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Incident, Evidence } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { useCameras } from '../../context/CameraContext';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import {
  Clock,
  Radio,
  Send,
  FileCheck
} from 'lucide-react';

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string | null;
  onUpdated: () => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  onUpdated
}) => {
  const { cameras } = useCameras();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  // Operator Action State
  const [actionType, setActionType] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState('');
  const [assignUnit, setAssignUnit] = useState('Quick Reaction Team (QRT-1)');
  const [escalateReason, setEscalateReason] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [falseAlarmReason, setFalseAlarmReason] = useState('shadow');
  const [falseAlarmNotes, setFalseAlarmNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (incidentId && isOpen) {
      loadIncident();
    }
  }, [incidentId, isOpen]);

  const loadIncident = async () => {
    if (!incidentId) return;
    setLoading(true);
    setError(null);
    try {
      const [incData, evData] = await Promise.all([
        incidentService.getIncidentDetail(incidentId),
        incidentService.getIncidentEvidence(incidentId).catch(() => [])
      ]);
      setIncident(incData);
      setEvidenceList(evData);
      setAssignUser(incData.assigned_to || '');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load incident detail.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident) return;
    setSubmitting(true);
    setError(null);

    try {
      if (actionType === 'assign') {
        if (!assignUser.trim()) throw new Error('Please enter assignee name.');
        await incidentService.assignIncident(incident.incident_id, assignUser, assignUnit);
      } else if (actionType === 'escalate') {
        if (!escalateReason.trim()) throw new Error('Please provide escalation justification.');
        await incidentService.escalateIncident(incident.incident_id, escalateReason);
      } else if (actionType === 'resolve') {
        if (!resolutionNotes.trim()) throw new Error('Please provide resolution summary.');
        await incidentService.resolveIncident(incident.incident_id, resolutionNotes);
      } else if (actionType === 'close') {
        await incidentService.closeIncident(incident.incident_id);
      } else if (actionType === 'false_alarm') {
        await incidentService.markFalseAlarm(incident.incident_id, falseAlarmReason, falseAlarmNotes);
      }

      setActionType(null);
      await loadIncident();
      onUpdated();
    } catch (err: any) {
      setError(err.message || err.response?.data?.detail || 'Failed to execute operation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!incident && !loading) return null;

  const sourceCamera = cameras.find((c) => c.camera_id === incident?.camera_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={incident ? `Incident Dossier // ${incident.incident_id}` : 'Incident Details'}
      subtitle={incident ? `${incident.title} • [${incident.priority}]` : 'Loading incident dossier...'}
      maxWidth="3xl"
    >
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-xs">
          Loading operational incident dossier...
        </div>
      ) : incident ? (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Top Status & Context Pill */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#090d16] p-4 rounded-xl border border-[#1e293b] font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">STATUS</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block mt-0.5 border ${
                  incident.status === 'RESOLVED' || incident.status === 'CLOSED'
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                    : incident.status === 'ESCALATED' || incident.priority === 'CRITICAL'
                    ? 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                    : incident.status === 'FALSE_ALARM'
                    ? 'bg-slate-900 text-slate-400 border-slate-700'
                    : 'bg-amber-950/70 text-amber-300 border-amber-500/30'
                }`}
              >
                {incident.status}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">PRIORITY / RISK</span>
              <span className="text-white font-bold block mt-0.5">
                {incident.priority} ({incident.risk_score}/100)
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">LOCATION</span>
              <span className="text-sky-400 font-bold block mt-0.5">
                {incident.camera_id} • {incident.bop_site}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">ASSIGNED TO</span>
              <span className="text-slate-300 block mt-0.5">
                {incident.assigned_to || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Live Camera View & Description */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                  LIVE CAMERA // {incident.camera_id}
                </span>
                {incident.track_id > 0 && (
                  <span className="text-amber-400">TRACK FOCUS #{incident.track_id}</span>
                )}
              </div>

              {sourceCamera ? (
                <div className="rounded-xl overflow-hidden border border-[#1e293b] shadow-lg">
                  <LiveVideoPlayer camera={sourceCamera} showControls={false} />
                </div>
              ) : (
                <div className="bg-[#090d16] border border-[#1e293b] p-8 rounded-xl text-center text-slate-500 text-xs font-mono">
                  Source camera stream disconnected.
                </div>
              )}
            </div>

            {/* Incident Description & Action Bar */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="bg-[#090d16] p-4 rounded-xl border border-[#1e293b] space-y-2">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase">Operational Briefing</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {incident.description || 'No additional field briefing entered.'}
                </p>
                {incident.zone_name && (
                  <div className="pt-2 text-[11px] font-mono text-slate-500 border-t border-slate-800">
                    Target Zone: <span className="text-slate-300">{incident.zone_name}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-400 font-bold uppercase">
                  Operator Actions
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setActionType('assign')}
                    disabled={incident.status === 'CLOSED' || incident.status === 'FALSE_ALARM'}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition disabled:opacity-40 border border-slate-700"
                  >
                    ASSIGN UNIT
                  </button>
                  <button
                    onClick={() => setActionType('escalate')}
                    disabled={incident.status === 'CLOSED' || incident.status === 'FALSE_ALARM'}
                    className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono font-bold transition disabled:opacity-40"
                  >
                    ESCALATE
                  </button>
                  <button
                    onClick={() => setActionType('resolve')}
                    disabled={incident.status === 'CLOSED' || incident.status === 'RESOLVED' || incident.status === 'FALSE_ALARM'}
                    className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold transition disabled:opacity-40"
                  >
                    RESOLVE
                  </button>
                  <button
                    onClick={() => setActionType('close')}
                    disabled={incident.status !== 'RESOLVED'}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono font-bold transition disabled:opacity-40"
                  >
                    CLOSE
                  </button>
                  <button
                    onClick={() => setActionType('false_alarm')}
                    disabled={incident.status === 'CLOSED' || incident.status === 'RESOLVED' || incident.status === 'FALSE_ALARM'}
                    className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold transition disabled:opacity-40 col-span-2 sm:col-span-2"
                  >
                    MARK FALSE ALARM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Form Subdrawer */}
          {actionType && (
            <form onSubmit={handleActionSubmit} className="p-4 bg-[#0d1322] border border-sky-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-400 uppercase">
                <span>Action: {actionType.replace('_', ' ')}</span>
                <button type="button" onClick={() => setActionType(null)} className="text-slate-500 hover:text-white">
                  Cancel
                </button>
              </div>

              {actionType === 'assign' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Operator Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Duty Officer Sharma"
                      value={assignUser}
                      onChange={(e) => setAssignUser(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Assigned Unit</label>
                    <input
                      type="text"
                      value={assignUnit}
                      onChange={(e) => setAssignUnit(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {actionType === 'escalate' && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Escalation Reason</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Justify escalation to Sector Commander..."
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {actionType === 'resolve' && (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Resolution Summary</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe field action taken and perimeter status..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {actionType === 'false_alarm' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">False Alarm Category</label>
                    <select
                      value={falseAlarmReason}
                      onChange={(e) => setFalseAlarmReason(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="animal">Animal Movement (Cattle/Wildlife)</option>
                      <option value="weather">Severe Weather (Wind/Rain/Fog)</option>
                      <option value="shadow">Shadow / Tree Sway Artifact</option>
                      <option value="maintenance">Authorized Maintenance Patrol</option>
                      <option value="other">Other False Detection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Operator Notes</label>
                    <input
                      type="text"
                      placeholder="Notes for model training feedback dataset..."
                      value={falseAlarmNotes}
                      onChange={(e) => setFalseAlarmNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {actionType === 'close' && (
                <p className="text-xs text-slate-400">
                  Are you sure you want to permanently close this incident dossier?
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono font-bold transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'EXECUTING...' : 'CONFIRM ACTION'}
                </button>
              </div>
            </form>
          )}

          {/* Evidence References */}
          {evidenceList.length > 0 && (
            <div className="bg-[#090d16] p-4 rounded-xl border border-[#1e293b] space-y-2 font-mono text-xs">
              <h4 className="font-bold text-slate-300 uppercase flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Attached Evidence Records & SHA-256 Integrity
              </h4>
              <div className="space-y-1.5">
                {evidenceList.map((ev) => (
                  <div key={ev.id} className="p-2 bg-[#111a2e] rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold">{ev.evidence_id}</span> ({ev.evidence_type})
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      SHA256: {ev.checksum_sha256.substring(0, 16)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Incident Timeline */}
          <div className="bg-[#090d16] p-4 rounded-xl border border-[#1e293b] space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Chronological Incident Timeline & Audit Trail
            </h4>

            <div className="space-y-2 font-mono text-xs">
              {incident.timeline.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 bg-[#111a2e]/60 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 font-bold text-[11px]">{entry.action}</span>
                      <span className="text-[10px] text-slate-500">by {entry.actor}</span>
                    </div>
                    {entry.notes && <p className="text-slate-300 text-[11px]">{entry.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
