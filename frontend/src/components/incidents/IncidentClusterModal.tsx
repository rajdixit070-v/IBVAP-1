import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { incidentService } from '../../services/incidentService';
import { Link as LinkIcon } from 'lucide-react';

interface IncidentClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIncidentId: string;
  onUpdated: () => void;
}

export const IncidentClusterModal: React.FC<IncidentClusterModalProps> = ({
  isOpen,
  onClose,
  currentIncidentId,
  onUpdated
}) => {
  const [targetIncidentId, setTargetIncidentId] = useState('');
  const [relationshipType, setRelationshipType] = useState('PARENT_CHILD');
  const [submitting, setSubmitting] = useState(false);

  const handleLink = async () => {
    if (!targetIncidentId.trim()) return;
    setSubmitting(true);
    try {
      await incidentService.linkIncidents({
        parent_id: currentIncidentId,
        child_id: targetIncidentId.trim(),
        relationship_type: relationshipType
      });
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to link incidents', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Incident Clustering & Hierarchical Linking"
      subtitle={`Link ${currentIncidentId} with correlated sector or vehicle incidents`}
      maxWidth="md"
    >
      <div className="space-y-4 font-mono text-xs">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Target Incident ID to Link</label>
          <input
            type="text"
            value={targetIncidentId}
            onChange={(e) => setTargetIncidentId(e.target.value)}
            placeholder="e.g. INC-2026-000102"
            className="w-full p-2.5 bg-[#090d16] border border-slate-700 rounded-lg text-white font-bold"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Relationship Type</label>
          <select
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            className="w-full p-2.5 bg-[#090d16] border border-slate-700 rounded-lg text-white font-bold"
          >
            <option value="PARENT_CHILD">Parent-Child (Master Incident with sub-events)</option>
            <option value="RELATED">Related (Concurrent sector activity)</option>
            <option value="CLUSTER">Cluster (Spatial/temporal swarm)</option>
          </select>
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
            onClick={handleLink}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-lg text-xs transition shadow"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            LINK INCIDENTS
          </button>
        </div>
      </div>
    </Modal>
  );
};
