import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { userService, Officer } from '../../services/userService';
import { MapPin, Shield, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ReassignPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  officer: Officer | null;
  onSuccess: () => void;
}

const POST_OPTIONS = [
  { id: 'BOP-ALPHA', name: 'BOP Alpha (Sector 4 - Jammu Front)', type: 'BOP' },
  { id: 'BOP-BRAVO', name: 'BOP Bravo (Sector 7 - Samba Ridge)', type: 'BOP' },
  { id: 'BOP-CHARLIE', name: 'BOP Charlie (Sector 2 - Kathua Riverine)', type: 'BOP' },
  { id: 'BOP-DELTA', name: 'BOP Delta (Sector 9 - Akhnoor Desert)', type: 'BOP' },
  { id: 'SITE-BORDER-NORTH', name: 'Site Border North (Central Sector HQ)', type: 'SITE' },
  { id: '*', name: 'All National Sectors (Headquarters Central)', type: 'GLOBAL' }
];

export const ReassignPostModal: React.FC<ReassignPostModalProps> = ({
  isOpen,
  onClose,
  officer,
  onSuccess
}) => {
  const [selectedPostId, setSelectedPostId] = useState(officer?.scope_id || 'BOP-ALPHA');
  const [selectedRole, setSelectedRole] = useState(officer?.role || 'OFFICER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!officer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const postMatch = POST_OPTIONS.find((p) => p.id === selectedPostId);
      await userService.updateOfficer(officer.id, {
        post_scope_id: selectedPostId,
        post_scope_type: postMatch?.type || 'BOP',
        role: selectedRole
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reassign post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`REASSIGN DUTY POST // OFFICER: ${officer.username.toUpperCase()}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
        <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px]">Current Duty Assignment:</div>
          <div className="text-white font-bold text-sm">{officer.post_name} ({officer.scope_id})</div>
          <div className="text-emerald-400 text-[11px]">Role: {officer.role}</div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-slate-300 font-bold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Transfer to New Border Outpost / Post
          </label>
          <select
            value={selectedPostId}
            onChange={(e) => setSelectedPostId(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
          >
            {POST_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-300 font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            Updated Rank / Role at New Post
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono"
          >
            <option value="OFFICER">OFFICER (Checkpost Duty)</option>
            <option value="COMMANDER">COMMANDER (BOP Head)</option>
            <option value="BOP_OPERATOR">BOP_OPERATOR (Camera Monitor)</option>
            <option value="OPERATOR">OPERATOR (Triage & ANPR)</option>
            <option value="ADMIN">ADMIN (Central HQ Supreme Authority)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {saving ? 'Transferring...' : 'Confirm Post Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
