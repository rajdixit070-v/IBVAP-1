import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { userService, Officer } from '../../services/userService';
import { Key, Eye, EyeOff, Sparkles, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  officer: Officer | null;
  onSuccess: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  officer,
  onSuccess
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!officer) return null;

  const generateRandomPassword = () => {
    const prefixes = ['Border', 'Eagle', 'Bravo', 'Sector', 'Tiger', 'Guard'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const pwd = `${prefix}#2026_${num}`;
    setNewPassword(pwd);
    setShowPassword(true);
  };

  const handleCopy = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await userService.resetPassword(officer.id, newPassword.trim());
      setSuccessMsg(`Password successfully updated for officer '${officer.username}'!`);
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
        setNewPassword('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`RESET PASSWORD // OFFICER: ${officer.username.toUpperCase()}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
        <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between">
          <div>
            <div className="text-white font-bold">{officer.username}</div>
            <div className="text-slate-400 text-[11px]">{officer.post_name} • {officer.role}</div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-bold">
            {officer.is_active ? 'ACTIVE' : 'LOCKED'}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              New Officer Password
            </label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold"
            >
              <Sparkles className="w-3 h-3" />
              Auto-Generate
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter or generate new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 pr-10 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {newPassword && (
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 flex items-center gap-1"
                title="Copy password"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !newPassword}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition shadow-lg disabled:opacity-50"
          >
            <Key className="w-4 h-4" />
            {saving ? 'Updating...' : 'Set & Handover Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
