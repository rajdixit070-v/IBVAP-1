import React from 'react';
import { Camera } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { Activity, Eye, Edit2, Trash2 } from 'lucide-react';

interface CameraCardProps {
  camera: Camera;
  onView: (camera: Camera) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onTest: (camera: Camera) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  onView,
  onEdit,
  onDelete,
  onTest
}) => {
  return (
    <div className="bg-[#111a2e] border border-[#1e293b] hover:border-sky-500/40 rounded-xl overflow-hidden shadow-lg transition-all flex flex-col justify-between group">
      {/* Header */}
      <div className="p-4 border-b border-[#1e293b] bg-[#142038]/60 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              {camera.camera_id}
            </span>
            <StatusBadge status={camera.status} />
          </div>
          <h4 className="text-sm font-semibold text-white truncate max-w-[220px]" title={camera.camera_name}>
            {camera.camera_name}
          </h4>
        </div>

        <button
          onClick={() => onView(camera)}
          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
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
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[#1e293b] bg-[#0c1322] flex items-center justify-between">
        <button
          onClick={() => onTest(camera)}
          className="flex items-center gap-1 text-xs font-mono text-sky-400 hover:text-sky-300 transition"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>TEST STREAM</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(camera)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Edit Camera"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(camera)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
            title="Delete Camera"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
