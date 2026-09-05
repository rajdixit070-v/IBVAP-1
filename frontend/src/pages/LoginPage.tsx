import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, ArrowRight, Radio, Building2, CheckCircle2, Zap } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

type PortalRole = 'ADMIN' | 'OFFICER';

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [portal, setPortal] = useState<PortalRole>('ADMIN');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@IBVAP2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPortal = (selected: PortalRole) => {
    setPortal(selected);
    setError(null);
    if (selected === 'ADMIN') {
      setUsername('admin');
      setPassword('Admin@IBVAP2026');
    } else {
      setUsername('officer_alpha');
      setPassword('Officer@IBVAP2026');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials for selected portal.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = portal === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#070b12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Tactical Grid */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/10">
            <Shield className="w-8 h-8 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wider font-mono">IBVAP COMMAND</h2>
          <p className="text-xs text-slate-400">
            Intelligent Border Video Analytics Platform • Unified Defense Network
          </p>
        </div>

        {/* Dual Portal Role Switcher Tabs */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Select Authorization Portal:
          </label>
          <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-[#080d1a] border border-slate-800 rounded-2xl">
            {/* Admin Portal Tab */}
            <button
              type="button"
              onClick={() => handleSelectPortal('ADMIN')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                isAdmin
                  ? 'bg-sky-950/60 border-sky-500/70 shadow-lg shadow-sky-950/50 ring-1 ring-sky-500/50'
                  : 'bg-slate-900/40 border-transparent hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Building2 className="w-4 h-4" />
                </div>
                {isAdmin && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
              </div>
              <div>
                <div className={`text-xs font-bold font-mono tracking-wide ${isAdmin ? 'text-white' : 'text-slate-300'}`}>
                  HQ Central Admin
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  National War Room, Policies & All BOPs
                </div>
              </div>
            </button>

            {/* Officer Portal Tab */}
            <button
              type="button"
              onClick={() => handleSelectPortal('OFFICER')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                !isAdmin
                  ? 'bg-emerald-950/60 border-emerald-500/70 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                  : 'bg-slate-900/40 border-transparent hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-lg ${!isAdmin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Radio className="w-4 h-4" />
                </div>
                {!isAdmin && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <div>
                <div className={`text-xs font-bold font-mono tracking-wide ${!isAdmin ? 'text-white' : 'text-slate-300'}`}>
                  Checkpost Officer
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  BOP Base Station, Cameras & SITREPs
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Selected Portal Scope Badge */}
        <div className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
          isAdmin
            ? 'bg-sky-950/30 border-sky-500/30 text-sky-300'
            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-ping bg-current"></span>
            <span>
              {isAdmin ? 'CLEARANCE LEVEL: GOD-MODE (GLOBAL ADMIN)' : 'ASSIGNED DUTY: BOP-ALPHA (SECTOR-NORTH)'}
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-bold">
            {isAdmin ? '24 MODULES' : '16 MODULES'}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isAdmin ? 'HQ Administrator Username' : 'Field Officer Call-Sign / ID'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdmin ? 'admin' : 'officer_alpha'}
                className="w-full bg-[#111a2e] border border-[#22324d] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isAdmin ? 'HQ Master Security Key' : 'Checkpost Operational Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#111a2e] border border-[#22324d] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg disabled:opacity-50 mt-2 cursor-pointer ${
              isAdmin
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/25'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
            }`}
          >
            {loading ? 'AUTHENTICATING ENCRYPTED SESSION...' : (
              isAdmin ? 'ACCESS HEADQUARTERS WAR ROOM' : 'ACCESS CHECKPOST BASE STATION'
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Credentials Preset Helper */}
        <div className="flex items-center justify-between p-2.5 bg-[#111a2e] rounded-xl border border-[#1e293b] text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Preset Login:
          </span>
          <span className="text-slate-200 font-semibold">
            {username} / {password}
          </span>
        </div>
      </div>
    </div>
  );
};

