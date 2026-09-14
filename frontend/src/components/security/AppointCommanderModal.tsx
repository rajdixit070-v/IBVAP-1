import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { userService, Officer, OfficerCreate } from '../../services/userService';
import {
  UserCheck,
  ShieldCheck,
  UserPlus,
  Eye,
  EyeOff,
  AlertTriangle,
  MapPin,
  Sparkles
} from 'lucide-react';

interface AppointCommanderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bop: {
    bop_id: string;
    name: string;
    code: string;
    location?: string;
  } | null;
  currentCommander?: Officer | null;
  onSuccess: () => void;
}

export const AppointCommanderModal: React.FC<AppointCommanderModalProps> = ({
  isOpen,
  onClose,
  bop,
  currentCommander,
  onSuccess
}) => {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | ''>('');
  
  // New commander form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      userService.listOfficers().then((data) => {
        setOfficers(data);
        if (data.length > 0 && !selectedOfficerId) {
          setSelectedOfficerId(data[0].id);
        }
      }).catch(console.error);

      if (!currentCommander) {
        setTab('existing');
      }
    }
  }, [isOpen]);

  if (!bop) return null;

  const handleGeneratePassword = () => {
    const prefixes = ['Border', 'Eagle', 'Falcon', 'Bravo', 'Tiger', 'Vanguard'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const pwd = `${prefix}@2026_${num}`;
    setNewPassword(pwd);
    setShowPassword(true);
  };

  const handleAppointExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficerId) {
      setError('Please select an officer from the directory.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const targetOfficer = officers.find((o) => o.id === Number(selectedOfficerId));
      if (!targetOfficer) throw new Error('Selected officer not found');

      await userService.updateOfficer(targetOfficer.id, {
        post_scope_id: bop.bop_id,
        post_scope_type: 'BOP',
        role: 'COMMANDER',
        sector: bop.location || 'Punjab Frontier'
      });

      setSuccessMessage(`Officer ${targetOfficer.username} appointed as Head of ${bop.name}!`);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to appoint commander.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommissionNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim().toLowerCase();
    const cleanPwd = newPassword.trim();

    if (cleanUser.length < 3) {
      setError('Callsign / username must be at least 3 characters.');
      return;
    }
    if (cleanPwd.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: OfficerCreate = {
        username: cleanUser,
        password: cleanPwd,
        full_name: newFullName.trim() || undefined,
        role: 'COMMANDER',
        post_scope_id: bop.bop_id,
        post_scope_type: 'BOP',
        sector: bop.location || 'Punjab Frontier'
      };

      await userService.createOfficer(payload);
      setSuccessMessage(`Commander ${cleanUser} successfully commissioned and appointed to ${bop.name}!`);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to commission new commander.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`APPOINT CHECKPOST HEAD // ${bop.name.toUpperCase()}`}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs font-mono">
        {/* Checkpost Metadata Card */}
        <div className="p-3 bg-[#090d16] border border-emerald-500/30 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Target Border Outpost:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
              {bop.code}
            </span>
          </div>
          <div className="text-white font-bold text-sm flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>{bop.name}</span>
          </div>
          <div className="text-cyan-400 text-[11px]">
            Frontier Sector: <span className="font-bold">{bop.location || 'Border Sector'}</span>
          </div>
          {currentCommander ? (
            <div className="text-amber-300 text-[11px] pt-1 border-t border-slate-800">
              Current Head: <span className="font-bold">{currentCommander.username}</span> ({currentCommander.role})
            </div>
          ) : (
            <div className="text-slate-500 italic text-[11px] pt-1 border-t border-slate-800">
              Current Head: Unassigned (HQ Pool)
            </div>
          )}
        </div>

        {/* Success & Error Notifications */}
        {successMessage && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-500/50 rounded-xl text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-[#090d16] p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTab('existing')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'existing'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Reassign Existing Officer</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'new'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Commission New Commander</span>
          </button>
        </div>

        {tab === 'existing' ? (
          <form onSubmit={handleAppointExisting} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block">
                Select Commander from Active Directory *
              </label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
              >
                {officers.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.username} ({off.role}) — Current Post: {off.post_name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                The selected officer will be transferred and designated as Checkpost Head for {bop.name}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Appointing...' : 'Confirm Appointment'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCommissionNew} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Commander Callsign *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cmdr_sharma"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold">Full Name & Rank</label>
                <input
                  type="text"
                  placeholder="e.g. Major Vikram Rathore"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold">Access Password *</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Generate
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Commissioning...' : 'Commission & Appoint'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
