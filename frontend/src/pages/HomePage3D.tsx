import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  User, 
  ArrowRight, 
  Radio, 
  Building2, 
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import { TacticalGlobe3D } from '../components/3d/TacticalGlobe3D';
import { TacticalBorderHUD } from '../components/3d/TacticalBorderHUD';

interface HomePage3DProps {
  onSuccess: () => void;
}

type PortalRole = 'ADMIN' | 'OFFICER';

export const HomePage3D: React.FC<HomePage3DProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [portal, setPortal] = useState<PortalRole>('ADMIN');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@IBVAP2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live IST Real-time Clock
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

  const handleRestoreDefaults = () => {
    if (portal === 'ADMIN') {
      setUsername('admin');
      setPassword('Admin@IBVAP2026');
    } else {
      setUsername('officer_alpha');
      setPassword('Officer@IBVAP2026');
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Tactical authentication failed. Please verify military credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#020611] text-slate-100 overflow-x-hidden select-none">
      {/* 1. Fullscreen Interactive Photorealistic 3D Earth Background */}
      <TacticalGlobe3D />

      {/* 2. Tactical Border HUD Overlays & Reticles */}
      <TacticalBorderHUD currentTime={currentTime} />

      {/* 3. Foreground Content (pointer-events-none on backdrop, pointer-events-auto on interactive elements) */}
      <div className="relative z-10 min-h-screen flex flex-col justify-between pt-16 pb-8 px-4 pointer-events-none">
        {/* Main Center Area: Sleek Cyber Login Card */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md pointer-events-auto">
            {/* Cyber Card Container */}
            <div className="relative bg-[#091220]/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300 hover:border-cyan-500/50 group">
              {/* Top Accent Gradient Border Glow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500" />
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Card Header: Official Logo & Title */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-center p-1.5 shadow-lg shadow-cyan-950/40">
                    <img src="/logo.png" alt="IBVAP Logo" className="w-full h-full object-contain drop-shadow" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xl text-white tracking-wider">IBVAP</span>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 font-bold">
                        C2 DEFENSE
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                      Intelligent Border Vision Analytics
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Autonomous Perimeter Defense & Situational Awareness Matrix
                </p>
              </div>

              {/* Border Soldiers & Sentinels Tribute Ribbon */}
              <div className="mb-4 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-emerald-950/60 border border-amber-500/30 text-[11px] font-mono flex items-center justify-between text-slate-200 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇮🇳</span>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="font-bold text-amber-300 tracking-wide">BORDER SENTINELS • SALUTE TO BRAVE SOLDIERS</span>
                    <span className="text-[9px] text-slate-400">Guarding frontiers from Siachen Glaciers to Thar Desert</span>
                  </div>
                </div>
                <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 font-bold animate-pulse">
                  24/7 VIGIL
                </span>
              </div>

              {/* Clearance Level Switcher */}
              <div className="flex items-center p-1 bg-slate-950/90 rounded-xl border border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => handleSelectPortal('ADMIN')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    portal === 'ADMIN'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/30 border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Central HQ</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPortal('OFFICER')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    portal === 'OFFICER'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30 border border-emerald-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Checkpost Cmdr</span>
                </button>
              </div>

              {/* Error Message Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-tight">{error}</div>
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Callsign / Username */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Officer Callsign</span>
                    <span className="text-[10px] text-cyan-400 font-normal">
                      {portal === 'ADMIN' ? 'HQ Access' : 'Outpost Token'}
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Enter military callsign"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                    />
                  </div>
                </div>

                {/* Secure Clearance Cipher / Password */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Access Cipher</span>
                    <span className="text-[10px] text-slate-400 font-mono">Encrypted</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter clearance password"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-300 cursor-pointer transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Quick Demo Shortcut Pill & Restore Action */}
                <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400">Preset:</span>
                    <span className="text-slate-300 font-semibold">{username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                    title="Restore default test credentials"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Default Fill</span>
                  </button>
                </div>

                {/* Submit / Authorize Clearance Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 border border-cyan-400/40 transition-all transform active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>AUTHORIZING CLEARANCE...</span>
                    </>
                  ) : (
                    <>
                      <span>ENTER DEFENSE COMMAND</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Subtle Glowing Border */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            </div>
          </div>
        </div>

        {/* 4. Official Military & Soldier Tribute Footer */}
        <footer className="text-center text-slate-400 text-xs font-mono max-w-2xl mx-auto space-y-1.5 pointer-events-auto">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs tracking-wider">
            <span>🇮🇳</span>
            <span>Dedicated with Deepest Respect to Our Brave Jawans Guarding the Frontiers</span>
            <span>🇮🇳</span>
          </div>
          <p className="text-slate-200 font-bold tracking-widest text-[11px]">
            VALOR • DEVOTION • VIGILANCE • DUTY UNTO DEATH • DEFENDING THE MOTHERLAND
          </p>
          <p className="text-[10px] text-slate-500">
            MINISTRY OF DEFENCE & HOME AFFAIRS • BORDER SECURITY FORCE • ITBP • INDIAN ARMY
          </p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage3D;
