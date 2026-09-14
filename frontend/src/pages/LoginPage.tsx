import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Lock, 
  User, 
  ArrowRight, 
  Radio, 
  Building2, 
  CheckCircle2, 
  UserPlus, 
  X, 
  MapPin, 
  Compass, 
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  KeyRound
} from 'lucide-react';
import { authService } from '../services/authService';
import { COMPREHENSIVE_CHECKPOSTS } from '../constants/checkposts';

interface LoginPageProps {
  onSuccess: () => void;
}

type PortalRole = 'ADMIN' | 'OFFICER';

const FRONTIER_SECTORS = [
  'Punjab Frontier',
  'Rajasthan Frontier',
  'Jammu & Kashmir',
  'Ladakh Sector',
  'Gujarat Frontier',
  'Eastern Frontier'
];

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [portal, setPortal] = useState<PortalRole>('ADMIN');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@IBVAP2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live IST Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setCurrentTime(new Intl.DateTimeFormat('en-IN', options).format(now).toUpperCase() + ' IST');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regRole, setRegRole] = useState<'COMMANDER' | 'ADMIN'>('COMMANDER');
  const [regSector, setRegSector] = useState<string>('Punjab Frontier');
  const [regBopId, setRegBopId] = useState<string>('BOP-WAGAH');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

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
      await login(username.trim(), password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify defense credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Filter BOPs based on selected sector
  const filteredBops = COMPREHENSIVE_CHECKPOSTS.filter(cp => 
    cp.sector.toLowerCase() === regSector.toLowerCase()
  );

  const handleSectorChange = (sector: string) => {
    setRegSector(sector);
    const bopsInSector = COMPREHENSIVE_CHECKPOSTS.filter(cp => 
      cp.sector.toLowerCase() === sector.toLowerCase()
    );
    if (bopsInSector.length > 0) {
      setRegBopId(bopsInSector[0].id);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    const cleanUser = regUsername.trim().toLowerCase();
    if (cleanUser.length < 3) {
      setRegError('Callsign / Username must be at least 3 characters.');
      setRegLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      setRegLoading(false);
      return;
    }

    try {
      const res = await authService.registerOfficer({
        username: cleanUser,
        password: regPassword,
        full_name: regFullName.trim() || undefined,
        role: regRole,
        sector: regSector,
        bop_id: regBopId
      });

      setRegSuccess(res.message || 'Officer commissioned successfully! Authorizing defense terminal...');

      setTimeout(async () => {
        try {
          await login(cleanUser, regPassword);
          setIsRegisterOpen(false);
          onSuccess();
        } catch {
          setPortal(regRole === 'ADMIN' ? 'ADMIN' : 'OFFICER');
          setUsername(cleanUser);
          setPassword(regPassword);
          setIsRegisterOpen(false);
        }
      }, 1000);
    } catch (err: any) {
      setRegError(err.response?.data?.detail || 'Failed to commission officer. Please verify details.');
    } finally {
      setRegLoading(false);
    }
  };

  const isAdmin = portal === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#070c12] text-slate-100 flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top National Tricolor Accent Bar */}
      <div className="h-1.5 w-full flex shrink-0">
        <div className="flex-1 bg-[#FF9933]"></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      {/* Subtle Tactical Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#1b2838_1px,transparent_1px),linear-gradient(to_bottom,#1b2838_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]"></div>
      
      {/* Subtle Radial Camouflage / Vignette Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-b from-emerald-950/20 via-sky-950/10 to-transparent blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-6 md:py-8 flex-1 flex flex-col justify-center">
        
        {/* Defense Command Header */}
        <div className="text-center space-y-3 mb-6">
          {/* Government & Defense Ministry Badges */}
          <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs font-mono font-semibold tracking-wider text-amber-400 uppercase">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              भारत सरकार • GOVERNMENT OF INDIA
            </span>
            <span className="hidden sm:inline-block text-slate-600">•</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
              MINISTRY OF DEFENCE & HOME AFFAIRS
            </span>
          </div>

          {/* National Insignia Emblem & Title */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-emerald-500/10 to-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-950/30">
              <Shield className="w-8 h-8 text-amber-400 drop-shadow" />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-widest font-mono uppercase">
                IBVAP <span className="text-amber-400 font-extrabold">DEFENSE COMMAND</span>
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-400 tracking-wide">
                Integrated Border Surveillance & Reconnaissance Platform • सीमा सुरक्षा कमान
              </p>
            </div>
          </div>

          {/* Real-time Defense Status Ribbon */}
          <div className="inline-flex flex-wrap items-center justify-center gap-3 px-4 py-1.5 rounded-xl bg-[#0d1522] border border-slate-800 text-[11px] font-mono text-slate-300 shadow-inner">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GRID STATUS: ACTIVE (57 BOPS CONNECTED)</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentTime || 'CONNECTING IST...'}</span>
            </div>
            <span className="text-slate-700 hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-1 text-sky-400">
              <span>SECURITY: RESTRICTED // MIL-STD 256-BIT</span>
            </div>
          </div>
        </div>

        {/* Security Warning Notice */}
        <div className="mb-6 p-3 bg-amber-950/25 border-l-4 border-amber-500 rounded-r-xl border-y border-r border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-300 font-semibold uppercase tracking-wider">OFFICIAL DEFENSE TERMINAL: </strong>
            Authorized military and border security personnel only. Unauthorized access, reconnaissance, or data interception is strictly prohibited and punishable under the Official Secrets Act, 1923 and Information Technology Act, 2000.
          </div>
        </div>

        {/* Authentication Card */}
        <div className="bg-[#0c1320]/95 border border-[#1e2c40] rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden">
          {/* Subtle Corner Accents */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-tr-full pointer-events-none"></div>

          {/* Dual Role Selector Tabs */}
          <div className="mb-6">
            <div className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>SELECT OPERATIONAL CLEARANCE LEVEL:</span>
              <span className="text-slate-500 text-[10px]">CLICK TO SELECT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* HQ Central Admin Tab */}
              <button
                type="button"
                onClick={() => handleSelectPortal('ADMIN')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isAdmin
                    ? 'bg-sky-950/70 border-sky-500 shadow-lg shadow-sky-950/60 ring-2 ring-sky-500/40'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${isAdmin ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  {isAdmin ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SELECTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">SWITCH</span>
                  )}
                </div>
                <div>
                  <div className={`text-sm font-bold font-mono tracking-wide ${isAdmin ? 'text-white' : 'text-slate-300'}`}>
                    Central Command Headquarters (Admin HQ)
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug mt-1">
                    National War Room • Multi-Frontier Surveillance & All 57 Border Outposts
                  </div>
                </div>
              </button>

              {/* Checkpost Commander Tab */}
              <button
                type="button"
                onClick={() => handleSelectPortal('OFFICER')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  !isAdmin
                    ? 'bg-emerald-950/70 border-emerald-500 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/40'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${!isAdmin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                    <Radio className="w-5 h-5" />
                  </div>
                  {!isAdmin ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SELECTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">SWITCH</span>
                  )}
                </div>
                <div>
                  <div className={`text-sm font-bold font-mono tracking-wide ${!isAdmin ? 'text-white' : 'text-slate-300'}`}>
                    Frontier Checkpost Commander (BOP Field)
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug mt-1">
                    Border Outpost Command (Wagah, Hussainiwala, Sadqi, Longewala, etc.)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-950/50 border border-rose-500/60 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Callsign / Username */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 mb-1.5 uppercase tracking-wide">
                  {isAdmin ? 'HQ Administrator Callsign' : 'Officer Callsign / Service ID'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={isAdmin ? 'admin' : 'officer_alpha or callsign'}
                    className="w-full bg-[#111a2a] border border-[#23354f] rounded-xl pl-10 pr-3 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 mb-1.5 uppercase tracking-wide">
                  {isAdmin ? 'Master Security Passkey' : 'Operational Access Password'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#111a2a] border border-[#23354f] rounded-xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Demo Pre-fill Shortcut Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#090f19] rounded-xl border border-slate-800 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Preset Credential:</span>
                <span className="text-slate-200 font-bold">{username}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-200 font-bold">{password}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) {
                    setUsername('admin');
                    setPassword('Admin@IBVAP2026');
                  } else {
                    setUsername('officer_alpha');
                    setPassword('Officer@IBVAP2026');
                  }
                }}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer font-bold"
              >
                RESET DEFAULTS
              </button>
            </div>

            {/* Submit Authorization Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 text-white rounded-xl text-xs sm:text-sm font-mono font-bold tracking-wider transition shadow-xl cursor-pointer disabled:opacity-50 ${
                isAdmin
                  ? 'bg-gradient-to-r from-sky-700 via-sky-600 to-indigo-700 hover:from-sky-600 hover:to-indigo-600 shadow-sky-900/40 border border-sky-400/40'
                  : 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-900/40 border border-emerald-400/40'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>AUTHORIZING DEFENSE SECURITY CLEARANCE...</span>
                </>
              ) : (
                <>
                  <span>
                    {isAdmin ? 'ACCESS CENTRAL COMMAND WAR ROOM (ADMIN)' : 'ACCESS CHECKPOST COMMAND CONSOLE (BOP FIELD)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* New Officer Commissioning Banner */}
          <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="text-xs font-bold text-amber-400 font-mono flex items-center justify-center sm:justify-start gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                New Officer Commissioning / Callsign Registration
              </div>
              <div className="text-[11px] text-slate-400">
                Deploy new officer credentials to any border sector or checkpost.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRegisterOpen(true);
                setRegError(null);
                setRegSuccess(null);
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-mono font-bold transition shrink-0 cursor-pointer shadow-sm"
            >
              + COMMISSION NEW OFFICER
            </button>
          </div>
        </div>
      </div>

      {/* Official Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-[#05080e] py-3.5 px-4 text-center">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] md:text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold">शौर्यम् • दक्षम • युद्ध्येय</span>
            <span className="text-slate-700">|</span>
            <span>BHARAT SEEMA SURAKSHA • VIGILANCE UNTO DEATH</span>
          </div>
          <div>
            RESTRICTED DEFENSE PLATFORM • HOSTED ON SECURE DEFENSE NETWORK
          </div>
        </div>
      </footer>

      {/* Commission Officer Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#0e1726] border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono tracking-wide">
                    COMMISSION DEFENSE FIELD OFFICER
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Register defense credentials and deploy operational clearance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error / Success Notifications */}
            {regError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{regError}</span>
              </div>
            )}
            {regSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{regSuccess}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Callsign / Username */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1 font-semibold">
                    OFFICER CALLSIGN / USERNAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. capt_sharma"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full bg-[#142036] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1 font-semibold">
                    ACCESS PASSWORD *
                  </label>
                  <div className="relative">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-[#142036] border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    >
                      {regShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Name & Rank */}
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1 font-semibold">
                  FULL NAME & MILITARY RANK
                </label>
                <input
                  type="text"
                  placeholder="e.g. Major R. K. Verma, 9th Rajputana Rifles"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-[#142036] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Operational Clearance Role */}
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1 font-semibold">
                  DUTY CLEARANCE ROLE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('COMMANDER');
                      setRegSector('Punjab Frontier');
                      setRegBopId('BOP-WAGAH');
                    }}
                    className={`p-2.5 rounded-xl border text-left font-mono cursor-pointer transition ${
                      regRole === 'COMMANDER'
                        ? 'bg-emerald-950/70 border-emerald-500 text-white ring-1 ring-emerald-500/50'
                        : 'bg-[#142036] border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-400">COMMANDER</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Checkpost / BOP In-Charge</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegRole('ADMIN');
                      setRegSector('All Frontiers (National HQ)');
                      setRegBopId('*');
                    }}
                    className={`p-2.5 rounded-xl border text-left font-mono cursor-pointer transition ${
                      regRole === 'ADMIN'
                        ? 'bg-sky-950/70 border-sky-500 text-white ring-1 ring-sky-500/50'
                        : 'bg-[#142036] border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-bold text-sky-400">ADMIN HQ</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Central Command Officer</div>
                  </button>
                </div>
              </div>

              {/* Frontier Sector Selection & Checkpost */}
              {regRole === 'ADMIN' ? (
                <div className="p-3 bg-[#111b2e] border border-sky-500/30 rounded-xl space-y-1 font-mono">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Assigned Command Jurisdiction</div>
                  <div className="text-sky-300 font-bold text-xs flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    Delhi Central HQ (National Command Central - All Sectors)
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1 flex items-center gap-1 font-semibold">
                      <Compass className="w-3.5 h-3.5 text-amber-400" />
                      DUTY FRONTIER SECTOR
                    </label>
                    <select
                      value={regSector}
                      onChange={(e) => handleSectorChange(e.target.value)}
                      className="w-full bg-[#142036] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    >
                      {FRONTIER_SECTORS.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Border Checkpost Assignment */}
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      ASSIGNED CHECKPOST (BOP)
                    </label>
                    <select
                      value={regBopId}
                      onChange={(e) => setRegBopId(e.target.value)}
                      className="w-full bg-[#142036] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    >
                      {filteredBops.map((bop) => (
                        <option key={bop.id} value={bop.id}>
                          {bop.name} ({bop.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-mono transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold transition shadow-lg shadow-amber-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {regLoading ? 'COMMISSIONING OFFICER...' : 'COMMISSION & LOG IN'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
