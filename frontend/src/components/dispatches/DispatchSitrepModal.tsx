import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  X,
  Paperclip,
  UploadCloud,
  Check
} from 'lucide-react';

import { dispatchService } from '../../services/dispatchService';
import { evidenceService } from '../../services/evidenceService';
import { BOPDispatchCreateInput } from '../../types/dispatch';
import { Evidence } from '../../types/incident';
import { useAuth } from '../../context/AuthContext';

interface DispatchSitrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEvidenceIds?: string[];
  initialTitle?: string;
  initialSummary?: string;
  initialPriority?: string;
}

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

export const DispatchSitrepModal: React.FC<DispatchSitrepModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEvidenceIds = [],
  initialTitle = '',
  initialSummary = '',
  initialPriority = 'IMPORTANT'
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [priority, setPriority] = useState<string>(initialPriority);
  const [personsCount, setPersonsCount] = useState<number>(1);
  const [vehiclesCount, setVehiclesCount] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(1);

  // Evidence Attachment State
  const [attachedEvidenceIds, setAttachedEvidenceIds] = useState<string[]>([]);
  const [availableEvidence, setAvailableEvidence] = useState<Evidence[]>([]);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAttachedEvidenceIds(defaultEvidenceIds || []);
      if (initialTitle) setTitle(initialTitle);
      if (initialSummary) setSummary(initialSummary);
      if (initialPriority) setPriority(initialPriority);
      loadCheckpostEvidence();
    }
  }, [isOpen, defaultEvidenceIds, initialTitle, initialSummary, initialPriority]);

  const loadCheckpostEvidence = async () => {
    try {
      const data = await evidenceService.listEvidence({ limit: 40 });
      setAvailableEvidence(data || []);
    } catch (e) {
      console.error('Failed to load checkpost evidence for modal', e);
    }
  };

  if (!isOpen) return null;

  const toggleAttachId = (id: string) => {
    setAttachedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadNotice(null);
    setError(null);

    try {
      const originalSize = file.size;
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mkv|mov)$/i);
      let fileToUpload = file;
      let evidenceType = isVideo ? 'VIDEO_CLIP' : 'SNAPSHOT';

      if (!isVideo) {
        // Compress image via canvas
        fileToUpload = await compressImageFile(file);
      } else {
        // Video file check (< 10 MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Video clip exceeds 10MB limit. Please upload a short tactical clip.');
        }
      }

      const cameraId = user?.scope_id ? `${user.scope_id}-CAM` : 'FIELD-UPLOAD';
      const createdEv = await evidenceService.uploadEvidence(fileToUpload, cameraId, evidenceType);

      // Add to available evidence and attach immediately
      setAvailableEvidence((prev) => [createdEv, ...prev]);
      setAttachedEvidenceIds((prev) => [...prev, createdEv.evidence_id]);

      const savedPct = originalSize > fileToUpload.size
        ? ` (Saved ${Math.round(((originalSize - fileToUpload.size) / originalSize) * 100)}% bandwidth)`
        : '';
      setUploadNotice(`Evidence attached: ${formatBytes(fileToUpload.size)}${savedPct}`);
      setTimeout(() => setUploadNotice(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload and attach evidence file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('Please provide a title and detailed shift summary.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const payload: BOPDispatchCreateInput = {
        title,
        summary,
        bop_id: user?.scope_id && user?.scope_id !== '*' ? user.scope_id : 'BOP-ALPHA',
        priority,
        detected_persons_count: Number(personsCount),
        vehicles_scanned_count: Number(vehiclesCount),
        alerts_count: Number(alertsCount),
        evidence_ids: attachedEvidenceIds
      };

      await dispatchService.createDispatch(payload);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to dispatch SITREP to HQ.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-[#0b1320] border border-cyan-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-cyan-950/50 my-6">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e293b] bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Transmit Field SITREP & Evidence to Delhi HQ
              </h3>
              <p className="text-[11px] text-cyan-400/80 font-mono">
                Checkpost: <strong className="text-white">{user?.scope_id || 'BOP-WAGAH'}</strong> • Commander: {user?.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-pulse">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white font-mono">SITREP & Evidence Dispatched to Delhi HQ</h4>
            <p className="text-xs text-slate-300 font-mono">
              Central Command War Room has received the report with {attachedEvidenceIds.length} attached evidence records.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-600/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {uploadNotice && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{uploadNotice}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                SITREP Transmission Title <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Night Sentry Patrol: Thermal Perimeter Anomaly at Boundary Gate-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Priority and Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="ROUTINE">ROUTINE</option>
                  <option value="PRIORITY">PRIORITY</option>
                  <option value="IMMEDIATE">IMMEDIATE</option>
                  <option value="FLASH_CRITICAL">FLASH CRITICAL</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Persons Detected
                </label>
                <input
                  type="number"
                  min="0"
                  value={personsCount}
                  onChange={(e) => setPersonsCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-2.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Vehicles Checked
                </label>
                <input
                  type="number"
                  min="0"
                  value={vehiclesCount}
                  onChange={(e) => setVehiclesCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-2.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Perimeter Alarms
                </label>
                <input
                  type="number"
                  min="0"
                  value={alertsCount}
                  onChange={(e) => setAlertsCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl px-2.5 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Detailed Narrative */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                Ground Situation SITREP & Threat Summary <span className="text-cyan-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Detail observations, time of breach, suspect physical traits, camera readings, sentry actions taken, and orders requested from Central HQ..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-[#0d1626] border border-[#1e2d4a] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
              />
            </div>

            {/* EVIDENCE ATTACHMENT SECTION */}
            <div className="bg-[#080d17] border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Attached Evidence ({attachedEvidenceIds.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Upload Custom Evidence Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/mp4,video/webm"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[11px] font-mono font-bold border border-cyan-500/30 transition cursor-pointer disabled:opacity-50"
                    title="Upload photo or short video clip (compressed to low-MB)"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
                    <span>{uploading ? 'Compressing & Uploading...' : '+ Upload Photo / Clip'}</span>
                  </button>

                  {/* Toggle Picker */}
                  <button
                    type="button"
                    onClick={() => setShowEvidencePicker(!showEvidencePicker)}
                    className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 rounded-lg text-[11px] font-mono font-bold border border-cyan-500/30 transition cursor-pointer"
                  >
                    {showEvidencePicker ? 'Hide Saved Evidence' : '+ Select from Saved Evidence'}
                  </button>
                </div>
              </div>

              {/* Selected Evidence Badges */}
              {attachedEvidenceIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {attachedEvidenceIds.map((id) => {
                    const match = availableEvidence.find((e) => e.evidence_id === id);
                    return (
                      <span
                        key={id}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        <span>{id}</span>
                        {match && <span className="text-slate-400">({match.camera_id})</span>}
                        <button
                          type="button"
                          onClick={() => toggleAttachId(id)}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                          title="Remove attachment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-500 italic">
                  No evidence attached yet. Click '+ Select from Saved Evidence' or '+ Upload Photo / Clip' to attach verified files.
                </div>
              )}

              {/* Expandable Evidence Picker Gallery */}
              {showEvidencePicker && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Select saved checkpost camera frames & sensor captures:</span>
                    <span>{availableEvidence.length} items available</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800">
                    {availableEvidence.map((ev) => {
                      const isSelected = attachedEvidenceIds.includes(ev.evidence_id);
                      return (
                        <div
                          key={ev.evidence_id}
                          onClick={() => toggleAttachId(ev.evidence_id)}
                          className={`p-2 rounded-lg border transition cursor-pointer flex flex-col justify-between space-y-1 text-[10px] font-mono ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                              : 'bg-[#0b101c] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white truncate max-w-[100px]">
                              {ev.evidence_id}
                            </span>
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                isSelected
                                  ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                  : 'border-slate-600'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-500">
                            <span>{ev.camera_id}</span>
                            <span>{formatBytes(ev.file_size_bytes)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'TRANSMITTING TO HQ...' : `DISPATCH TO DELHI HQ (${attachedEvidenceIds.length} EVD)`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
