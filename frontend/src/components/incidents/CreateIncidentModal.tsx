import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { IncidentCreate, IncidentPriority, Alert } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { useCameras } from '../../context/CameraContext';
import { Camera } from '../../types/camera';
import { Save } from 'lucide-react';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceAlert?: Alert | null;
  onSuccess: () => void;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  isOpen,
  onClose,
  sourceAlert,
  onSuccess
}) => {
  const { cameras } = useCameras();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IncidentPriority>('HIGH');
  const [cameraId, setCameraId] = useState('CAM-001');
  const [bopSite, setBopSite] = useState('BOP Alpha');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedUnit, setAssignedUnit] = useState('Quick Reaction Team (QRT-1)');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sourceAlert) {
      setTitle(sourceAlert.title);
      setDescription(`Created from security alert ${sourceAlert.alert_id} (Risk Score: ${sourceAlert.risk_score})`);
      setPriority(sourceAlert.priority);
      setCameraId(sourceAlert.camera_id);
      setBopSite(sourceAlert.bop_site);
    } else {
      setTitle('');
      setDescription('');
      setPriority('HIGH');
      if (cameras.length > 0) setCameraId(cameras[0].camera_id);
      setBopSite('BOP Alpha');
      setAssignedTo('');
    }
  }, [sourceAlert, isOpen, cameras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an incident title.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: IncidentCreate = {
        title,
        description,
        priority,
        source_event_id: sourceAlert?.event_id,
        camera_id: cameraId,
        bop_site: bopSite,
        risk_score: sourceAlert?.risk_score || 50,
        assigned_to: assignedTo || undefined,
        assigned_unit: assignedUnit || undefined
      };

      await incidentService.createIncident(payload);
      if (sourceAlert) {
        await incidentService.acknowledgeAlert(sourceAlert.alert_id, 'operator');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create incident.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sourceAlert ? `Convert Alert to Incident // ${sourceAlert.alert_id}` : 'Create New Security Incident'}
      subtitle="Escalate tactical event into managed operational incident workflow"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Incident Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Critical Wire Infiltration near Tower Alpha-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IncidentPriority)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-mono font-bold"
            >
              <option value="CRITICAL">🔴 CRITICAL</option>
              <option value="HIGH">🟠 HIGH</option>
              <option value="MEDIUM">🟡 MEDIUM</option>
              <option value="LOW">🟢 LOW</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Source Camera</label>
            <select
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              {cameras.map((c: Camera) => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_id} ({c.camera_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">BOP Site</label>
            <input
              type="text"
              value={bopSite}
              onChange={(e) => setBopSite(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Brief & Context</label>
          <textarea
            rows={3}
            placeholder="Operational briefing, target direction, or observed threat context..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Operator (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Duty Officer Sharma"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Tactical Unit</label>
            <input
              type="text"
              value={assignedUnit}
              onChange={(e) => setAssignedUnit(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20 disabled:opacity-50 font-mono font-bold"
          >
            <Save className="w-4 h-4" />
            {loading ? 'CREATING...' : 'CREATE INCIDENT DOSSIER'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
