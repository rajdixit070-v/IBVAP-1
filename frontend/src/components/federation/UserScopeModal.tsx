import React, { useState } from 'react';
import { X, UserCheck, Save } from 'lucide-react';
import { Site, BOP } from '../../types/federation';

interface UserScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scopeData: {
    username: string;
    scope_type: 'GLOBAL' | 'REGION' | 'SITE' | 'BOP';
    scope_id: string;
    role: string;
  }) => Promise<void>;
  sites: Site[];
  bops: BOP[];
}

export const UserScopeModal: React.FC<UserScopeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  sites,
  bops
}) => {
  const [username, setUsername] = useState('');
  const [scopeType, setScopeType] = useState<'GLOBAL' | 'REGION' | 'SITE' | 'BOP'>('SITE');
  const [scopeId, setScopeId] = useState('');
  const [role, setRole] = useState('SITE_ADMIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }

    let finalScopeId = scopeId;
    if (scopeType === 'GLOBAL') {
      finalScopeId = '*';
    } else if (scopeType === 'REGION') {
      finalScopeId = 'REG-NORTH';
    } else if (!finalScopeId) {
      if (scopeType === 'SITE') finalScopeId = sites[0]?.site_id || 'SITE-BORDER-NORTH';
      if (scopeType === 'BOP') finalScopeId = bops[0]?.bop_id || 'BOP-ALPHA';
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        username: username.trim(),
        scope_type: scopeType,
        scope_id: finalScopeId,
        role
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to assign user scope.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/60">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Assign Scoped Access
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Dynamic Multi-Site Authorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Target Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              placeholder="e.g. operator_north, sub_commander_b1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Scope Level</label>
              <select
                value={scopeType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setScopeType(val);
                  if (val === 'SITE') setScopeId(sites[0]?.site_id || '');
                  if (val === 'BOP') setScopeId(bops[0]?.bop_id || '');
                }}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              >
                <option value="SITE">SITE (Border Command)</option>
                <option value="BOP">BOP (Border Outpost)</option>
                <option value="REGION">REGION (Theater)</option>
                <option value="GLOBAL">GLOBAL (Unrestricted)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Role / Privilege</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              >
                <option value="SITE_ADMIN">SITE_ADMIN</option>
                <option value="BOP_OPERATOR">BOP_OPERATOR</option>
                <option value="ANALYST">ANALYST (Read-Only)</option>
                <option value="REGIONAL_ADMIN">REGIONAL_ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
          </div>

          {scopeType === 'SITE' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Assigned Site</label>
              <select
                value={scopeId || sites[0]?.site_id}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              >
                {sites.map((s) => (
                  <option key={s.site_id} value={s.site_id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {scopeType === 'BOP' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Assigned BOP</label>
              <select
                value={scopeId || bops[0]?.bop_id}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              >
                {bops.map((b) => (
                  <option key={b.bop_id} value={b.bop_id}>
                    {b.name} ({b.code}) — {b.site_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Assigning...' : 'Assign Scope'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
