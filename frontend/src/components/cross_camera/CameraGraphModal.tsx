import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CameraTransition, CameraTransitionCreate } from '../../types/crossCamera';
import { crossCameraService } from '../../services/crossCameraService';
import { useCameras } from '../../context/CameraContext';
import { Camera } from '../../types/camera';
import { Plus, Save, Trash2, GitFork, CheckCircle2 } from 'lucide-react';

interface CameraGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const CameraGraphModal: React.FC<CameraGraphModalProps> = ({
  isOpen,
  onClose,
  onUpdated
}) => {
  const { cameras } = useCameras();
  const [transitions, setTransitions] = useState<CameraTransition[]>([]);

  // New Edge Form
  const [fromCam, setFromCam] = useState('');
  const [toCam, setToCam] = useState('');
  const [minTime, setMinTime] = useState(15);
  const [expectedTime, setExpectedTime] = useState(45);
  const [maxTime, setMaxTime] = useState(300);
  const [direction, setDirection] = useState('EAST');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGraph();
      setError(null);
      setSuccessMsg(null);
      if (cameras.length > 0) {
        setFromCam(cameras[0].camera_id);
        setToCam(cameras.length > 1 ? cameras[1].camera_id : cameras[0].camera_id);
      }
    }
  }, [isOpen, cameras]);

  const loadGraph = async () => {
    try {
      const data = await crossCameraService.getCameraGraph();
      setTransitions(data);
    } catch (e) {
      console.error('Failed to load camera graph', e);
    }
  };

  const handleAddTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromCam === toCam) {
      setError('Cannot create transition between the same camera.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: CameraTransitionCreate = {
        from_camera_id: fromCam,
        to_camera_id: toCam,
        min_travel_time_sec: minTime,
        expected_travel_time_sec: expectedTime,
        max_travel_time_sec: maxTime,
        direction,
        transition_confidence: 0.90,
        is_enabled: true
      };

      await crossCameraService.createTransition(payload);
      await loadGraph();
      setSuccessMsg(`Transition edge added: ${fromCam} ➔ ${toCam} (${expectedTime}s)`);
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add transition edge.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransition = async (id: number) => {
    try {
      await crossCameraService.deleteTransition(id);
      await loadGraph();
      setSuccessMsg('Transition edge successfully deleted.');
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete transition edge.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Camera Network Topology & Transition Graph"
      subtitle="Configure logical edges, expected travel times, and direction constraints between cameras"
      maxWidth="4xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Visual Graph Topology Preview */}
        <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-4 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-sky-400">
            <span className="flex items-center gap-1.5">
              <GitFork className="w-4 h-4" />
              TOPOLOGY VISUALIZATION & TRANSITION CORRIDORS
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Used by Multi-Camera ReID for Track Continuity
            </span>
          </div>

          {/* Interactive Topological SVG Network Graph */}
          {cameras.length === 0 ? (
            <div className="h-44 bg-[#050811] rounded-xl border border-slate-800/80 p-3 flex flex-col items-center justify-center text-center text-slate-500 text-xs font-mono space-y-1">
              <GitFork className="w-6 h-6 mx-auto text-slate-600 opacity-50" />
              <p>No cameras registered yet.</p>
              <p className="text-[10px] text-slate-600">Register cameras first from Camera Management to draw the network graph.</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#050811]">
              <svg viewBox="0 0 760 220" className="w-full h-56 select-none">
                <defs>
                  <marker
                    id="graph-arrow"
                    viewBox="0 0 10 10"
                    refX="26"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Draw Directed Transition Edges */}
                {transitions.map((t) => {
                  const idxFrom = cameras.findIndex((c) => c.camera_id === t.from_camera_id);
                  const idxTo = cameras.findIndex((c) => c.camera_id === t.to_camera_id);
                  if (idxFrom === -1 || idxTo === -1) return null;

                  const total = cameras.length;
                  const angle1 = (2 * Math.PI * idxFrom) / total - Math.PI / 2;
                  const angle2 = (2 * Math.PI * idxTo) / total - Math.PI / 2;
                  const rX = Math.min(260, (total - 1) * 75 + 100);
                  const rY = 65;
                  const x1 = 380 + Math.cos(angle1) * rX;
                  const y1 = 110 + Math.sin(angle1) * rY;
                  const x2 = 380 + Math.cos(angle2) * rX;
                  const y2 = 110 + Math.sin(angle2) * rY;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2 - 14;

                  return (
                    <g key={t.id}>
                      <path
                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.5"
                        strokeDasharray="4, 3"
                        markerEnd="url(#graph-arrow)"
                        opacity="0.85"
                      />
                      <rect
                        x={midX - 34}
                        y={midY - 9}
                        width="68"
                        height="17"
                        rx="4"
                        fill="#090d16"
                        stroke="#0284c7"
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {t.expected_travel_time_sec}s • {t.direction}
                      </text>
                    </g>
                  );
                })}

                {/* Draw Camera Nodes */}
                {cameras.map((cam, idx) => {
                  const total = cameras.length;
                  let x = 380;
                  let y = 110;
                  if (total > 1) {
                    const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
                    const rX = Math.min(260, (total - 1) * 75 + 100);
                    const rY = 65;
                    x = 380 + Math.cos(angle) * rX;
                    y = 110 + Math.sin(angle) * rY;
                  }
                  const isOnline = cam.status === 'HEALTHY' || cam.status === 'ONLINE';

                  return (
                    <g
                      key={cam.camera_id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer group"
                      onClick={() => {
                        if (!fromCam || fromCam === cam.camera_id) setFromCam(cam.camera_id);
                        else setToCam(cam.camera_id);
                      }}
                    >
                      <circle r="26" fill="none" stroke={isOnline ? '#10b981' : '#f59e0b'} strokeWidth="1" opacity="0.3" />
                      <circle
                        r="20"
                        fill="#0f172a"
                        stroke={isOnline ? '#10b981' : '#f59e0b'}
                        strokeWidth="2"
                        className="group-hover:stroke-sky-400 transition"
                      />
                      <circle cx="0" cy="-3" r="3.5" fill={isOnline ? '#10b981' : '#f59e0b'} />
                      <rect
                        x="-38"
                        y="22"
                        width="76"
                        height="16"
                        rx="3"
                        fill="#090d16"
                        stroke="#1e293b"
                      />
                      <text
                        x="0"
                        y="33"
                        textAnchor="middle"
                        fill="#f1f5f9"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {cam.camera_id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Existing Transition Edges Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 uppercase">
            <span>Active Camera Graph Edges ({transitions.length})</span>
          </div>

          <div className="bg-[#090d16] border border-[#1e293b] rounded-xl overflow-hidden shadow-md">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#111a2e] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
                <tr>
                  <th className="px-4 py-2.5">FROM CAMERA</th>
                  <th className="px-4 py-2.5">TO CAMERA</th>
                  <th className="px-4 py-2.5">TRAVEL TIME LIMITS</th>
                  <th className="px-4 py-2.5">DIRECTION</th>
                  <th className="px-4 py-2.5">STATUS</th>
                  <th className="px-4 py-2.5 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {transitions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No configured transition edges found.
                    </td>
                  </tr>
                ) : (
                  transitions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-bold text-sky-400">{t.from_camera_id}</td>
                      <td className="px-4 py-2.5 font-bold text-sky-400">{t.to_camera_id}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {t.min_travel_time_sec}s - {t.max_travel_time_sec}s (avg {t.expected_travel_time_sec}s)
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{t.direction}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          ENABLED
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransition(t.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add New Edge Form */}
        <form onSubmit={handleAddTransition} className="p-4 bg-[#111a2e] border border-sky-500/30 rounded-xl space-y-4">
          <div className="text-xs font-mono font-bold text-sky-400 uppercase flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Directed Transition Edge
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">From Camera</label>
              <select
                value={fromCam}
                onChange={(e) => setFromCam(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                {cameras.length === 0 ? (
                  <option value="">No cameras registered</option>
                ) : (
                  cameras.map((c: Camera) => (
                    <option key={c.camera_id} value={c.camera_id}>
                      {c.camera_id} ({c.camera_name})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">To Camera</label>
              <select
                value={toCam}
                onChange={(e) => setToCam(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                {cameras.length === 0 ? (
                  <option value="">No cameras registered</option>
                ) : (
                  cameras.map((c: Camera) => (
                    <option key={c.camera_id} value={c.camera_id}>
                      {c.camera_id} ({c.camera_name})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Min Time (sec)</label>
              <input
                type="number"
                min={1}
                value={minTime}
                onChange={(e) => setMinTime(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Expected Time (sec)</label>
              <input
                type="number"
                min={1}
                value={expectedTime}
                onChange={(e) => setExpectedTime(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Max Time (sec)</label>
              <input
                type="number"
                min={1}
                value={maxTime}
                onChange={(e) => setMaxTime(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="EAST">EAST</option>
                <option value="WEST">WEST</option>
                <option value="NORTH">NORTH</option>
                <option value="SOUTH">SOUTH</option>
                <option value="SOUTH-EAST">SOUTH-EAST</option>
                <option value="SOUTH-WEST">SOUTH-WEST</option>
                <option value="ANY">ANY</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono font-bold transition disabled:opacity-50 cursor-pointer shadow-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? 'ADDING...' : 'ADD GRAPH EDGE'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
