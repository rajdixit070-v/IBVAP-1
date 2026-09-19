import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  X,
  FolderLock,
  Copy,
  Check,
  Camera as CameraIcon,
  Search,
  Printer,
  Lock,
  AlertCircle
} from 'lucide-react';
import { Evidence } from '../types/incident';
import { evidenceService, getEvidenceFileUrl } from '../services/evidenceService';
import { useCameras } from '../context/CameraContext';

interface ForensicEvidencePageProps {}

export type OperationalEvidenceType = 'ALL' | 'PERSON' | 'VEHICLE' | 'BREACH' | 'DRONE';

export const ForensicEvidencePage: React.FC<ForensicEvidencePageProps> = () => {
  const { cameras } = useCameras();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search: purely operational types
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<OperationalEvidenceType>('ALL');

  // Full-screen Inspection
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Capture Live Evidence State
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [captureCamId, setCaptureCamId] = useState<string>('');
  const [captureType, setCaptureType] = useState<string>('SUSPECT_PERSON');
  const [captureNotes, setCaptureNotes] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    if (cameras.length > 0 && !captureCamId) {
      setCaptureCamId(cameras[0].camera_id);
    }
  }, [cameras]);

  useEffect(() => {
    loadEvidence();
    const handleRefresh = () => {
      loadEvidence();
    };
    window.addEventListener('ibvap:refresh-all', handleRefresh);
    window.addEventListener('ibvap:alert-received', handleRefresh);
    const interval = setInterval(loadEvidence, 6000);
    return () => {
      window.removeEventListener('ibvap:refresh-all', handleRefresh);
      window.removeEventListener('ibvap:alert-received', handleRefresh);
      clearInterval(interval);
    };
  }, [selectedCamera]);

  const loadEvidence = async () => {
    try {
      const data = await evidenceService.listEvidence({
        camera_id: selectedCamera === 'ALL' ? undefined : selectedCamera,
        limit: 150
      });
      setEvidenceList(data || []);
    } catch (e) {
      console.error('Failed to load evidence repository', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleExecuteCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureCamId) {
      setCaptureError('Please select a camera to capture live frame from.');
      return;
    }
    try {
      setIsCapturing(true);
      setCaptureError(null);
      await evidenceService.captureCameraEvidence(captureCamId, captureType, captureNotes);
      await loadEvidence();
      setCaptureModalOpen(false);
      setCaptureNotes('');
    } catch (err: any) {
      console.error('Failed to capture live camera evidence', err);
      setCaptureError(err?.response?.data?.detail || err.message || 'Failed to capture live evidence frame.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePrintDossier = () => {
    window.print();
  };

  // Filtered evidence calculation based on admin operational categories
  const filteredEvidence = useMemo(() => {
    return evidenceList.filter((ev) => {
      // Search matching
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchId = ev.evidence_id.toLowerCase().includes(query);
        const matchCam = ev.camera_id.toLowerCase().includes(query);
        const matchType = ev.evidence_type.toLowerCase().includes(query);
        const matchHash = (ev.checksum_sha256 || '').toLowerCase().includes(query);
        if (!matchId && !matchCam && !matchType && !matchHash) return false;
      }

      // Operational Type Filter
      if (selectedType === 'PERSON') {
        const type = ev.evidence_type.toUpperCase();
        if (!type.includes('PERSON') && !type.includes('FACE')) return false;
      } else if (selectedType === 'VEHICLE') {
        const type = ev.evidence_type.toUpperCase();
        if (!type.includes('VEHICLE') && !type.includes('PLATE')) return false;
      } else if (selectedType === 'BREACH') {
        const type = ev.evidence_type.toUpperCase();
        if (!type.includes('BREACH') && !type.includes('INTRUSION')) return false;
      } else if (selectedType === 'DRONE') {
        const type = ev.evidence_type.toUpperCase();
        if (!type.includes('DRONE') && !type.includes('CONTRABAND') && !type.includes('AIR')) return false;
      }

      return true;
    });
  }, [evidenceList, searchQuery, selectedType]);

  const contributingCamerasCount = useMemo(() => {
    return new Set(evidenceList.map((e) => e.camera_id)).size;
  }, [evidenceList]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-h-screen bg-[#070b14] text-slate-100 font-sans max-w-full overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0d1527] via-[#090e1a] to-[#070b14] border border-[#1e293b] rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-cyan-400" />
              TAMPER-PROOF FORENSIC REPOSITORY
            </span>
            <span className="text-slate-400 font-mono text-xs">• SHA-256 CHAIN OF CUSTODY</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-purple-950/70 text-purple-300 border-purple-600/50">
              🏢 DELHI HQ CENTRAL CUSTODY
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <FolderLock className="w-6 h-6 text-cyan-400" />
            National AI Evidence Vault (Legal Forensic Archive)
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed font-mono">
            Cryptographically sealed repository of high-resolution intrusion snapshots, ANPR license plates, facial matches, and intercepted perimeter activities. All records are legally immutable with SHA-256 provenance for court and inquiry verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setCaptureError(null);
              setCaptureModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold border border-emerald-400/40 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            title="Instantly capture and seal a high-resolution frame from any active border stream"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            <span>CAPTURE LIVE EVIDENCE</span>
          </button>

          <button
            onClick={loadEvidence}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#111a2e] hover:bg-[#16223d] text-slate-300 hover:text-white rounded-xl text-xs font-mono border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>REFRESH VAULT</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <div className="bg-[#111a2e] border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-cyan-400 font-bold">TOTAL SECURED RECORDS</span>
            <div className="text-2xl font-black text-cyan-400">{evidenceList.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FolderLock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-emerald-400 font-bold">CRYPTOGRAPHIC INTEGRITY</span>
            <div className="text-2xl font-black text-emerald-400">100% VERIFIED</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-sky-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-sky-400 font-bold">CONTRIBUTING SENSORS</span>
            <div className="text-2xl font-black text-sky-400">{contributingCamerasCount} CAMERAS</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <CameraIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-purple-400 font-bold">LEGAL CUSTODY STATUS</span>
            <div className="text-base font-black text-purple-300">TAMPER-PROOF LOCK</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0d1322] border border-[#1e293b] p-4 rounded-xl space-y-3 font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Evidence ID, Camera, Hash, or Notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          {/* Sensor & Type Selectors (Clean operational dropdown) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>SENSOR:</span>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="bg-[#111a2e] border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">ALL CAMERAS</option>
                {cameras.map((c) => (
                  <option key={c.camera_id} value={c.camera_id}>
                    {c.camera_name} ({c.camera_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>TYPE:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as OperationalEvidenceType)}
                className="bg-[#111a2e] border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">ALL TYPES (ALL INTERCEPTIONS)</option>
                <option value="PERSON">👤 SUSPECT PERSONS / INTRUDERS</option>
                <option value="VEHICLE">🚗 VEHICLES & ANPR</option>
                <option value="BREACH">🚨 PERIMETER BREACH / FENCE</option>
                <option value="DRONE">🛸 DRONES & AIRDROPS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Category Pills */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 mr-1 uppercase">QUICK CLASSIFICATION:</span>
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedType === 'ALL'
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              ALL ({evidenceList.length})
            </button>
            <button
              onClick={() => setSelectedType('PERSON')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedType === 'PERSON'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              👤 SUSPECT PERSONS
            </button>
            <button
              onClick={() => setSelectedType('VEHICLE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedType === 'VEHICLE'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              🚗 VEHICLES & ANPR
            </button>
            <button
              onClick={() => setSelectedType('BREACH')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedType === 'BREACH'
                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              🚨 FENCE BREACHES
            </button>
            <button
              onClick={() => setSelectedType('DRONE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedType === 'DRONE'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              🛸 DRONE / AIRDROPS
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            SHOWING <strong className="text-cyan-400">{filteredEvidence.length}</strong> OF {evidenceList.length} SECURED DOSSIER(S)
          </div>
        </div>
      </div>

      {/* Evidence Gallery Grid */}
      {loading && evidenceList.length === 0 ? (
        <div className="py-20 text-center space-y-2 font-mono">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p className="text-xs text-slate-500">Querying cryptographic evidence vault...</p>
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div className="bg-[#0b101d] border border-dashed border-slate-800 rounded-2xl py-16 px-4 text-center space-y-3 font-mono">
          <FolderLock className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
          <div className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            NO MATCHING FORENSIC EVIDENCE FOUND
          </div>
          <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
            No records matched your selected category. As soon as perimeter threats or intruders are detected across border sensors, authenticated SHA-256 snapshots will populate here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredEvidence.map((ev) => {
            const fileUrl = getEvidenceFileUrl(ev.evidence_id);
            return (
              <div
                key={ev.evidence_id}
                className="bg-[#0b101d] border border-[#1e293b] hover:border-cyan-500/50 rounded-xl overflow-hidden transition shadow-lg group flex flex-col justify-between"
              >
                {/* Snapshot Image Container */}
                <div
                  onClick={() => setSelectedEvidence(ev)}
                  className="relative h-44 bg-black/60 cursor-pointer overflow-hidden group"
                >
                  <img
                    src={fileUrl}
                    alt={ev.evidence_id}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b101d] via-transparent to-transparent opacity-80" />

                  {/* Evidence Type Badge */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 text-[9px] font-mono font-bold uppercase backdrop-blur">
                    {ev.evidence_type}
                  </span>

                  {/* Tamper-Proof Seal Pill */}
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[9px] font-mono font-bold uppercase backdrop-blur flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    IMMUTABLE
                  </span>

                  {/* Expand icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                    <span className="p-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-lg">
                      <Eye className="w-5 h-5" />
                    </span>
                  </div>
                </div>

                {/* Evidence Metadata */}
                <div className="p-3.5 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white tracking-wider truncate">
                      {ev.evidence_id}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800">
                      {ev.camera_id}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{new Date(ev.created_at).toLocaleString()}</span>
                  </div>

                  {/* SHA-256 Checksum Pill */}
                  <div className="bg-[#070b14] p-1.5 rounded border border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 truncate" title={ev.checksum_sha256}>
                      SHA: <strong className="text-emerald-400 font-mono">{ev.checksum_sha256 ? ev.checksum_sha256.substring(0, 14) + '...' : 'GENUINE'}</strong>
                    </span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2 border-t border-slate-800/80">
                    <button
                      onClick={() => setSelectedEvidence(ev)}
                      className="flex-1 py-1.5 bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-300 hover:text-white rounded-lg text-[10px] font-bold border border-cyan-500/30 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> INSPECT DOSSIER
                    </button>
                    <a
                      href={fileUrl}
                      download={`${ev.evidence_id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                      title="Download Certified Evidence File"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>PROOF</span>
                    </a>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Forensic Full-Screen Inspection Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b101d] border border-cyan-500/40 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4 font-mono">
            {/* Modal Header */}
            <div className="p-4 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                    <span>{selectedEvidence.evidence_id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      LEGAL FORENSIC RECORD
                    </span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    CENTRAL CUSTODY DOSSIER // CAMERA SENSOR {selectedEvidence.camera_id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-Resolution Evidence Preview */}
            <div className="p-4 space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black max-h-[58vh] flex items-center justify-center">
                <img
                  src={getEvidenceFileUrl(selectedEvidence.evidence_id)}
                  alt={selectedEvidence.evidence_id}
                  className="max-h-[56vh] w-auto object-contain"
                />
              </div>

              {/* Integrity & Metadata Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-[#070b14] p-3.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">CAPTURE TIMESTAMP</span>
                  <span className="text-slate-200 font-bold">{new Date(selectedEvidence.created_at).toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">ORIGINATING SENSOR</span>
                  <span className="text-cyan-400 font-bold">{selectedEvidence.camera_id}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">CUSTODY STATUS</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> IMMUTABLE ARCHIVE
                  </span>
                </div>
                <div className="col-span-1 md:col-span-3 space-y-1 border-t border-slate-800/80 pt-2">
                  <span className="text-[10px] text-slate-500 block uppercase">CRYPTOGRAPHIC SHA-256 HASH (CHAIN OF CUSTODY)</span>
                  <div className="flex items-center gap-2 bg-[#090d16] p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-mono text-[11px] break-all flex-1">
                      {selectedEvidence.checksum_sha256 || 'UNMODIFIED CERTIFIED RECORD'}
                    </span>
                    {selectedEvidence.checksum_sha256 && (
                      <button
                        onClick={() => handleCopyHash(selectedEvidence.checksum_sha256)}
                        className="p-1 text-slate-400 hover:text-white transition rounded shrink-0 cursor-pointer"
                        title="Copy SHA-256 Hash"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={handlePrintDossier}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="Print official forensic proof sheet for court / inquiry"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  <span>PRINT / EXPORT DOSSIER</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedEvidence(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 transition cursor-pointer"
                  >
                    CLOSE
                  </button>
                  <a
                    href={getEvidenceFileUrl(selectedEvidence.evidence_id)}
                    download={`${selectedEvidence.evidence_id}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition shadow-lg shadow-cyan-600/20 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> DOWNLOAD EVIDENCE PROOF
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capture Live Evidence Modal */}
      {captureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn font-mono">
          <div className="bg-[#0c121e] border border-cyan-500/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-5 bg-gradient-to-r from-[#111a2e] to-[#0c121e] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CameraIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">Capture Live Camera Evidence</h3>
                  <p className="text-[11px] text-slate-400">Grab instant frame & seal with SHA-256 in Central Vault</p>
                </div>
              </div>
              <button
                onClick={() => setCaptureModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCapture} className="p-5 space-y-4 text-xs">
              {captureError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{captureError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1.5 font-semibold">
                  SELECT CAMERA STREAM:
                </label>
                <select
                  value={captureCamId}
                  onChange={(e) => setCaptureCamId(e.target.value)}
                  required
                  className="w-full bg-[#111a2e] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {cameras.map((c) => (
                    <option key={c.camera_id} value={c.camera_id}>
                      {c.camera_name} ({c.camera_id}) - {c.bop_site}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1.5 font-semibold">
                  EVIDENCE CLASSIFICATION:
                </label>
                <select
                  value={captureType}
                  onChange={(e) => setCaptureType(e.target.value)}
                  className="w-full bg-[#111a2e] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="SUSPECT_PERSON">SUSPECT PERSON (INTRUDER / SUSPECT)</option>
                  <option value="SUSPECT_VEHICLE">SUSPECT VEHICLE (ANPR / TRANSPORT)</option>
                  <option value="PERIMETER_BREACH">PERIMETER BREACH (FENCE CROSSING)</option>
                  <option value="CONTRABAND_DROP">DRONE SIGHTING / AIRDROP</option>
                  <option value="SNAPSHOT">TACTICAL SCENE SNAPSHOT (GENERAL)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1.5 font-semibold">
                  OFFICER NOTES / TACTICAL REMARKS (OPTIONAL):
                </label>
                <textarea
                  value={captureNotes}
                  onChange={(e) => setCaptureNotes(e.target.value)}
                  placeholder="E.g., Suspect observed carrying package near boundary pillar 104..."
                  rows={2}
                  className="w-full bg-[#111a2e] border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCaptureModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isCapturing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {isCapturing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>SEALING EVIDENCE...</span>
                    </>
                  ) : (
                    <>
                      <CameraIcon className="w-4 h-4" />
                      <span>CAPTURE & SEAL NOW</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
