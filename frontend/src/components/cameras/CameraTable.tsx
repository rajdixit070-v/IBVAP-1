import React from 'react';
import { Camera } from '../../types/camera';
import { StatusBadge } from '../common/StatusBadge';
import { Activity, Eye, Edit2, Trash2, Video, Laptop, Plane, Smartphone, MapPin, Sliders, Flame, Server, Globe, Cctv } from 'lucide-react';

interface CameraTableProps {
  cameras: Camera[];
  onView: (camera: Camera) => void;
  onEdit?: (camera: Camera) => void;
  onDelete?: (camera: Camera) => void;
  onTest: (camera: Camera) => void;
  onLocate?: (camera: Camera) => void;
  onConfigureAI?: (camera: Camera) => void;
}

export const CameraTable: React.FC<CameraTableProps> = ({
  cameras,
  onView,
  onEdit,
  onDelete,
  onTest,
  onLocate,
  onConfigureAI
}) => {
  return (
    <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-[#142038] text-slate-400 font-mono uppercase text-[11px] border-b border-[#1e293b] tracking-wider">
            <tr>
              <th className="px-3 sm:px-4 py-3">CAMERA</th>
              <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">BOP / SITE</th>
              <th className="px-3 sm:px-4 py-3">STATUS</th>
              <th className="px-3 sm:px-4 py-3 hidden md:table-cell">FPS</th>
              <th className="px-3 sm:px-4 py-3 hidden md:table-cell">RESOLUTION</th>
              <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">LAST SEEN</th>
              <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">AI STATUS</th>
              <th className="px-3 sm:px-4 py-3 text-right">ACTIONS</th>
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
              cameras.map((camera) => {
                const url = camera.rtsp_url || '';
                const st = camera.stream_type || '';
                let SourceIcon = Video;
                let sourceBadge = 'RTSP';
                let sourceClass = 'bg-sky-950/60 border-sky-500/30 text-sky-300';
                let iconColor = 'text-sky-400';

                if (st === 'tunnel' || st === 'hls' || url.includes('.m3u8') || url.includes('trycloudflare') || url.includes('go2rtc')) {
                  SourceIcon = Globe;
                  sourceBadge = 'TUNNEL / HLS';
                  sourceClass = 'bg-teal-950/60 border-teal-500/30 text-teal-300';
                  iconColor = 'text-teal-400';
                } else if (st === 'ip_camera' || st === 'ip') {
                  SourceIcon = Cctv;
                  sourceBadge = 'IP CAMERA';
                  sourceClass = 'bg-sky-950/60 border-sky-500/30 text-sky-300';
                  iconColor = 'text-sky-400';
                } else if (st === 'nvr' || st === 'dvr' || url.includes('/Streaming/Channels/') || url.includes('channel=') || url.includes('/cam/realmonitor')) {
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
                } else if (st === 'android' || url.includes(':8080') || url.includes(':4747')) {
                  SourceIcon = Smartphone;
                  sourceBadge = 'ANDROID';
                  sourceClass = 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300';
                  iconColor = 'text-emerald-400';
                }

                return (
                <tr
                  key={camera.camera_id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onView(camera)}
                >
                  {/* Camera ID & Name */}
                  <td className="px-3 sm:px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center group-hover:border-sky-500 transition">
                        <SourceIcon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white group-hover:text-sky-300 transition">
                            {camera.camera_name}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded border font-mono text-[9px] font-bold ${sourceClass}`}>
                            {sourceBadge}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {camera.camera_id} • {camera.stream_type}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* BOP / Site */}
                  <td className="px-3 sm:px-4 py-3.5 hidden sm:table-cell">
                    <div className="font-medium text-slate-200">{camera.bop_site}</div>
                    <div className="text-[10px] text-slate-400">{camera.sector}</div>
                  </td>

                  {/* Status */}
                  <td className="px-3 sm:px-4 py-3.5">
                    <StatusBadge status={camera.status} />
                  </td>

                  {/* FPS */}
                  <td className="px-3 sm:px-4 py-3.5 font-mono hidden md:table-cell">
                    <span className={camera.fps > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {camera.fps > 0 ? `${camera.fps} FPS` : '0 FPS'}
                    </span>
                  </td>

                  {/* Resolution */}
                  <td className="px-3 sm:px-4 py-3.5 font-mono text-slate-300 hidden md:table-cell">
                    {camera.resolution || '1920x1080'}
                  </td>

                  {/* Last Seen */}
                  <td className="px-3 sm:px-4 py-3.5 font-mono text-slate-400 text-[11px] hidden lg:table-cell">
                    {camera.last_seen_at ? new Date(camera.last_seen_at).toLocaleTimeString() : 'N/A'}
                  </td>

                  {/* AI Status */}
                  <td className="px-3 sm:px-4 py-3.5 font-mono hidden lg:table-cell">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-sky-950/40 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20">
                      AI ACTIVE
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 sm:px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {onLocate && (
                        <button
                          onClick={() => onLocate(camera)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
                          title="Locate on Tactical Map"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onView(camera)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Live Stream View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTest(camera)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Test RTSP Stream"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      {onConfigureAI && (
                        <button
                          onClick={() => onConfigureAI(camera)}
                          className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition cursor-pointer"
                          title="Tune AI Object Detection & Thresholds"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(camera)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                          title="Edit Configuration"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(camera)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                          title="Delete Camera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
