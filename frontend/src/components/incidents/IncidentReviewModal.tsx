import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Incident } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { Sliders, CheckCircle } from 'lucide-react';

interface IncidentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  onUpdated: () => void;
}

export const IncidentReviewModal: React.FC<IncidentReviewModalProps> = ({
  isOpen,
  onClose,
  incident,
  onUpdated
}) => {
  const [outcome, setOutcome] = useState<'TRUE_EVENT' | 'FALSE_ALARM' | 'ENVIRONMENTAL' | 'INFRASTRUCTURE' | 'AUTHORIZED_ACTIVITY' | 'UNKNOWN'>('TRUE_EVENT');
  const [rootCause, setRootCause] = useState('');
  const [preventative, setPreventative] = useState('');
  const [calibration, setCalibration] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!incident) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await incidentService.recordReview(incident.incident_id, {
        outcome_category: outcome,
        root_cause: rootCause,
        preventative_actions: preventative,
        calibration_recommended: calibration,
        operator_username: 'operator'
      });
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to submit post-incident review', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Post-Incident Learning & Debrief // ${incident.incident_id}`}
      subtitle="Structured outcome categorization and AI calibration feedback loop"
      maxWidth="2xl"
    >
      <div className="space-y-4 font-mono text-xs">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">What happened? (Outcome Category)</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as any)}
            className="w-full p-2.5 bg-[#090d16] border border-slate-700 rounded-lg text-white font-bold"
          >
            <option value="TRUE_EVENT">Confirmed Security Intrusion / Anomaly</option>
            <option value="FALSE_ALARM">False Alarm (Motion Spurious)</option>
            <option value="ENVIRONMENTAL">Environmental (Weather, Shadows, Foliage, Wildlife)</option>
            <option value="INFRASTRUCTURE">Infrastructure Failure (Stream drop, low bandwidth)</option>
            <option value="AUTHORIZED_ACTIVITY">Authorized Activity (Patrols, Contractors)</option>
            <option value="UNKNOWN">Inconclusive / Unknown</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Root Cause Analysis</label>
          <textarea
            rows={3}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder="Describe what triggered the event and field verification findings..."
            className="w-full p-2.5 bg-[#090d16] border border-slate-700 rounded-lg text-white"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Recommended Preventative Actions / Notes</label>
          <textarea
            rows={2}
            value={preventative}
            onChange={(e) => setPreventative(e.target.value)}
            placeholder="e.g. Schedule perimeter lighting maintenance, trim tree branches..."
            className="w-full p-2.5 bg-[#090d16] border border-slate-700 rounded-lg text-white"
          />
        </div>

        <div className="p-3 bg-[#111a2e] border border-cyan-500/30 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-white font-bold text-xs flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Recommend Camera AI Calibration Review
            </span>
            <span className="text-slate-400 text-[10px] block">
              Flags camera {incident.camera_id} for sensitivity fine-tuning without modifying thresholds automatically.
            </span>
          </div>
          <input
            type="checkbox"
            checked={calibration}
            onChange={(e) => setCalibration(e.target.checked)}
            className="w-4 h-4 rounded text-cyan-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg text-xs transition shadow-lg flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            SUBMIT POST-INCIDENT REVIEW
          </button>
        </div>
      </div>
    </Modal>
  );
};
