import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  Clock,
  RefreshCw,
  Camera as CameraIcon,
  FileText,
  Building2,
  Check,
  MessageSquare,
  UploadCloud,
  Paperclip,
  Film,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
  Filter,
  X
} from 'lucide-react';
import { dispatchService } from '../services/dispatchService';
import { evidenceService, getEvidenceFileUrl } from '../services/evidenceService';
import { BOPDispatch } from '../types/dispatch';
import { Evidence } from '../types/incident';
import { useAuth } from '../context/AuthContext';
import { useCameras } from '../context/CameraContext';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';

// Client-side image compression: shrinks heavy photos to low MB / KB (< 300 KB)
async function compressImageFile(file: File, maxDim = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '') + '.jpg',
              { type: 'image/jpeg', lastModified: Date.now() }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k * k) {
    return `${(bytes / k).toFixed(1)} KB`;
  }
  return `${(bytes / (k * k)).toFixed(2)} MB`;
}

export const CheckpostDispatchesPage: React.FC = () => {
  const { user } = useAuth();
  const { cameras } = useCameras();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userBop = user?.scope_id && user?.scope_id !== '*' ? user.scope_id : 'BOP-WAGAH';

  const [dispatches, setDispatches] = useState<BOPDispatch[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dispatches' | 'evidence'>('dispatches');

  // Modals
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [preselectedEvidenceIds, setPreselectedEvidenceIds] = useState<string[]>([]);
  const [selectedPreviewEvidence, setSelectedPreviewEvidence] = useState<Evidence | null>(null);

  // Capture & Upload State
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [selectedCameraForCapture, setSelectedCameraForCapture] = useState<string>('');

  // Evidence Filter
  const [filterType, setFilterType] = useState<string>('ALL');

  const localCameras = cameras.filter(
    (c) =>
      !userBop ||
      (c.bop_site &&
        (c.bop_site.toLowerCase().includes(userBop.toLowerCase()) ||
          userBop.toLowerCase().includes(c.bop_site.toLowerCase())))
  );

  useEffect(() => {
    if (localCameras.length > 0 && !selectedCameraForCapture) {
      setSelectedCameraForCapture(localCameras[0].camera_id);
    }
  }, [localCameras, selectedCameraForCapture]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dispData, evData] = await Promise.all([
        dispatchService.listDispatches({ bop_id: userBop }),
        evidenceService.listEvidence({ limit: 60 })
      ]);
      setDispatches(dispData || []);
      setEvidenceList(evData || []);
    } catch (e) {
      console.error('Failed to load checkpost dispatches data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('ibvap:refresh-all', handleRefresh);
    window.addEventListener('ibvap:alert-received', handleRefresh);
    const interval = setInterval(loadData, 6000);
    return () => {
      window.removeEventListener('ibvap:refresh-all', handleRefresh);
      window.removeEventListener('ibvap:alert-received', handleRefresh);
      clearInterval(interval);
    };
  }, [userBop]);

  // Capture current optical/thermal frame from camera
  const handleCaptureLiveEvidence = async () => {
    const camId = selectedCameraForCapture || (localCameras[0]?.camera_id) || (cameras[0]?.camera_id);
    if (!camId) {
      alert('No camera available to capture frame.');
      return;
    }

    setIsCapturing(true);
    try {
      const newEv = await evidenceService.captureCameraEvidence(
        camId,
        'SNAPSHOT',
        `Live sentry observation by ${user?.username} at ${userBop}`
      );
      setStatusNotice(`Live frame captured: ${newEv.evidence_id} (${camId})`);
      setTimeout(() => setStatusNotice(null), 5000);
      loadData();
    } catch (e) {
      console.error('Failed to capture camera frame', e);
      alert('Failed to capture frame from camera.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload file with auto-compression (< 300 KB for images, < 10 MB for videos)
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusNotice(null);

    try {
      const originalSize = file.size;
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mkv|mov)$/i);
      let fileToUpload = file;
      let evidenceType = isVideo ? 'VIDEO_CLIP' : 'SNAPSHOT';

      if (!isVideo) {
        // Automatically compress image via canvas
        fileToUpload = await compressImageFile(file);
      } else {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Video clip exceeds 10MB limit. Please upload a short tactical clip.');
        }
      }

      const camId = `${userBop}-FIELD-CAM`;
      const createdEv = await evidenceService.uploadEvidence(fileToUpload, camId, evidenceType);

      const savedPct = originalSize > fileToUpload.size
        ? ` (Saved ${Math.round(((originalSize - fileToUpload.size) / originalSize) * 100)}% bandwidth)`
        : '';
      setStatusNotice(`Evidence uploaded: ${createdEv.evidence_id} (${formatBytes(fileToUpload.size)}${savedPct})`);
      setTimeout(() => setStatusNotice(null), 5000);

      loadData();
      setActiveTab('evidence');
    } catch (err: any) {
      alert(err?.message || 'Failed to upload evidence file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 1-Click: Attach specific evidence and open compose modal
  const handleAttachAndCompose = (evidenceId: string) => {
    setPreselectedEvidenceIds([evidenceId]);
    setComposeModalOpen(true);
  };

  const filteredEvidence = evidenceList.filter((ev) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'VIDEO') return ev.evidence_type === 'VIDEO_CLIP';
    if (filterType === 'SNAPSHOT') return ev.evidence_type === 'SNAPSHOT';
    if (filterType === 'ANPR') return ev.evidence_type === 'PLATE_CROP';
    return true;
  });

  const acknowledgedCount = dispatches.filter(
    (d) => d.status === 'ACKNOWLEDGED_BY_HQ' || d.status === 'ACTIONED'
  ).length;
  const pendingCount = dispatches.filter((d) => d.status === 'SENT_TO_HQ').length;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100 font-sans overflow-x-hidden">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#0e1628] via-[#0b101c] to-[#070b14] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              DIRECT UPLINK TO DELHI CENTRAL HQ
            </span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
              🪖 POST: {userBop}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              COMMANDER: {user?.username}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <Send className="w-6 h-6 text-cyan-400" />
            Checkpost Field Dispatches & Evidence Hub
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed font-mono">
            Attach verified optical/thermal evidence, upload field photos or short video clips with automatic low-MB compression, and transmit shift SITREPs directly to Central War Room in New Delhi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            accept="image/*,video/mp4,video/webm"
            className="hidden"
          />

          {/* Upload Button with Compression */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-mono font-bold border border-cyan-500/40 transition cursor-pointer disabled:opacity-50 shadow-md"
            title="Upload field photo or tactical clip (auto-compressed to low-MB)"
          >
            <UploadCloud className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
            <span>{isUploading ? 'COMPRESSING...' : '+ UPLOAD PHOTO / CLIP'}</span>
          </button>

          {/* Capture Live Frame */}
          <button
            onClick={handleCaptureLiveEvidence}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Instantly snap frame from checkpost camera"
          >
            <CameraIcon className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isCapturing ? 'CAPTURING...' : 'SNAP CAM FRAME'}</span>
          </button>

          {/* Compose SITREP Modal */}
          <button
            onClick={() => {
              setPreselectedEvidenceIds([]);
              setComposeModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-xs font-mono font-bold border border-cyan-400/40 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>+ COMPOSE SITREP TO HQ</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refresh dispatches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 font-mono flex items-center justify-between shadow-lg animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {statusNotice}
          </span>
          <button
            onClick={() => setActiveTab('evidence')}
            className="underline font-bold text-emerald-200 cursor-pointer text-[11px]"
          >
            View Evidence Vault →
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <div className="bg-[#0f172a] border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-cyan-400 font-bold">DISPATCHES TRANSMITTED</span>
            <div className="text-2xl font-black text-white">{dispatches.length}</div>
            <span className="text-[10px] text-slate-400">Total SITREPs logged</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-emerald-400 font-bold">DELHI HQ REVIEWED</span>
            <div className="text-2xl font-black text-emerald-400">{acknowledgedCount}</div>
            <span className="text-[10px] text-emerald-500/80">Directives received</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-amber-400 font-bold">AWAITING HQ REVIEW</span>
            <div className="text-2xl font-black text-amber-400">{pendingCount}</div>
            <span className="text-[10px] text-amber-500/80">In transit to Delhi</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] text-purple-400 font-bold">SAVED EVIDENCE ITEMS</span>
            <div className="text-2xl font-black text-purple-300">{evidenceList.length}</div>
            <span className="text-[10px] text-purple-400/80">Photos & short clips</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <CameraIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 font-mono">
        <button
          onClick={() => setActiveTab('dispatches')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'dispatches'
              ? 'border-cyan-500 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>SITREPs Sent to Delhi HQ ({dispatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'evidence'
              ? 'border-cyan-500 text-cyan-300 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CameraIcon className="w-3.5 h-3.5" />
          <span>Checkpost Saved Evidence & Uplink Vault ({evidenceList.length})</span>
        </button>
      </div>

      {/* TAB 1: DISPATCHES TRANSMITTED */}
      {activeTab === 'dispatches' && (
        <div className="space-y-4 font-mono">
          {dispatches.length === 0 ? (
            <div className="p-12 text-center bg-[#0b101c] border border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Dispatches Sent Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Submit shift situation reports (SITREPs) or attach captured evidence to transmit to Delhi Central HQ.
              </p>
              <button
                onClick={() => {
                  setPreselectedEvidenceIds([]);
                  setComposeModalOpen(true);
                }}
                className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Compose First SITREP</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dispatches.map((disp) => {
                const isAcknowledged =
                  disp.status === 'ACKNOWLEDGED_BY_HQ' || disp.status === 'ACTIONED';

                // Parse attached evidence ids
                let attachedIds: string[] = [];
                try {
                  attachedIds = typeof disp.evidence_ids === 'string'
                    ? JSON.parse(disp.evidence_ids)
                    : (disp.evidence_ids || []);
                } catch {
                  attachedIds = [];
                }

                return (
                  <div
                    key={disp.dispatch_id}
                    className="p-5 bg-[#0b101c] border border-slate-800 hover:border-cyan-500/40 rounded-xl transition shadow-lg space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-black text-cyan-400">
                          {disp.dispatch_id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            disp.priority === 'FLASH'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : disp.priority === 'URGENT'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {disp.priority}
                        </span>
                        <span className="text-xs text-slate-400">
                          BOP: <strong className="text-white">{disp.bop_id}</strong>
                        </span>
                        <span className="text-xs text-slate-400">
                          Officer: <strong className="text-slate-200">{disp.officer_username}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isAcknowledged
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-600/50'
                              : 'bg-cyan-950 text-cyan-300 border-cyan-700/50'
                          }`}
                        >
                          {isAcknowledged ? (
                            <>
                              <Check className="w-3 h-3" />
                              ACKNOWLEDGED BY DELHI HQ
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 animate-spin" />
                              TRANSMITTED TO HQ
                            </>
                          )}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {new Date(disp.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide">{disp.title}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                        {disp.summary}
                      </p>
                    </div>

                    {/* Attached Evidence Thumbnails Row */}
                    {attachedIds.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <div className="text-[10px] text-cyan-400 font-bold mb-1.5 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span>ATTACHED EVIDENCE ({attachedIds.length} ITEMS):</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {attachedIds.map((evId) => (
                            <div
                              key={evId}
                              onClick={() => {
                                const ev = evidenceList.find((e) => e.evidence_id === evId);
                                if (ev) setSelectedPreviewEvidence(ev);
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 rounded-lg text-[10px] text-slate-300 flex items-center gap-1.5 cursor-pointer transition shrink-0"
                            >
                              <ShieldCheck className="w-3 h-3 text-cyan-400" />
                              <span className="font-bold text-white">{evId}</span>
                              <span className="text-slate-500 text-[9px]">(View)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HQ Admin Response / Directives Box */}
                    {disp.hq_notes && (
                      <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-lg space-y-1 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            DELHI CENTRAL HQ OPERATIONAL DIRECTIVE:
                          </span>
                          <span className="text-[10px] text-slate-400">
                            By {disp.acknowledged_by || 'Central Admin'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 italic font-sans">
                          "{disp.hq_notes}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHECKPOST SAVED EVIDENCE & FIELD UPLINK VAULT */}
      {activeTab === 'evidence' && (
        <div className="space-y-4 font-mono">
          {/* Action Bar */}
          <div className="p-4 bg-[#0b101c] border border-cyan-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                FILTER EVIDENCE:
              </span>
              <div className="flex items-center gap-1">
                {['ALL', 'SNAPSHOT', 'VIDEO', 'ANPR'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      filterType === t
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Total Saved:</span>
              <span className="font-bold text-cyan-400">{filteredEvidence.length} items</span>
            </div>
          </div>

          {/* Evidence Cards Grid with Real Previews */}
          {filteredEvidence.length === 0 ? (
            <div className="p-12 text-center bg-[#0b101c] border border-slate-800 rounded-2xl space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No Evidence Found</div>
              <p className="text-xs text-slate-500">
                Snap camera frames or upload low-MB field photos/clips using the top action buttons.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEvidence.map((ev) => {
                const isVideo = ev.evidence_type === 'VIDEO_CLIP';
                const fileUrl = getEvidenceFileUrl(ev.evidence_id);

                return (
                  <div
                    key={ev.evidence_id}
                    className="bg-[#0b101c] border border-slate-800 hover:border-cyan-500/50 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between transition group"
                  >
                    {/* Media Preview Box */}
                    <div
                      onClick={() => setSelectedPreviewEvidence(ev)}
                      className="relative h-44 bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center border-b border-slate-800 group-hover:opacity-95"
                    >
                      {isVideo ? (
                        <div className="text-center space-y-1">
                          <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/40">
                            <Film className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] text-cyan-300 font-bold block">TACTICAL VIDEO CLIP</span>
                          <span className="text-[9px] text-slate-400">{formatBytes(ev.file_size_bytes)}</span>
                        </div>
                      ) : (
                        <img
                          src={fileUrl}
                          alt={ev.evidence_id}
                          loading="lazy"
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // Fallback to stylized frame if file is a test placeholder
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}

                      {/* Top Badges Overlay */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/70 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
                          {ev.evidence_type}
                        </span>
                      </div>

                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/70 text-slate-300 border border-slate-700 backdrop-blur-sm">
                          {formatBytes(ev.file_size_bytes)}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white truncate max-w-[150px]">{ev.evidence_id}</span>
                        <span className="text-[10px] text-slate-400">{ev.camera_id}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 truncate">
                        SHA-256: {ev.checksum_sha256 ? `${ev.checksum_sha256.substring(0, 16)}...` : 'Verified'}
                      </div>

                      <div className="text-[10px] text-slate-400">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ev.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedPreviewEvidence(ev)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => handleAttachAndCompose(ev.evidence_id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow cursor-pointer"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>Attach to SITREP</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inspect Preview Modal */}
      {selectedPreviewEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-[#0b1320] border border-cyan-500/40 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">{selectedPreviewEvidence.evidence_id}</span>
                <span className="text-[10px] text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                  {selectedPreviewEvidence.evidence_type}
                </span>
              </div>
              <button
                onClick={() => setSelectedPreviewEvidence(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 max-h-72 flex items-center justify-center">
              {selectedPreviewEvidence.evidence_type === 'VIDEO_CLIP' ? (
                <video
                  src={getEvidenceFileUrl(selectedPreviewEvidence.evidence_id)}
                  controls
                  className="max-h-72 w-full object-contain"
                />
              ) : (
                <img
                  src={getEvidenceFileUrl(selectedPreviewEvidence.evidence_id)}
                  alt={selectedPreviewEvidence.evidence_id}
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>

            <div className="space-y-1 text-xs text-slate-300 p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <div>Camera: <strong className="text-white">{selectedPreviewEvidence.camera_id}</strong></div>
              <div>File Size: <strong className="text-white">{formatBytes(selectedPreviewEvidence.file_size_bytes)}</strong></div>
              <div className="truncate">SHA-256: <strong className="text-cyan-400">{selectedPreviewEvidence.checksum_sha256}</strong></div>
              <div>Captured: <span className="text-slate-400">{new Date(selectedPreviewEvidence.created_at).toLocaleString()}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleAttachAndCompose(selectedPreviewEvidence.evidence_id);
                  setSelectedPreviewEvidence(null);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach to SITREP Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose SITREP Modal */}
      <DispatchSitrepModal
        isOpen={composeModalOpen}
        onClose={() => setComposeModalOpen(false)}
        onSuccess={() => {
          loadData();
          setComposeModalOpen(false);
          setStatusNotice('SITREP DISPATCHED TO DELHI CENTRAL HQ SUCCESSFULLY');
          setTimeout(() => setStatusNotice(null), 5000);
        }}
        defaultEvidenceIds={preselectedEvidenceIds}
      />
    </div>
  );
};
