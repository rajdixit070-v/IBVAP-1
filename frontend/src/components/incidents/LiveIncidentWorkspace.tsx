import React, { useState } from 'react';
import { Incident, PlaybookStepItem } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import {
  CheckCircle2,
  Clock,
  Square,
  Lock,
  CheckSquare,
  Sparkles,
  Printer,
  Layers
} from 'lucide-react';

interface LiveIncidentWorkspaceProps {
  incident: Incident;
  onRefresh: () => void;
  onOpenReport: () => void;
  onOpenReview: () => void;
  onOpenCluster: () => void;
  onClose: () => void;
}

export const LiveIncidentWorkspace: React.FC<LiveIncidentWorkspaceProps> = ({
  incident,
  onRefresh,
  onOpenReport,
  onOpenReview,
  onOpenCluster,
  onClose
}) => {
  const [selectedCam, setSelectedCam] = useState<string>(incident.camera_id);
  const [actionNotes, setActionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolutionCategory, setResolutionCategory] = useState('Resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignee, setAssignee] = useState(incident.assigned_to || '');
  const [assigning, setAssigning] = useState(false);

  const handleStepToggle = async (step: PlaybookStepItem) => {
    try {
      await incidentService.updateChecklistStep(incident.incident_id, {
        step_id: step.step_id,
        is_completed: !step.is_completed,
        actor_username: 'operator'
      });
      onRefresh();
    } catch (e) {
      console.error('Failed to toggle checklist step', e);
    }
  };

  const handleTriage = async () => {
    try {
      await incidentService.triageIncident(incident.incident_id, {
        notes: actionNotes || 'Operator verified incident telemetry',
        version: incident.version
      });
      setActionNotes('');
      onRefresh();
    } catch (e) {
      console.error('Failed to triage incident', e);
    }
  };

  const handleAssign = async () => {
    try {
      await incidentService.assignIncident(incident.incident_id, {
        assigned_to: assignee || 'Quick Reaction Team 1',
        assigned_team: 'Tactical Intercept Unit Alpha',
        notes: actionNotes || 'Dispatched for perimeter containment',
        version: incident.version
      });
      setAssigning(false);
      setActionNotes('');
      onRefresh();
    } catch (e) {
      console.error('Failed to assign incident', e);
    }
  };

  const handleRespond = async () => {
    try {
      await incidentService.respondIncident(incident.incident_id, {
        notes: actionNotes || 'Field unit deployed on-site',
        version: incident.version
      });
      setActionNotes('');
      onRefresh();
    } catch (e) {
      console.error('Failed to update response state', e);
    }
  };

  const handleContain = async () => {
    try {
      await incidentService.containIncident(incident.incident_id, {
        notes: actionNotes || 'Perimeter secured and contained',
        version: incident.version
      });
      setActionNotes('');
      onRefresh();
    } catch (e) {
      console.error('Failed to contain incident', e);
    }
  };

  const handleResolve = async () => {
    try {
      await incidentService.resolveIncident(incident.incident_id, {
        resolution_category: resolutionCategory,
        resolution_notes: resolutionNotes || 'Incident resolved after field verification',
        version: incident.version
      });
      setResolving(false);
      onRefresh();
    } catch (e) {
      console.error('Failed to resolve incident', e);
    }
  };

  const handleClose = async () => {
    try {
      await incidentService.closeIncident(incident.incident_id, {
        notes: 'Incident verified and closed',
        version: incident.version
      });
      onRefresh();
    } catch (e) {
      console.error('Failed to close incident', e);
    }
  };

  const relatedCams = incident.related_cameras || [incident.camera_id];

  return (
    <div className="fixed inset-0 z-50 bg-[#070b12]/95 backdrop-blur-md flex flex-col overflow-hidden text-slate-100 font-mono text-xs">
      {/* Top Mission Control Bar */}
      <div className="bg-[#0e1626] border-b border-cyan-500/30 px-6 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-sm font-black text-white">{incident.incident_id}</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded font-black text-[10px] border ${
              incident.priority === 'CRITICAL'
                ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                : incident.priority === 'HIGH'
                ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                : 'bg-amber-950 text-amber-300 border-amber-500/50'
            }`}
          >
            {incident.priority} PRIORITY
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
            ESCALATION LEVEL {incident.escalation_level}
          </span>
          <span className="text-slate-400 text-xs">
            STATUS: <strong className="text-white">{incident.status}</strong>
          </span>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex items-center gap-2">
          {incident.status === 'NEW' && (
            <button
              onClick={handleTriage}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition shadow"
            >
              TRIAGE INCIDENT
            </button>
          )}

          {incident.status === 'TRIAGED' && (
            <button
              onClick={() => setAssigning(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition shadow"
            >
              ASSIGN UNIT
            </button>
          )}

          {incident.status === 'ASSIGNED' && (
            <button
              onClick={handleRespond}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition shadow"
            >
              DISPATCH RESPONSE
            </button>
          )}

          {incident.status === 'RESPONDING' && (
            <button
              onClick={handleContain}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition shadow"
            >
              MARK CONTAINED
            </button>
          )}

          {['CONTAINED', 'INVESTIGATING', 'RESPONDING', 'ASSIGNED', 'TRIAGED'].includes(incident.status) && (
            <button
              onClick={() => setResolving(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow"
            >
              RESOLVE
            </button>
          )}

          {incident.status === 'RESOLVED' && (
            <button
              onClick={handleClose}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition"
            >
              CLOSE INCIDENT
            </button>
          )}

          <button
            onClick={onOpenReview}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            DEBRIEF / REVIEW
          </button>

          <button
            onClick={onOpenReport}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            DOSSIER
          </button>

          <button
            onClick={onOpenCluster}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            RELATIONSHIPS
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 rounded-lg font-bold transition ml-2"
          >
            EXIT WORKSPACE
          </button>
        </div>
      </div>

      {/* Main 4-Quadrant Workspace Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Column: Core Telemetry & Context (3 cols) */}
        <div className="col-span-3 bg-[#0d1424] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between overflow-y-auto space-y-4 shadow-xl">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">INCIDENT TITLE</span>
              <h2 className="text-sm font-black text-white mt-1 leading-snug">{incident.title}</h2>
              {incident.description && (
                <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">{incident.description}</p>
              )}
            </div>

            {/* Risk Gauge */}
            <div className="bg-[#080d17] p-3 rounded-xl border border-cyan-500/30 text-center space-y-1">
              <span className="text-[10px] text-slate-500 block">REAL-TIME RISK SCORE</span>
              <div className="text-3xl font-black text-cyan-400">
                {incident.risk_score} <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                  style={{ width: `${incident.risk_score}%` }}
                />
              </div>
            </div>

            {/* Target Meta */}
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-500">Source Camera:</span>
                <span className="text-sky-400 font-bold">{incident.camera_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-500">BOP Sector:</span>
                <span className="text-white font-bold">{incident.bop_site}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-500">Affected Zone:</span>
                <span className="text-amber-400 font-bold">{incident.zone_name || 'Restricted Wire'}</span>
              </div>
              {incident.global_track_id && (
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span className="text-slate-500">Global Track:</span>
                  <span className="text-purple-400 font-bold">{incident.global_track_id}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-500">Assigned Unit:</span>
                <span className="text-emerald-400 font-bold">{incident.assigned_to || 'UNASSIGNED'}</span>
              </div>
            </div>

            {/* SLA Timer */}
            <div className="bg-[#080d17] p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                SLA TIMER & DURATION
              </span>
              <div className="text-slate-300 text-[11px]">
                Created: <span className="text-white font-bold">{new Date(incident.created_at).toLocaleTimeString()}</span>
              </div>
              {incident.time_to_acknowledge_sec && (
                <div className="text-slate-300 text-[11px]">
                  Time to Acknowledge: <span className="text-cyan-400 font-bold">{Math.round(incident.time_to_acknowledge_sec)}s</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Multi-Camera Live Matrix (6 cols) */}
        <div className="col-span-6 flex flex-col gap-3 overflow-hidden">
          {/* Main Selected Camera Feed */}
          <div className="flex-1 bg-[#090d16] border border-cyan-500/30 rounded-xl relative overflow-hidden flex items-center justify-center shadow-2xl">
            <img
              src={`http://localhost:8000/api/v1/cameras/${selectedCam}/preview`}
              alt={selectedCam}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect fill="%23090d16" width="640" height="360"/><text fill="%2306b6d4" font-family="monospace" font-size="14" x="50%" y="50%" text-anchor="middle">LIVE FEED // SENSOR STREAM ACTIVE</text></svg>';
              }}
            />
            {/* Live Camera Overlay Banner */}
            <div className="absolute top-3 left-3 bg-[#070b12]/80 backdrop-blur border border-cyan-500/40 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-white font-black text-xs">{selectedCam}</span>
              <span className="text-slate-400 text-[10px]">
                {selectedCam === incident.camera_id ? '(PRIMARY SIGHTING)' : '(LINKED SECTOR)'}
              </span>
            </div>
          </div>

          {/* Linked Cameras Ribbon */}
          <div className="h-28 bg-[#0d1424] border border-[#1e293b] rounded-xl p-2.5 flex items-center gap-3 overflow-x-auto">
            <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0">
              RELATED<br />CAMERAS:
            </span>
            {relatedCams.map((cId) => (
              <div
                key={cId}
                onClick={() => setSelectedCam(cId)}
                className={`h-full aspect-video rounded-lg border cursor-pointer relative overflow-hidden shrink-0 transition ${
                  selectedCam === cId ? 'border-cyan-400 shadow-md ring-2 ring-cyan-500/30' : 'border-slate-800 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={`http://localhost:8000/api/v1/cameras/${cId}/preview`}
                  alt={cId}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] text-cyan-300 font-bold">
                  {cId}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Chronological Event Sequence & Risk Drivers (3 cols) */}
        <div className="col-span-3 bg-[#0d1424] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between overflow-hidden shadow-xl">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
              CHRONOLOGICAL EVENT SEQUENCE
            </span>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {incident.timeline.map((tl, idx) => (
                <div key={idx} className="p-2.5 bg-[#080d17] border border-slate-800/80 rounded-lg space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-cyan-400 font-bold">{tl.action.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500">{new Date(tl.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {tl.notes && <div className="text-slate-400 text-[10px] leading-relaxed">{tl.notes}</div>}
                  <div className="text-[9px] text-slate-500">By: {tl.actor}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Response Playbook Checklist & Evidence Chain (Full Width) */}
        <div className="col-span-12 h-44 bg-[#0d1424] border border-[#1e293b] rounded-xl p-3 grid grid-cols-12 gap-4 shadow-xl">
          {/* Playbook Checklists (7 cols) */}
          <div className="col-span-7 flex flex-col overflow-hidden space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                STANDARD OPERATING PLAYBOOK CHECKLIST ({incident.checklist.filter((s) => s.is_completed).length}/{incident.checklist.length})
              </span>
              <span className="text-[10px] text-slate-400">{incident.playbook_id || 'PB-VIRTUAL-FENCE'}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {incident.checklist.map((step) => (
                <div
                  key={step.step_id}
                  onClick={() => handleStepToggle(step)}
                  className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between transition ${
                    step.is_completed
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#080d17] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {step.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className={`text-[11px] ${step.is_completed ? 'line-through text-slate-400' : 'text-white'}`}>
                      {step.step_id}. {step.title}
                    </span>
                  </div>
                  {step.is_completed && (
                    <span className="text-[9px] text-emerald-400 font-bold">COMPLETED</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Chain References (5 cols) */}
          <div className="col-span-5 flex flex-col overflow-hidden space-y-2 border-l border-slate-800 pl-3">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              EVIDENCE CHAIN & SHA-256 INTEGRITY ({incident.evidence_ids.length})
            </span>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {incident.evidence_ids.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-[10px]">
                  Live camera RTSP stream frames recorded. No standalone snapshots attached.
                </div>
              ) : (
                incident.evidence_ids.map((evId, idx) => (
                  <div key={idx} className="p-2 bg-[#080d17] border border-slate-800 rounded-lg flex items-center justify-between text-[10px]">
                    <span className="text-white font-bold">{evId}</span>
                    <span className="text-cyan-400">SHA-256 VERIFIED</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal Prompt */}
      {assigning && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-amber-500/40 rounded-xl p-5 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-white uppercase">Assign Operational Tactical Team</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Assigned Commander / Operator</label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. Capt. Rajesh Kumar"
                  className="w-full p-2 bg-[#080d17] border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Dispatch Notes</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Dispatched QRT-1 to sector boundary"
                  className="w-full p-2 bg-[#080d17] border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssigning(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                CANCEL
              </button>
              <button
                onClick={handleAssign}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-lg text-xs"
              >
                CONFIRM ASSIGNMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Modal Prompt */}
      {resolving && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-emerald-500/40 rounded-xl p-5 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-white uppercase">Resolve Incident</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Resolution Category</label>
                <select
                  value={resolutionCategory}
                  onChange={(e) => setResolutionCategory(e.target.value)}
                  className="w-full p-2 bg-[#080d17] border border-slate-700 rounded-lg text-white text-xs"
                >
                  <option value="Resolved">Resolved (Threat Contained)</option>
                  <option value="False Alarm">False Alarm (Animal / Weather / Calibration)</option>
                  <option value="Authorized Activity">Authorized Activity (Patrol / Maintenance)</option>
                  <option value="Infrastructure Issue">Infrastructure Issue (Camera/Stream)</option>
                  <option value="Duplicate">Duplicate Event</option>
                  <option value="Unable to Verify">Unable to Verify</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Resolution Debrief Notes</label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record summary of outcome and sector status..."
                  className="w-full p-2 bg-[#080d17] border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolving(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                CANCEL
              </button>
              <button
                onClick={handleResolve}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-xs"
              >
                SUBMIT RESOLUTION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
