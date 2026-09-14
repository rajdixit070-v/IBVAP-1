import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { userService, Officer } from '../../services/userService';
import { federationService } from '../../services/federationService';
import { MapPin, Shield, AlertTriangle, ShieldCheck, Globe } from 'lucide-react';
import { CheckpostSearchSelect } from '../common/CheckpostSearchSelect';
import { SectorSearchSelect } from '../common/SectorSearchSelect';
import { COMPREHENSIVE_CHECKPOSTS, CheckpostItem } from '../../constants/checkposts';

interface ReassignPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  officer: Officer | null;
  onSuccess: () => void;
}

export const ReassignPostModal: React.FC<ReassignPostModalProps> = ({
  isOpen,
  onClose,
  officer,
  onSuccess
}) => {
  const [checkpostOptions, setCheckpostOptions] = useState<CheckpostItem[]>(COMPREHENSIVE_CHECKPOSTS);
  const [selectedPostId, setSelectedPostId] = useState(officer?.scope_id || 'BOP-WAGAH');
  const [selectedRole, setSelectedRole] = useState(officer?.role || 'COMMANDER');
  const [selectedSector, setSelectedSector] = useState(officer?.sector || 'Punjab Frontier');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      federationService.listBOPs().catch(() => []).then((bops) => {
        const checkpostMap = new Map<string, CheckpostItem>();
        COMPREHENSIVE_CHECKPOSTS.forEach(cp => checkpostMap.set(cp.id, cp));
        bops.forEach(b => {
          const existing = checkpostMap.get(b.bop_id);
          checkpostMap.set(b.bop_id, {
            id: b.bop_id,
            name: b.name,
            code: b.code || b.bop_id,
            sector: b.location || existing?.sector || 'Punjab Frontier',
            state: existing?.state || 'India',
            type: 'BOP'
          });
        });
        const opts = Array.from(checkpostMap.values());
        setCheckpostOptions(opts);
      });

      if (officer) {
        setSelectedPostId(officer.scope_id || (officer.role === 'ADMIN' ? '*' : 'BOP-WAGAH'));
        setSelectedRole(officer.role || 'COMMANDER');
        setSelectedSector(officer.sector || 'Punjab Frontier');
      }
      setError(null);
    }
  }, [isOpen, officer]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    checkpostOptions.forEach((cp) => {
      if (cp.sector) set.add(cp.sector);
    });
    return Array.from(set);
  }, [checkpostOptions]);

  if (!officer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const postType = selectedRole === 'ADMIN' ? 'GLOBAL' : 'BOP';
      const finalPostId = selectedRole === 'ADMIN' ? '*' : selectedPostId;
      await userService.updateOfficer(officer.id, {
        post_scope_id: finalPostId,
        post_scope_type: postType,
        role: selectedRole,
        sector: selectedRole === 'ADMIN' ? 'All Border Sectors (National HQ)' : selectedSector
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      let msg = 'Failed to update assignment.';
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`REASSIGN JURISDICTION // PERSONNEL: ${officer.username.toUpperCase()}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
        <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px]">Current Duty Assignment:</div>
          <div className="text-white font-bold text-sm">{officer.post_name} ({officer.scope_id})</div>
          <div className="text-emerald-400 text-[11px]">Current Role: {officer.role} • Sector: {officer.sector || 'Punjab Frontier'}</div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Assignment: Checkpost for Commander, HQ Station for Admin */}
        {selectedRole === 'ADMIN' ? (
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-rose-400" />
              HQ Jurisdiction / Command Station *
            </label>
            <select
              value={selectedPostId}
              onChange={(e) => setSelectedPostId(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono cursor-pointer"
            >
              <option value="*">Delhi Central HQ (National Command Central - All Sectors)</option>
              <option value="HQ-DELHI">Delhi Central Operations Room (HQ-DELHI)</option>
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Checkpost *
            </label>
            <CheckpostSearchSelect
              value={selectedPostId}
              availableCheckposts={checkpostOptions}
              onChange={(selectedPost) => {
                setSelectedPostId(selectedPost.id);
                if (selectedPost.sector) {
                  setSelectedSector(selectedPost.sector);
                }
              }}
            />
          </div>
        )}

        {/* Sector Selection for Commander */}
        {selectedRole === 'COMMANDER' && (
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Border Sector / State Zone *
              </span>
              <span className="text-[10px] text-cyan-400 font-normal">Search existing or type custom directly</span>
            </label>
            <SectorSearchSelect
              value={selectedSector}
              onChange={(sec) => setSelectedSector(sec)}
              placeholder="Search sector or type custom zone..."
              availableSectors={availableSectors}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-slate-300 font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            Operational Role / Rank *
          </label>
          <select
            value={selectedRole}
            onChange={(e) => {
              const newRole = e.target.value;
              setSelectedRole(newRole);
              if (newRole === 'ADMIN') {
                setSelectedPostId('*');
              } else if (selectedPostId === '*' || selectedPostId === 'HQ-DELHI') {
                setSelectedPostId(checkpostOptions[0]?.id || 'BOP-WAGAH');
              }
            }}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono cursor-pointer"
          >
            <option value="COMMANDER">COMMANDER (Checkpost Head / BOP In-Charge)</option>
            <option value="ADMIN">ADMIN (Central HQ Administrator)</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {saving ? 'Transferring...' : 'Confirm Assignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
