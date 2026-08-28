import React from 'react';
import { Camera } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { Activity, Eye, Edit2, Trash2, Video } from 'lucide-react';

interface CameraTableProps {
  cameras: Camera[];
  onView: (camera: Camera) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onTest: (camera: Camera) => void;
}

export const CameraTable: React.FC<CameraTableProps> = ({
  cameras,
  onView,
  onEdit,
  onDelete,
  onTest
}) => {
  return (
    <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-[#142038] text-slate-400 font-mono uppercase text-[11px] border-b border-[#1e293b] tracking-wider">
            <tr>
              <th className="px-4 py-3">CAMERA</th>
              <th className="px-4 py-3">BOP / SITE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">FPS</th>
              <th className="px-4 py-3">RESOLUTION</th>
              <th className="px-4 py-3">LAST SEEN</th>
              <th className="px-4 py-3">AI STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {cameras.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-mono">
                  No IP cameras found matching the active filter criteria.
                </td>
              </tr>
            ) : (
              cameras.map((camera) => (
                <tr
                  key={camera.camera_id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onView(camera)}
                >
                  {/* Camera ID & Name */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-sky-400 group-hover:border-sky-500 transition">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white group-hover:text-sky-300 transition">
                          {camera.camera_name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {camera.camera_id} • {camera.stream_type}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* BOP / Site */}
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-200">{camera.bop_site}</div>
                    <div className="text-[10px] text-slate-400">{camera.sector}</div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <StatusBadge status={camera.status} />
                  </td>

                  {/* FPS */}
                  <td className="px-4 py-3.5 font-mono">
                    <span className={camera.fps > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {camera.fps > 0 ? `${camera.fps} FPS` : '0 FPS'}
                    </span>
                  </td>

                  {/* Resolution */}
                  <td className="px-4 py-3.5 font-mono text-slate-300">
                    {camera.resolution || '1920x1080'}
                  </td>

                  {/* Last Seen */}
                  <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                    {camera.last_seen_at ? new Date(camera.last_seen_at).toLocaleTimeString() : 'N/A'}
                  </td>

                  {/* AI Status */}
                  <td className="px-4 py-3.5 font-mono">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-sky-950/40 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20">
                      AI ACTIVE
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onView(camera)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                        title="Live Stream View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTest(camera)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                        title="Test RTSP Stream"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(camera)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title="Edit Configuration"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(camera)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        title="Delete Camera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
