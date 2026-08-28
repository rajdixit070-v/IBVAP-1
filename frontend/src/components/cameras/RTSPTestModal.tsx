import React from 'react';
import { Modal } from '../common/Modal';
import { CameraTestResponse } from '../../types/camera';
import { CheckCircle2, XCircle, Activity, Video, Clock, ShieldCheck, AlertOctagon } from 'lucide-react';

interface RTSPTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CameraTestResponse | null;
  loading: boolean;
  cameraName?: string;
}

export const RTSPTestModal: React.FC<RTSPTestModalProps> = ({
  isOpen,
  onClose,
  result,
  loading,
  cameraName
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="RTSP Stream Connectivity Diagnostics"
      subtitle={cameraName ? `Probing: ${cameraName}` : 'Validating camera reachability and frame decoding'}
      maxWidth="lg"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin"></div>
            <Activity className="w-6 h-6 text-sky-400 absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <h4 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              PROBING RTSP STREAM...
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Performing TCP handshake, authenticating credentials, and decoding test frames via OpenCV/FFmpeg.
            </p>
          </div>
        </div>
      ) : result ? (
        <div className="space-y-6">
          {/* Main Status Header */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-4 ${
              result.success && result.connected
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            {result.success && result.connected ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-base font-bold tracking-wide">
                {result.success && result.connected
                  ? 'RTSP STREAM CONNECTED SUCCESSFULLY'
                  : `CONNECTION FAILED: ${result.error_type || 'STREAM UNAVAILABLE'}`}
              </h4>
              <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                {result.error_message ||
                  'Stream validated and ready for real-time surveillance ingestion.'}
              </p>
            </div>
          </div>

          {/* Diagnostic Metrics Grid */}
          {result.connected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#111a2e] p-3.5 rounded-lg border border-[#1e293b] space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>RESOLUTION</span>
                </div>
                <div className="text-sm font-mono font-bold text-white">
                  {result.resolution || '1920x1080'}
                </div>
              </div>

              <div className="bg-[#111a2e] p-3.5 rounded-lg border border-[#1e293b] space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>STREAM FPS</span>
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400">
                  {result.fps ? `${result.fps} FPS` : '25.0 FPS'}
                </div>
              </div>

              <div className="bg-[#111a2e] p-3.5 rounded-lg border border-[#1e293b] space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>CODEC</span>
                </div>
                <div className="text-sm font-mono font-bold text-slate-200">
                  {result.codec || 'H.264'}
                </div>
              </div>

              <div className="bg-[#111a2e] p-3.5 rounded-lg border border-[#1e293b] space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>LATENCY</span>
                </div>
                <div className="text-sm font-mono font-bold text-indigo-300">
                  {result.latency_ms ? `${result.latency_ms} ms` : 'N/A'}
                </div>
              </div>
            </div>
          )}

          {/* Failure Guidance */}
          {!result.connected && (
            <div className="bg-[#131b2e] p-4 rounded-lg border border-[#22324d] text-xs space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                Troubleshooting Checklist:
              </div>
              <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                <li>Verify camera IP address, subnet routing, and firewall port (554).</li>
                <li>Ensure the RTSP username and password credentials are correct.</li>
                <li>Check if the RTSP stream URL path is valid (e.g. <code className="text-sky-300">/stream1</code>, <code className="text-sky-300">/h264Preview_01_main</code>).</li>
                <li>Verify the camera stream is not exceeding max concurrent client limits.</li>
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold tracking-wider transition"
            >
              CLOSE DIAGNOSTICS
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
