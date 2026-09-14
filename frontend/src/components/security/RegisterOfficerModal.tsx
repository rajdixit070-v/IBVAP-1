import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  Globe,
  Plus,
  Compass,
  Navigation,
  Activity
} from 'lucide-react';

import { federationService } from '../../services/federationService';
import { CheckpostSearchSelect } from '../common/CheckpostSearchSelect';
import { SectorSearchSelect } from '../common/SectorSearchSelect';
import { COMPREHENSIVE_CHECKPOSTS, CheckpostItem } from '../../constants/checkposts';

interface RegisterOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBop?: { bop_id: string; name: string; sector?: string } | null;
  initialSector?: string;
}

const SECTOR_COORDINATES: Record<string, { lat: number; lng: number; state: string }> = {
  'punjab frontier': { lat: 31.6048, lng: 74.5731, state: 'Punjab' },
  'rajasthan frontier': { lat: 27.5255, lng: 70.1558, state: 'Rajasthan' },
  'jammu & kashmir': { lat: 32.6105, lng: 74.6980, state: 'Jammu & Kashmir' },
  'ladakh sector': { lat: 34.7578, lng: 78.2241, state: 'Ladakh' },
  'gujarat / kutch': { lat: 23.8560, lng: 68.6740, state: 'Gujarat' },
  'eastern frontier': { lat: 25.1873, lng: 92.0197, state: 'West Bengal / Assam' },
  'sikkim': { lat: 27.3866, lng: 88.8315, state: 'Sikkim' },
};

function getSectorDefaults(sec: string) {
  const lower = (sec || '').toLowerCase();
  for (const [k, v] of Object.entries(SECTOR_COORDINATES)) {
    if (lower.includes(k) || k.includes(lower)) return v;
  }
  if (lower.includes('sikkim')) return { lat: 27.3866, lng: 88.8315, state: 'Sikkim' };
  if (lower.includes('baramulla') || lower.includes('uri') || lower.includes('loc')) return { lat: 34.2098, lng: 74.3436, state: 'Jammu & Kashmir' };
  if (lower.includes('tripura') || lower.includes('bengal') || lower.includes('assam')) return { lat: 23.8315, lng: 91.2868, state: 'Tripura / Assam' };
  return { lat: 31.6048, lng: 74.5731, state: 'India Border Zone' };
}

export const RegisterOfficerModal: React.FC<RegisterOfficerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialBop,
  initialSector
}) => {
  const [checkpostOptions, setCheckpostOptions] = useState<CheckpostItem[]>(COMPREHENSIVE_CHECKPOSTS);

  // Form State
  const [formData, setFormData] = useState<OfficerCreate>({
    username: '',
    email: '',
    password: '',
    role: 'COMMANDER',
    post_scope_id: 'BOP-WAGAH',
    post_scope_type: 'BOP',
    sector: 'Punjab Frontier',
    full_name: ''
  });

  // Custom Sector & Custom BOP State
  const [isCustomSector, setIsCustomSector] = useState(false);
  const [customSectorName, setCustomSectorName] = useState('');

  const [isCustomBop, setIsCustomBop] = useState(false);
  const [customBopName, setCustomBopName] = useState('');
  const [customBopCode, setCustomBopCode] = useState('');
  const [customBopState, setCustomBopState] = useState('Punjab');
  const [customBopLat, setCustomBopLat] = useState<number>(31.6048);
  const [customBopLng, setCustomBopLng] = useState<number>(74.5731);
  const [customBopPriority, setCustomBopPriority] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');

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
            type: 'BOP',
            latitude: b.latitude ?? existing?.latitude,
            longitude: b.longitude ?? existing?.longitude
          });
        });
        const opts = Array.from(checkpostMap.values());
        setCheckpostOptions(opts);

        if (initialBop) {
          setIsCustomBop(false);
          setIsCustomSector(false);
          const matched = opts.find(o => o.id === initialBop.bop_id);
          const initialSec = initialBop.sector || matched?.sector || 'Punjab Frontier';
          const coords = (matched?.latitude && matched?.longitude)
            ? { lat: matched.latitude, lng: matched.longitude, state: matched.state || 'India' }
            : getSectorDefaults(initialSec);
          setCustomBopLat(coords.lat);
          setCustomBopLng(coords.lng);
          setCustomBopState(coords.state);
          setFormData(prev => ({
            ...prev,
            role: 'COMMANDER',
            post_scope_id: initialBop.bop_id,
            post_scope_type: 'BOP',
            sector: initialSec
          }));
        } else {
          const defaultSec = (initialSector && initialSector !== 'ALL') ? initialSector : 'Punjab Frontier';
          const matched = opts.find(o => o.sector === defaultSec) || opts[0];
          const coords = (matched?.latitude && matched?.longitude)
            ? { lat: matched.latitude, lng: matched.longitude, state: matched.state || 'India' }
            : getSectorDefaults(defaultSec);
          setCustomBopLat(coords.lat);
          setCustomBopLng(coords.lng);
          setCustomBopState(coords.state);
          setFormData(prev => ({
            ...prev,
            sector: defaultSec,
            post_scope_id: prev.post_scope_id && prev.post_scope_id !== '*' ? prev.post_scope_id : (matched?.id || 'BOP-WAGAH')
          }));
        }
      });
    }
  }, [isOpen, initialBop, initialSector]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    checkpostOptions.forEach((cp) => {
      if (cp.sector) set.add(cp.sector);
    });
    return Array.from(set);
  }, [checkpostOptions]);

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
      const isAdm = createdOfficer.role === 'ADMIN';
      const postLabel = isAdm ? 'Assigned HQ Station' : 'Assigned Checkpost';
      const coordsText = !isAdm && isCustomBop ? `\nGPS Coordinates: ${customBopLat.toFixed(4)}°N, ${customBopLng.toFixed(4)}°E\nPriority SLA: ${customBopPriority}` : '';
      const text = `=== IBVAP BORDER COMMAND - CREDENTIALS HANDOVER ===\nPersonnel Name: ${formData.full_name || createdOfficer.username}\nUsername: ${createdOfficer.username}\n${postLabel}: ${createdOfficer.post_name} (${createdOfficer.scope_id})\nBorder Sector: ${createdOfficer.sector || formData.sector || 'Punjab Frontier'}${coordsText}\nRole / Rank: ${createdOfficer.role}\nTemporary Password: ${plainPasswordSaved}\nPortal: http://localhost:5173\n* Please change your password upon initial login.`;
      navigator.clipboard.writeText(text);
      setCopiedHandover(true);
      setTimeout(() => setCopiedHandover(false), 2500);
    }
  };

  // Auto-generate BOP code when custom BOP name changes
  const handleCustomBopNameChange = (nameVal: string) => {
    setCustomBopName(nameVal);
    const clean = nameVal.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const code = clean.startsWith('BOP-') ? clean : (clean ? `BOP-${clean}` : '');
    setCustomBopCode(code);
  };

  // When sector changes, auto-update GPS and state defaults if creating a custom BOP
  const handleSectorChange = (secVal: string) => {
    setFormData(prev => ({ ...prev, sector: secVal }));
    const coords = getSectorDefaults(secVal);
    setCustomBopLat(coords.lat);
    setCustomBopLng(coords.lng);
    setCustomBopState(coords.state);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = formData.username.trim().toLowerCase();
    const cleanPassword = formData.password.trim();

    if (!cleanUsername) {
      setError('Officer Username is required.');
      return;
    }
    if (cleanUsername.length < 3) {
      setError('Officer Username must be at least 3 characters.');
      return;
    }
    if (!cleanPassword) {
      setError('Officer Password is required.');
      return;
    }
    if (cleanPassword.length < 4) {
      setError('Officer Password must be at least 4 characters.');
      return;
    }

    // Sector validation
    let resolvedSector = formData.sector || 'Punjab Frontier';
    if (formData.role === 'COMMANDER') {
      if (isCustomSector) {
        const cleanSec = customSectorName.trim();
        if (!cleanSec) {
          setError('Please enter a name for the new Frontier Sector.');
          return;
        }
        resolvedSector = cleanSec;
      }
    } else {
      resolvedSector = 'All Border Sectors (National HQ)';
    }

    // Checkpost validation
    let resolvedPostId = formData.post_scope_id || 'BOP-WAGAH';
    let resolvedPostName: string | undefined = undefined;

    if (formData.role === 'COMMANDER') {
      if (isCustomBop) {
        const cleanBop = customBopName.trim();
        if (!cleanBop) {
          setError('Please enter a name for the new Checkpost.');
          return;
        }
        resolvedPostName = cleanBop;
        resolvedPostId = customBopCode.trim() || `BOP-${cleanBop.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
      } else if (!resolvedPostId) {
        resolvedPostId = checkpostOptions[0]?.id || 'BOP-WAGAH';
      }
    } else {
      resolvedPostId = formData.post_scope_id || '*';
    }

    try {
      setSaving(true);
      setError(null);
      const postType = formData.role === 'ADMIN' ? 'GLOBAL' : 'BOP';

      const payload: OfficerCreate = {
        ...formData,
        username: cleanUsername,
        password: cleanPassword,
        email: formData.email?.trim() || `${cleanUsername}@ibvap.mil`,
        post_scope_id: resolvedPostId,
        post_scope_type: postType,
        post_name: resolvedPostName,
        sector: resolvedSector,
        latitude: formData.role === 'COMMANDER' ? Number(customBopLat) : undefined,
        longitude: formData.role === 'COMMANDER' ? Number(customBopLng) : undefined,
        operational_priority: formData.role === 'COMMANDER' ? customBopPriority : undefined
      };

      const res = await userService.createOfficer(payload);
      setPlainPasswordSaved(cleanPassword);
      setCreatedOfficer(res);
      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
      onSuccess();
    } catch (err: any) {
      let msg = 'Failed to register personnel. Please check details.';
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg || (d.loc ? `${d.loc.slice(1).join('.')}: ${d.type}` : JSON.stringify(d))).join('; ');
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

  const handleReset = () => {
    setCreatedOfficer(null);
    setPlainPasswordSaved('');
    setIsCustomSector(false);
    setCustomSectorName('');
    setIsCustomBop(false);
    setCustomBopName('');
    setCustomBopCode('');
    setCustomBopLat(31.6048);
    setCustomBopLng(74.5731);
    setCustomBopPriority('NORMAL');
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'COMMANDER',
      post_scope_id: checkpostOptions[0]?.id || 'BOP-WAGAH',
      post_scope_type: 'BOP',
      sector: 'Punjab Frontier',
      full_name: ''
    });
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={
        createdOfficer
          ? (createdOfficer.role === 'ADMIN' ? "CENTRAL ADMINISTRATOR REGISTERED" : "COMMANDER APPOINTED & REGISTERED")
          : (formData.role === 'ADMIN' ? "APPOINT CENTRAL ADMINISTRATOR (HQ ADMIN)" : "APPOINT CHECKPOST HEAD (COMMANDER)")
      }
      maxWidth="xl"
    >
      {createdOfficer ? (
        <div className="space-y-6 text-xs font-mono">
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>
                {createdOfficer.role === 'ADMIN'
                  ? "Central HQ Administrator Account Created Successfully"
                  : "Commander Profile Commissioned & Checkpost Assigned"}
              </span>
            </div>
            <p className="text-slate-300">
              {createdOfficer.role === 'ADMIN' ? (
                <>Administrator <span className="text-white font-bold">{createdOfficer.username}</span> has been granted central authority for <span className="text-emerald-300 font-bold">{createdOfficer.post_name}</span>.</>
              ) : (
                <>Commander <span className="text-white font-bold">{createdOfficer.username}</span> has been appointed to head <span className="text-emerald-300 font-bold">{createdOfficer.post_name}</span> under <span className="text-cyan-300 font-bold">{createdOfficer.sector}</span>.</>
              )}
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
                <span className="text-slate-500">Personnel Callsign:</span>
                <div className="text-white font-bold">{formData.full_name || createdOfficer.username}</div>
              </div>
              <div>
                <span className="text-slate-500">Username:</span>
                <div className="text-sky-300 font-bold">{createdOfficer.username}</div>
              </div>
              <div>
                <span className="text-slate-500">
                  {createdOfficer.role === 'ADMIN' ? 'Assigned HQ Station:' : 'Assigned Checkpost:'}
                </span>
                <div className="text-emerald-300 font-bold">{createdOfficer.post_name}</div>
              </div>
              <div>
                <span className="text-slate-500">Border Frontier / Sector:</span>
                <div className="text-cyan-300 font-bold">{createdOfficer.sector}</div>
              </div>
              <div>
                <span className="text-slate-500">Rank / Role:</span>
                <div className="text-purple-300 font-bold">{createdOfficer.role}</div>
              </div>
              {formData.role === 'COMMANDER' && (
                <>
                  <div>
                    <span className="text-slate-500">GPS Coords:</span>
                    <div className="text-cyan-300 font-bold">{customBopLat.toFixed(4)}°N, {customBopLng.toFixed(4)}°E</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Defense Priority:</span>
                    <div className="text-amber-300 font-bold">{customBopPriority} SLA</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Jurisdiction State:</span>
                    <div className="text-emerald-300 font-bold">{customBopState}</div>
                  </div>
                </>
              )}
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
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition shadow-lg cursor-pointer"
            >
              {copiedHandover ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copiedHandover ? 'Handover Copied!' : 'Copy Credentials Handover'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg cursor-pointer"
            >
              ✓ Done & View in Directory
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

          {/* Role Selection - Strictly COMMANDER or ADMIN */}
          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-2">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-400" />
              Operational Authority / Rank *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    role: 'COMMANDER',
                    post_scope_id: checkpostOptions[0]?.id || 'BOP-WAGAH',
                    post_scope_type: 'BOP'
                  }));
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  formData.role === 'COMMANDER'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-md'
                    : 'bg-[#111a2e]/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>COMMANDER</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Checkpost Head / BOP In-Charge (Assigned to a specific border outpost)
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    role: 'ADMIN',
                    post_scope_id: '*',
                    post_scope_type: 'GLOBAL'
                  }));
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  formData.role === 'ADMIN'
                    ? 'bg-rose-950/40 border-rose-500/60 text-white shadow-md'
                    : 'bg-[#111a2e]/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <Globe className="w-3.5 h-3.5" />
                  <span>ADMINISTRATOR</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Central HQ Administrator (National oversight across all frontiers)
                </span>
              </button>
            </div>
          </div>

          {/* Officer Call Sign & Username */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                Officer Username / Callsign *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. cmdr_wagah, capt_arjun"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\\s+/g, '_') })}
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

          {/* Commander Specific Assignment: Frontier Sector and Checkpost */}
          {formData.role === 'COMMANDER' ? (
            <div className="space-y-4 p-3.5 bg-[#090d16]/80 border border-slate-800 rounded-xl">
              {/* Frontier Sector Selection / Inline Creation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Border Frontier Sector *
                  </label>
                  <div className="flex items-center gap-1 bg-[#111a2e] p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCustomSector(false)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                        !isCustomSector ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Select Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSector(true);
                        setIsCustomBop(true);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition flex items-center gap-1 ${
                        isCustomSector ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      New Frontier
                    </button>
                  </div>
                </div>

                {!isCustomSector ? (
                  <SectorSearchSelect
                    value={formData.sector || 'Punjab Frontier'}
                    onChange={(sec) => handleSectorChange(sec)}
                    placeholder="Search or select border sector..."
                    availableSectors={availableSectors}
                  />
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required={isCustomSector}
                      value={customSectorName}
                      onChange={(e) => {
                        setCustomSectorName(e.target.value);
                        handleSectorChange(e.target.value);
                      }}
                      placeholder="Enter new Frontier Sector Name (e.g. Sikkim Frontier, Baramulla Sector, Assam Command)..."
                      className="w-full px-3 py-2 bg-[#111a2e] border border-cyan-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Will automatically create and register this new Frontier Sector in the system database.
                    </div>
                  </div>
                )}
              </div>

              {/* Checkpost (BOP) Selection / Inline Creation */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    Duty Checkpost (BOP) *
                  </label>
                  <div className="flex items-center gap-1 bg-[#111a2e] p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCustomBop(false)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                        !isCustomBop ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Select Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomBop(true)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition flex items-center gap-1 ${
                        isCustomBop ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      New Checkpost
                    </button>
                  </div>
                </div>

                {!isCustomBop ? (
                  <CheckpostSearchSelect
                    value={formData.post_scope_id}
                    availableCheckposts={checkpostOptions}
                    onChange={(selectedPost) => {
                      setFormData((prev) => ({
                        ...prev,
                        post_scope_id: selectedPost.id,
                        post_scope_type: selectedPost.type || 'BOP',
                        sector: !isCustomSector ? (selectedPost.sector || prev.sector || 'Punjab Frontier') : prev.sector
                      }));
                      if (selectedPost.latitude && selectedPost.longitude) {
                        setCustomBopLat(selectedPost.latitude);
                        setCustomBopLng(selectedPost.longitude);
                      } else {
                        const coords = getSectorDefaults(selectedPost.sector || 'Punjab Frontier');
                        setCustomBopLat(coords.lat);
                        setCustomBopLng(coords.lng);
                      }
                      if (selectedPost.state) {
                        setCustomBopState(selectedPost.state);
                      }
                    }}
                  />
                ) : (
                  <div className="space-y-3 p-3 bg-[#0d1322] border border-emerald-500/30 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-300 font-bold">Checkpost / Post Name *</span>
                        <input
                          type="text"
                          required={isCustomBop}
                          value={customBopName}
                          onChange={(e) => handleCustomBopNameChange(e.target.value)}
                          placeholder="e.g. BOP Nathu La Peak, Post Falcon-1"
                          className="w-full px-3 py-2 bg-[#111a2e] border border-emerald-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-300 font-bold">Checkpost ID Code (Auto-generated) *</span>
                        <input
                          type="text"
                          required={isCustomBop}
                          value={customBopCode}
                          onChange={(e) => setCustomBopCode(e.target.value.toUpperCase())}
                          placeholder="e.g. BOP-NATHU-LA"
                          className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkpost Geographic Location & Tactical GPS Coordinates (ALWAYS REQUIRED FOR MAP VISIBILITY) */}
                <div className="p-3.5 bg-[#0b1220] border border-cyan-500/40 rounded-xl space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                      Checkpost Geographic Coordinates & Tactical Map Pin *
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      MAP PLACEMENT ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        GPS Latitude (°N) *
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={customBopLat}
                        onChange={(e) => setCustomBopLat(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 31.6048"
                        className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-cyan-300 font-bold font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        GPS Longitude (°E) *
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={customBopLng}
                        onChange={(e) => setCustomBopLng(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 74.5731"
                        className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-cyan-300 font-bold font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                        <Activity className="w-3 h-3 text-amber-400" />
                        Defense SLA Priority *
                      </span>
                      <select
                        value={customBopPriority}
                        onChange={(e) => setCustomBopPriority(e.target.value as any)}
                        className="w-full px-3 py-2 bg-[#111a2e] border border-slate-700 rounded-xl text-white font-mono cursor-pointer focus:outline-none focus:border-amber-400"
                      >
                        <option value="NORMAL">NORMAL SLA</option>
                        <option value="HIGH">HIGH SLA</option>
                        <option value="CRITICAL">CRITICAL SLA</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] font-mono pt-1 text-slate-400 gap-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      Pinpoint: {customBopLat.toFixed(4)}°N, {customBopLng.toFixed(4)}°E ({formData.sector || 'Border Frontier'})
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      ✓ Plotted & Visible on Tactical GIS Border Map
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-rose-400" />
                HQ Command Jurisdiction
              </label>
              <div className="p-2.5 bg-[#090d16] rounded-lg border border-slate-800 text-slate-200">
                <div className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  <span>Delhi Central HQ (National Command Central - All Sectors)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  National Central Administrators have full operational visibility across all frontiers, checkpoints, AI defense settings, and surveillance fleets.
                </div>
              </div>
            </div>
          )}

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
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
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
                  placeholder="Enter or generate password (min 4 characters)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111a2e] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 pr-10 font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {formData.password && (
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 flex items-center gap-1 cursor-pointer"
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
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold transition shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {saving ? 'Registering & Assigning...' : (formData.role === 'ADMIN' ? 'Appoint Administrator' : 'Assign Post & Register Commander')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
