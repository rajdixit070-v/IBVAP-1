import React, { useState, useEffect } from 'react';
import { X, UserCheck, Save, Users, AlertCircle, Shield } from 'lucide-react';
import { Site, BOP } from '../../types/federation';
import { userService, Officer } from '../../services/userService';

interface UserScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scopeData: {
    username: string;
    scope_type: 'GLOBAL' | 'SITE' | 'BOP';
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
  const [userSelectMode, setUserSelectMode] = useState<'select' | 'custom'>('select');
  const [availableOfficers, setAvailableOfficers] = useState<Officer[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);

  const [scopeType, setScopeType] = useState<'GLOBAL' | 'SITE' | 'BOP'>('BOP');
  const [scopeId, setScopeId] = useState('');
  const [role, setRole] = useState('OFFICER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing registered officers/users on modal open
  useEffect(() => {
    if (isOpen) {
      setLoadingOfficers(true);
      userService.listOfficers()
        .then((officers) => {
          setAvailableOfficers(officers);
          if (officers.length > 0) {
            setUserSelectMode('select');
            setUsername(officers[0].username);
          } else {
            setUserSelectMode('custom');
          }
        })
        .catch(() => {
          setUserSelectMode('custom');
        })
        .finally(() => {
          setLoadingOfficers(false);
        });

      // Default scope selection based on available entities
      if (bops.length > 0) {
        setScopeType('BOP');
        setScopeId(bops[0].bop_id);
      } else if (sites.length > 0) {
        setScopeType('SITE');
        setScopeId(sites[0].site_id);
      } else {
        setScopeType('GLOBAL');
        setScopeId('*');
      }
      setError(null);
    }
  }, [isOpen, sites, bops]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Target Username is required.');
      return;
    }

    let finalScopeId = scopeId;
    if (scopeType === 'GLOBAL') {
      finalScopeId = '*';
    } else if (scopeType === 'SITE') {
      if (!sites.length) {
        setError('No tactical sites available to assign. Please provision a site first.');
        return;
      }
      if (!finalScopeId) finalScopeId = sites[0].site_id;
    } else if (scopeType === 'BOP') {
      if (!bops.length) {
        setError('No border outposts (BOPs) available to assign. Please provision a BOP first.');
        return;
      }
      if (!finalScopeId) finalScopeId = bops[0].bop_id;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        username: cleanUsername,
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

  const isScopeEntityMissing =
    (scopeType === 'SITE' && sites.length === 0) ||
    (scopeType === 'BOP' && bops.length === 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
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
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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

          {/* User Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" /> Target User / Officer *
              </label>
              {availableOfficers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (userSelectMode === 'select') {
                      setUserSelectMode('custom');
                      setUsername('');
                    } else {
                      setUserSelectMode('select');
                      setUsername(availableOfficers[0]?.username || '');
                    }
                  }}
                  className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  {userSelectMode === 'select' ? 'Enter Custom Username' : 'Pick Registered Officer'}
                </button>
              )}
            </div>

            {userSelectMode === 'select' && availableOfficers.length > 0 ? (
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {availableOfficers.map((o) => (
                  <option key={o.id} value={o.username}>
                    {o.username} — {o.role} ({o.post_name || o.scope_id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                placeholder={loadingOfficers ? "Loading officers..." : "e.g. officer_jammu, operator_alpha"}
              />
            )}
          </div>

          {/* Scope Level & Role in 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 font-bold">
                Duty Scope Level *
              </label>
              <select
                value={scopeType}
                onChange={(e) => {
                  const val = e.target.value as 'GLOBAL' | 'SITE' | 'BOP';
                  setScopeType(val);
                  if (val === 'BOP') setScopeId(bops[0]?.bop_id || '');
                  if (val === 'SITE') setScopeId(sites[0]?.site_id || '');
                  if (val === 'GLOBAL') setScopeId('*');
                }}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="BOP">BOP (Border Outpost)</option>
                <option value="SITE">SITE (Border Command)</option>
                <option value="GLOBAL">GLOBAL (HQ All Sectors)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 font-bold">
                Operational Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="OFFICER">OFFICER (Checkpost Duty)</option>
                <option value="COMMANDER">COMMANDER (BOP / Sector Head)</option>
                <option value="BOP_OPERATOR">BOP_OPERATOR (Camera Monitor)</option>
                <option value="OPERATOR">OPERATOR (Triage & ANPR)</option>
                <option value="ADMIN">ADMIN (Central HQ Authority)</option>
                <option value="VIEWER">VIEWER (Read-Only Observer)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Post Assignment based on Scope */}
          {scopeType === 'BOP' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 font-bold">
                Assigned Border Outpost (BOP) *
              </label>
              {bops.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>No Border Outposts (BOPs) provisioned yet. Use <strong>"+ Provision BOP"</strong> to create one first.</span>
                </div>
              ) : (
                <select
                  value={scopeId || bops[0]?.bop_id}
                  onChange={(e) => setScopeId(e.target.value)}
                  className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {bops.map((b) => (
                    <option key={b.bop_id} value={b.bop_id}>
                      {b.name} ({b.code}) — Site: {b.site_id}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {scopeType === 'SITE' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 font-bold">
                Assigned Tactical Site *
              </label>
              {sites.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>No Tactical Sites provisioned yet. Use <strong>"+ Provision Site"</strong> to create one first.</span>
                </div>
              ) : (
                <select
                  value={scopeId || sites[0]?.site_id}
                  onChange={(e) => setScopeId(e.target.value)}
                  className="w-full bg-[#111a2e] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {sites.map((s) => (
                    <option key={s.site_id} value={s.site_id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {scopeType === 'GLOBAL' && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs font-mono text-indigo-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Scope ID: <strong>* (All National Sectors / Central HQ Command)</strong></span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isScopeEntityMissing}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
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
