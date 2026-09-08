import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { userService, OfficerCreate, Officer } from '../../services/userService';
import {
  Shield,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  MapPin,
  UserCheck,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

import { federationService } from '../../services/federationService';

interface RegisterOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterOfficerModal: React.FC<RegisterOfficerModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [postOptions, setPostOptions] = useState<{ id: string; name: string; type: string }[]>([
    { id: '*', name: 'All National Sectors (Headquarters Central)', type: 'GLOBAL' }
  ]);

  const [formData, setFormData] = useState<OfficerCreate>({
    username: '',
    email: '',
    password: '',
    role: 'OFFICER',
    post_scope_id: '*',
    post_scope_type: 'GLOBAL',
    full_name: ''
  });

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        federationService.listSites().catch(() => []),
        federationService.listBOPs().catch(() => [])
      ]).then(([sites, bops]) => {
        const opts: { id: string; name: string; type: string }[] = [
          { id: '*', name: 'All National Sectors (Headquarters Central)', type: 'GLOBAL' }
        ];
        sites.forEach((s) => {
          opts.push({ id: s.site_id, name: `${s.name} (${s.code}) [Site Command]`, type: 'SITE' });
        });
        bops.forEach((b) => {
          opts.push({ id: b.bop_id, name: `${b.name} (${b.code}) [Outpost]`, type: 'BOP' });
        });
        setPostOptions(opts);
        if (bops.length > 0) {
          setFormData((prev) => ({ ...prev, post_scope_id: bops[0].bop_id, post_scope_type: 'BOP' }));
        } else if (sites.length > 0) {
          setFormData((prev) => ({ ...prev, post_scope_id: sites[0].site_id, post_scope_type: 'SITE' }));
        }
      });
    }
  }, [isOpen]);

  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedHandover, setCopiedHandover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOfficer, setCreatedOfficer] = useState<Officer | null>(null);
  const [plainPasswordSaved, setPlainPasswordSaved] = useState('');

  const generateRandomPassword = () => {
    const prefixes = ['Border', 'Eagle', 'Falcon', 'Bravo', 'Sector', 'Tiger', 'Vanguard'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const symbols = ['#', '@', '$', '!'];
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const pwd = `${prefix}${sym}2026_${num}`;
    setFormData((prev) => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  const handleCopyPassword = () => {
    if (formData.password) {
      navigator.clipboard.writeText(formData.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleCopyHandover = () => {
    if (createdOfficer) {
      const text = `=== IBVAP BORDER COMMAND - OFFICER CREDENTIALS HANDOVER ===\nOfficer Name: ${formData.full_name || createdOfficer.username}\nUsername: ${createdOfficer.username}\nAssigned Post: ${createdOfficer.post_name} (${createdOfficer.scope_id})\nRole / Rank: ${createdOfficer.role}\nTemporary Password: ${plainPasswordSaved}\nPortal: http://localhost:5173\n* Please change your password upon initial login.`;
      navigator.clipboard.writeText(text);
      setCopiedHandover(true);
      setTimeout(() => setCopiedHandover(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Username and Password are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const selectedPost = postOptions.find((p) => p.id === formData.post_scope_id);
      const postType = selectedPost?.type || 'BOP';

      const payload: OfficerCreate = {
        ...formData,
        username: formData.username.trim().toLowerCase(),
        email: formData.email?.trim() || `${formData.username.trim().toLowerCase()}@ibvap.mil`,
        post_scope_type: postType
      };

      const res = await userService.createOfficer(payload);
      setPlainPasswordSaved(formData.password);
      setCreatedOfficer(res);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register officer.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCreatedOfficer(null);
    setPlainPasswordSaved('');
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'OFFICER',
      post_scope_id: 'BOP-ALPHA',
      post_scope_type: 'BOP',
      full_name: ''
    });
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={createdOfficer ? "OFFICER ASSIGNED & REGISTERED SUCCESSFULLY" : "REGISTER DUTY OFFICER & ASSIGN POST"}
      maxWidth="xl"
    >
      {createdOfficer ? (
        <div className="space-y-6 text-xs font-mono">
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>Officer Profile Created & Duty Post Assigned</span>
            </div>
            <p className="text-slate-300">
              Officer <span className="text-white font-bold">{createdOfficer.username}</span> has been officially assigned to <span className="text-emerald-300 font-bold">{createdOfficer.post_name}</span>. Copy the handover credentials below to securely provide them to the officer.
            </p>
          </div>

          {/* Credentials Card */}
          <div className="p-4 bg-[#090d16] border border-amber-500/30 rounded-xl space-y-3">
            <div className="text-amber-400 font-bold flex items-center gap-2">
              <Key className="w-4 h-4" />
              <span>OFFICIAL CREDENTIALS HANDOVER CARD</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Officer Callsign:</span>
                <div className="text-white font-bold">{formData.full_name || createdOfficer.username}</div>
              </div>
              <div>
                <span className="text-slate-500">Username:</span>
                <div className="text-sky-300 font-bold">{createdOfficer.username}</div>
              </div>
              <div>
                <span className="text-slate-500">Assigned Post (BOP):</span>
                <div className="text-emerald-300 font-bold">{createdOfficer.post_name}</div>
              </div>
              <div>
                <span className="text-slate-500">Rank / Role:</span>
                <div className="text-purple-300 font-bold">{createdOfficer.role}</div>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-800">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Officer Temporary Password:</label>
              <div className="flex items-center gap-2 bg-[#111a2e] p-2.5 rounded-lg border border-amber-500/40">
                <input
                  type={showPassword ? 'text' : 'password'}
                  readOnly
                  value={plainPasswordSaved}
                  className="bg-transparent font-mono text-sm text-amber-300 w-full focus:outline-none font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCopyHandover}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition shadow-lg"
            >
              {copiedHandover ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copiedHandover ? 'Handover Copied!' : 'Copy Credentials Handover'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition"
            >
              Done & Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                Officer Username *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. officer_bravo"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Full Name & Rank / Designation</label>
              <input
                type="text"
                placeholder="e.g. Inspector Rajesh Kumar"
                value={formData.full_name || ''}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Assign Duty Post / Checkpost (BOP) *
              </label>
              <select
                value={formData.post_scope_id}
                onChange={(e) => setFormData({ ...formData, post_scope_id: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
              >
                {postOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                Operational Role / Clearance *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono cursor-pointer"
              >
                <option value="OFFICER">OFFICER (Checkpost Duty)</option>
                <option value="COMMANDER">COMMANDER (BOP Head)</option>
                <option value="BOP_OPERATOR">BOP_OPERATOR (Camera Monitor)</option>
                <option value="OPERATOR">OPERATOR (Triage & ANPR)</option>
                <option value="ADMIN">ADMIN (Central HQ Supreme Authority)</option>
                <option value="VIEWER">VIEWER (Read-Only Observer)</option>
              </select>
            </div>
          </div>

          {/* Password Field with Generator */}
          <div className="space-y-1.5 p-3.5 bg-[#090d16] border border-[#1e293b] rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Officer Password *
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold"
              >
                <Sparkles className="w-3 h-3" />
                Auto-Generate Password
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter or generate password (min 6 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111a2e] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 pr-10 font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {formData.password && (
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 flex items-center gap-1"
                  title="Copy password"
                >
                  {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-500">
              This password will be provided to the officer to log in at their checkpost terminal or mobile app.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleReset}
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
              {saving ? 'Creating Officer...' : 'Assign Post & Register Officer'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
