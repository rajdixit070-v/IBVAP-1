import React from 'react';
import { Camera } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { Activity, Eye, Edit2, Trash2, Video, Laptop, Plane, Smartphone, MapPin, Sliders, Flame, Server } from 'lucide-react';

interface CameraCardProps {
  camera: Camera;
  onView: (camera: Camera) => void;
  onEdit?: (camera: Camera) => void;
  onDelete?: (camera: Camera) => void;
  onTest: (camera: Camera) => void;
  onLocate?: (camera: Camera) => void;
  onConfigureAI?: (camera: Camera) => void;
  onBroadcastWebcam?: (camera: Camera) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  onView,
  onEdit,
  onDelete,
  onTest,
  onLocate,
  onConfigureAI,
  onBroadcastWebcam
}) => {
  const url = camera.rtsp_url || '';
  const st = camera.stream_type || '';
  let SourceIcon = Video;
  let sourceBadge = 'RTSP';
  let sourceClass = 'bg-sky-950/60 border-sky-500/30 text-sky-300';
  let iconColor = 'text-sky-400';

  if (st === 'nvr' || st === 'dvr' || url.includes('/Streaming/Channels/') || url.includes('channel=') || url.includes('/cam/realmonitor')) {
    SourceIcon = Server;
    sourceBadge = st === 'dvr' ? 'DVR' : 'NVR';
    sourceClass = 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300';
    iconColor = 'text-indigo-400';
  } else if (st === 'webcam' || url.startsWith('webcam://')) {
    SourceIcon = Laptop;
    sourceBadge = 'WEBCAM';
    sourceClass = 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300';
    iconColor = 'text-cyan-400';
  } else if (st === 'drone' || url.startsWith('udp://') || url.startsWith('rtmp://')) {
    SourceIcon = Plane;
    sourceBadge = 'DRONE';
    sourceClass = 'bg-purple-950/60 border-purple-500/30 text-purple-300';
    iconColor = 'text-purple-400';
  } else if (st === 'thermal' || url.includes('thermal') || url.includes('/201')) {
    SourceIcon = Flame;
    sourceBadge = 'THERMAL';
    sourceClass = 'bg-amber-950/60 border-amber-500/30 text-amber-300';
    iconColor = 'text-amber-400';
  } else if (st === 'ptz') {
    SourceIcon = Sliders;
    sourceBadge = 'PTZ';
    sourceClass = 'bg-blue-950/60 border-blue-500/30 text-blue-300';
    iconColor = 'text-blue-400';
  } else if (st === 'phone' || st === 'android' || url.includes(':8080') || url.includes(':4747')) {
    SourceIcon = Smartphone;
    sourceBadge = 'PHONE';
    sourceClass = 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300';
    iconColor = 'text-emerald-400';
  }

  return (
    <div className="bg-[#111a2e] border border-[#1e293b] hover:border-sky-500/40 rounded-xl overflow-hidden shadow-lg transition-all flex flex-col justify-between group">
      {/* Header */}
      <div className="p-4 border-b border-[#1e293b] bg-[#142038]/60 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              {camera.camera_id}
            </span>
            <span className={`px-1.5 py-0.2 rounded border font-mono text-[9px] font-bold flex items-center gap-1 ${sourceClass}`}>
              <SourceIcon className={`w-3 h-3 ${iconColor}`} />
              {sourceBadge}
            </span>
            <StatusBadge status={camera.status} />
          </div>
          <h4 className="text-sm font-semibold text-white truncate max-w-[220px]" title={camera.camera_name}>
            {camera.camera_name}
          </h4>
        </div>

        <button
          onClick={() => onView(camera)}
          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          title="Open Live Inspection"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 text-slate-300">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase block">BOP / SITE</span>
            <span className="font-medium text-slate-200">{camera.bop_site}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase block">SECTOR</span>
            <span className="font-medium text-slate-200">{camera.sector}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-slate-300">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase block">RESOLUTION</span>
            <span className="font-mono text-slate-300">{camera.resolution || '1920x1080'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase block">STREAM FPS</span>
            <span className="font-mono font-bold text-emerald-400">{camera.fps || 25.0} FPS</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 font-mono uppercase block">STREAM URL</span>
          <span className="font-mono text-[11px] text-slate-400 truncate block mt-0.5" title={camera.rtsp_url}>
            {camera.rtsp_url}
          </span>
        </div>

        {camera.latitude !== undefined && camera.latitude !== null && camera.longitude !== undefined && camera.longitude !== null && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-800/40">
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>GPS: {Number(camera.latitude).toFixed(4)}°N, {Number(camera.longitude).toFixed(4)}°E</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[#1e293b] bg-[#0c1322] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTest(camera)}
            className="flex items-center gap-1 text-xs font-mono text-sky-400 hover:text-sky-300 transition cursor-pointer"
            title="Diagnose RTSP Stream & Network Latency"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>TEST</span>
          </button>
          {onConfigureAI && (
            <button
              onClick={() => onConfigureAI(camera)}
              className="flex items-center gap-1 text-xs font-mono text-purple-400 hover:text-purple-300 transition cursor-pointer"
              title="Tune AI Object Detection Thresholds & FPS"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
          )}
          {onLocate && (
            <button
              onClick={() => onLocate(camera)}
              className="flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 transition cursor-pointer"
              title="Locate Camera on Tactical Map"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>MAP</span>
            </button>
          )}
          {onBroadcastWebcam && (st === 'webcam' || url.startsWith('webcam://') || url.startsWith('edge://') || st === 'phone') && (
            <button
              onClick={() => onBroadcastWebcam(camera)}
              className="flex items-center gap-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/40 transition cursor-pointer"
              title="Broadcast your Laptop/Device Webcam live to Cloud"
            >
              <Video className="w-3.5 h-3.5" />
              <span>BROADCAST</span>
            </button>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(camera)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                title="Edit Camera"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(camera)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                title="Delete Camera"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
