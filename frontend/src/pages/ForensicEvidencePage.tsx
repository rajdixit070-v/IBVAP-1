import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { Evidence } from '../types/incident';
import { evidenceService } from '../services/evidenceService';
import { useCameras } from '../context/CameraContext';

export const ForensicEvidencePage: React.FC = () => {
  const { cameras } = useCameras();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    loadEvidence();
    const interval = setInterval(loadEvidence, 5000);
    return () => clearInterval(interval);
  }, [selectedCamera, selectedType]);

  const loadEvidence = async () => {
    try {
      const data = await evidenceService.listEvidence({
        camera_id: selectedCamera === 'ALL' ? undefined : selectedCamera,
        evidence_type: selectedType === 'ALL' ? undefined : selectedType,
        limit: 100
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

  const handleDeleteEvidence = async (e: React.MouseEvent, evidenceId: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete evidence snapshot '${evidenceId}'?`)) {
      try {
        await evidenceService.deleteEvidence(evidenceId);
        setEvidenceList((prev) => prev.filter((item) => item.evidence_id !== evidenceId));
        if (selectedEvidence?.evidence_id === evidenceId) {
          setSelectedEvidence(null);
        }
      } catch (err) {
        console.error('Failed to delete evidence item', err);
      }
    }
  };

  const handleClearAllEvidence = async () => {
    const scope = selectedCamera === 'ALL' ? 'all cameras' : `camera '${selectedCamera}'`;
    if (window.confirm(`Are you sure you want to permanently delete all archived evidence snapshots for ${scope}?`)) {
      try {
        await evidenceService.clearAllEvidence(selectedCamera === 'ALL' ? undefined : selectedCamera);
        loadEvidence();
      } catch (err) {
        console.error('Failed to clear evidence vault', err);
      }
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#070b14] text-slate-100 font-sans">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0d1527] via-[#090e1a] to-[#070b14] border border-[#1e293b] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30">
              TAMPER-EVIDENT FORENSIC REPOSITORY
            </span>
            <span className="text-slate-400 font-mono text-xs">• SHA-256 CHAIN OF CUSTODY</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <FolderLock className="w-6 h-6 text-cyan-400" />
            Tactical AI Evidence Vault
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed font-mono">
            Cryptographically sealed visual proof of all intercepted persons, intruders, suspect vehicles, and perimeter targets for military and court-admissible prosecution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {evidenceList.length > 0 && (
            <button
              onClick={handleClearAllEvidence}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white rounded-xl text-xs font-mono border border-rose-500/40 transition cursor-pointer"
              title="Delete All Evidence Records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR VAULT
            </button>
          )}
          <button
            onClick={loadEvidence}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#111a2e] hover:bg-[#16223d] text-slate-300 hover:text-white rounded-xl text-xs font-mono border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            REFRESH VAULT
          </button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d1322] border border-[#1e293b] p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>SENSOR:</span>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="bg-[#111a2e] border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">ALL CAMERAS</option>
              {cameras.map((c) => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_name} ({c.camera_id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>TYPE:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-[#111a2e] border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="SNAPSHOT">SNAPSHOT (FULL FRAME)</option>
              <option value="FACE_CROP">FACE CROP</option>
              <option value="PLATE_CROP">PLATE CROP</option>
              <option value="VIDEO_CLIP">VIDEO CLIP</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          ARCHIVED EVIDENCE: <strong className="text-cyan-400">{evidenceList.length}</strong> RECORD(S)
        </div>
      </div>

      {/* Evidence Gallery Grid */}
      {loading && evidenceList.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p className="text-xs font-mono text-slate-500">Querying cryptographic evidence vault...</p>
        </div>
      ) : evidenceList.length === 0 ? (
        <div className="bg-[#0b101d] border border-dashed border-slate-800 rounded-2xl py-16 px-4 text-center space-y-3">
          <FolderLock className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
          <div className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
            EVIDENCE VAULT READY • NO INTERCEPTIONS RECORDED
          </div>
          <p className="text-xs font-mono text-slate-500 max-w-lg mx-auto leading-relaxed">
            As soon as an unknown person, intruder, suspect vehicle, or object is detected by the AI pipeline across your cameras, a full-frame forensic JPEG snapshot with SHA-256 checksum and bounding boxes will be securely stored here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {evidenceList.map((ev) => {
            const fileUrl = `/api/v1/evidence/${ev.evidence_id}/file`;
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
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono font-bold uppercase backdrop-blur">
                    {ev.evidence_type}
                  </span>

                  {/* Expand icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                    <span className="p-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50">
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
                      <Eye className="w-3 h-3" /> INSPECT
                    </button>
                    <a
                      href={fileUrl}
                      download={`${ev.evidence_id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
                      title="Download Evidence Snapshot"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={(e) => handleDeleteEvidence(e, ev.evidence_id)}
                      className="p-1.5 bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-white rounded-lg border border-rose-500/30 transition cursor-pointer"
                      title="Delete Evidence Snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Forensic Full-Screen Inspection Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0b101d] border border-cyan-500/40 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="p-4 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider">
                    {selectedEvidence.evidence_id}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    TAMPER-PROOF FORENSIC DOSSIER // CAMERA {selectedEvidence.camera_id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-Resolution Evidence Preview */}
            <div className="p-4 space-y-4 font-mono">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black max-h-[60vh] flex items-center justify-center">
                <img
                  src={`/api/v1/evidence/${selectedEvidence.evidence_id}/file`}
                  alt={selectedEvidence.evidence_id}
                  className="max-h-[58vh] w-auto object-contain"
                />
              </div>

              {/* Integrity & Metadata Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#070b14] p-3.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">CAPTURE TIMESTAMP</span>
                  <span className="text-slate-200 font-bold">{new Date(selectedEvidence.created_at).toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">ORIGINATING SENSOR</span>
                  <span className="text-cyan-400 font-bold">{selectedEvidence.camera_id}</span>
                </div>
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">CRYPTOGRAPHIC SHA-256 HASH (TAMPER-EVIDENT)</span>
                  <div className="flex items-center gap-2 bg-[#090d16] p-2 rounded border border-slate-800">
                    <span className="text-emerald-400 font-mono text-[11px] break-all flex-1">
                      {selectedEvidence.checksum_sha256 || 'UNMODIFIED FORENSIC RECORD'}
                    </span>
                    {selectedEvidence.checksum_sha256 && (
                      <button
                        onClick={() => handleCopyHash(selectedEvidence.checksum_sha256)}
                        className="p-1 text-slate-400 hover:text-white transition rounded shrink-0"
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
                  onClick={(e) => handleDeleteEvidence(e, selectedEvidence.evidence_id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> DELETE EVIDENCE
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedEvidence(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 transition cursor-pointer"
                  >
                    CLOSE
                  </button>
                  <a
                    href={`/api/v1/evidence/${selectedEvidence.evidence_id}/file`}
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
    </div>
  );
};
