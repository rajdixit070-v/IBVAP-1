import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraDiagnosticLog } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { LiveVideoPlayer } from './LiveVideoPlayer';
import { cameraService } from '../../services/cameraService';
import { RTSPTestModal } from './RTSPTestModal';
import { Activity, Play, Square, History, Trash2 } from 'lucide-react';

interface CameraDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera: Camera | null;
  onRefresh: () => void;
  onEdit: (camera: Camera) => void;
}

export const CameraDetailsModal: React.FC<CameraDetailsModalProps> = ({
  isOpen,
  onClose,
  camera,
  onRefresh,
  onEdit
}) => {
  const [logs, setLogs] = useState<CameraDiagnosticLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // RTSP Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  useEffect(() => {
    if (camera && isOpen) {
      loadLogs();
    }
  }, [camera, isOpen]);

  const loadLogs = async () => {
    if (!camera) return;
    setLoadingLogs(true);
    try {
      const data = await cameraService.getCameraLogs(camera.camera_id, 30);
      setLogs(data);
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!camera) return;
    if (window.confirm(`Clear diagnostic logs for camera '${camera.camera_id}'?`)) {
      try {
        await cameraService.clearCameraLogs(camera.camera_id);
        setLogs([]);
      } catch (e) {
        console.error('Failed to clear logs', e);
      }
    }
  };

  if (!camera) return null;


  const handleStartStop = async () => {
    setActionLoading(true);
    try {
      if (camera.enabled) {
        await cameraService.stopStream(camera.camera_id);
      } else {
        await cameraService.startStream(camera.camera_id);
      }
      onRefresh();
      loadLogs();
    } catch (e) {
      console.error('Action failed', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);
    try {
      const res = await cameraService.testSavedCamera(camera.camera_id);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        connected: false,
        error_type: 'NETWORK_ERROR',
        error_message: err.response?.data?.detail || err.message || 'Unable to test.'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Camera Inspection // ${camera.camera_id}`}
        subtitle={`${camera.camera_name} • ${camera.bop_site} (${camera.sector})`}
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Live Preview Area */}
          <div className="h-72 w-full">
            <LiveVideoPlayer camera={camera} showControls={true} />
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111a2e] rounded-xl border border-[#1e293b]">
            <div className="flex items-center gap-3">
              <StatusBadge status={camera.status} />
              <span className="text-xs text-slate-400 font-mono">
                LAST SEEN: <strong className="text-slate-200">{camera.last_seen_at ? new Date(camera.last_seen_at).toLocaleTimeString() : 'N/A'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 rounded-lg text-xs font-mono font-semibold border border-sky-500/30 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                TEST RTSP STREAM
              </button>

              <button
                onClick={handleStartStop}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
                  camera.enabled
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {camera.enabled ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> STOP INGESTION
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> START INGESTION
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  onClose();
                  onEdit(camera);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                EDIT CONFIG
              </button>
            </div>
          </div>

          {/* Details Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#111a2e] p-3 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">RTSP Stream URL</span>
              <span className="font-mono text-slate-200 truncate block mt-0.5" title={camera.rtsp_url}>
                {camera.rtsp_url}
              </span>
            </div>
            <div className="bg-[#111a2e] p-3 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Sensor Resolution</span>
              <span className="font-mono text-white block mt-0.5">{camera.resolution || '1920x1080'}</span>
            </div>
            <div className="bg-[#111a2e] p-3 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Operating FPS</span>
              <span className="font-mono text-emerald-400 font-bold block mt-0.5">{camera.fps || 25.0} FPS</span>
            </div>
            <div className="bg-[#111a2e] p-3 rounded-lg border border-[#1e293b]">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Authentication</span>
              <span className="font-mono text-sky-400 block mt-0.5">
                {camera.has_password ? 'AES-256 ENCRYPTED' : 'NO CREDENTIALS'}
              </span>
            </div>
          </div>

          {/* Diagnostic History Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-sky-400" /> RECENT CONNECTION & HEALTH EVENTS
              </h4>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadLogs}
                  className="text-[11px] text-sky-400 hover:underline font-mono cursor-pointer"
                >
                  REFRESH LOGS
                </button>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-mono cursor-pointer"
                    title="Clear diagnostic logs"
                  >
                    <Trash2 className="w-3 h-3" /> CLEAR LOGS
                  </button>
                )}
              </div>
            </div>


            <div className="bg-[#0b101c] border border-[#1e293b] rounded-lg max-h-48 overflow-y-auto">
              {loadingLogs ? (
                <div className="p-4 text-center text-xs text-slate-500 font-mono">Loading diagnostics...</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-mono">No diagnostic logs recorded yet.</div>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#111c33] text-slate-400 border-b border-[#1e293b] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">TIMESTAMP (UTC)</th>
                      <th className="px-3 py-2">EVENT</th>
                      <th className="px-3 py-2">STATUS</th>
                      <th className="px-3 py-2">DETAILS</th>
                      <th className="px-3 py-2 text-right">FPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="px-3 py-1.5 text-sky-300">{log.event_type}</td>
                        <td className="px-3 py-1.5">
                          <StatusBadge status={log.status} showDot={false} />
                        </td>
                        <td className="px-3 py-1.5 text-slate-400 max-w-xs truncate">{log.details || '-'}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-400">{log.fps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* RTSP Diagnostic Modal */}
      <RTSPTestModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        result={testResult}
        loading={testing}
        cameraName={camera.camera_name}
      />
    </>
  );
};
