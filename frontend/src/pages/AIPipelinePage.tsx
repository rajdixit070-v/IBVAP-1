import React, { useState, useEffect } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { CameraAIStatus, AIMetrics, TrackedObject } from '../types/ai';
import { aiService } from '../services/aiService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { AIControlModal } from '../components/ai/AIControlModal';
import {
  Cpu,
  Activity,
  Layers,
  Sliders,
  Play,
  Square,
  RefreshCw,
  Zap,
  Target,
  Compass
} from 'lucide-react';

export const AIPipelinePage: React.FC = () => {
  const { cameras } = useCameras();
  const [statuses, setStatuses] = useState<CameraAIStatus[]>([]);
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [selectedCameraForTuning, setSelectedCameraForTuning] = useState<Camera | null>(null);
  const [allTracks, setAllTracks] = useState<TrackedObject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusData, metricsData] = await Promise.all([
        aiService.getAIStatuses(),
        aiService.getAIMetrics()
      ]);
      setStatuses(statusData);
      setMetrics(metricsData);

      // Aggregate tracks across cameras
      const trackPromises = cameras.filter((c) => c.enabled).map((c) =>
        aiService.getCameraTracks(c.camera_id).catch(() => [])
      );
      const trackResults = await Promise.all(trackPromises);
      setAllTracks(trackResults.flat());
    } catch (e) {
      console.error('Failed to load AI pipeline data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAI = async (cameraId: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await aiService.disableCameraAI(cameraId);
      } else {
        await aiService.enableCameraAI(cameraId);
      }
      loadData();
    } catch (e) {
      console.error('Failed to toggle AI state', e);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#111c33] via-[#0f172a] to-[#0d131f] border border-[#1e293b] rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30">
              REAL-TIME AI INFERENCE MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• YOLO + BYTETRACK ENGINE</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Tactical Object Detection & Multi-Frame Tracking Matrix
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Real-time deep neural network inference layer. Automated classification of persons, vehicles, animals, and airborne targets with persistent ByteTrack IDs, image-space direction vectors, and bounded trajectory tracking.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Hardware & Inference Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-400">AI MODEL & ENGINE</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {metrics?.model || 'YOLOv8n'}
          </div>
          <div className="text-[11px] font-mono text-purple-400">
            Hardware: {metrics?.device || 'CPU / CUDA'}
          </div>
        </div>

        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-emerald-400">ACTIVE WORKERS</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-emerald-400">{metrics?.active_workers ?? 0}</span>
            <span className="text-xs text-slate-400">/ {cameras.length} Streams</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400/80">
            Decoupled Multi-Threaded Workers
          </div>
        </div>

        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-sky-400">AVERAGE LATENCY</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-sky-400">{metrics?.avg_latency_ms ?? 0}</span>
            <span className="text-xs text-slate-400">ms per frame</span>
          </div>
          <div className="text-[11px] font-mono text-sky-400/80">
            Sub-100ms Target Nominal
          </div>
        </div>

        <div className="bg-[#111a2e] border border-[#1e293b] p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-amber-400">ACTIVE TRACKS</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-amber-400">{allTracks.length}</span>
            <span className="text-xs text-slate-400">Tracked Entities</span>
          </div>
          <div className="text-[11px] font-mono text-amber-400/80">
            Persistent ByteTrack State
          </div>
        </div>
      </div>

      {/* Per-Camera Live AI Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          Active Camera AI Inference Streams
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cameras.map((cam) => {
            const camStatus = statuses.find((s) => s.camera_id === cam.camera_id);
            const isActive = camStatus?.status === 'ACTIVE';

            return (
              <div
                key={cam.camera_id}
                className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-3 bg-[#142038] border-b border-[#1e293b] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {cam.camera_id}
                    </span>
                    <span className="text-sm font-semibold text-white truncate max-w-[180px]">
                      {cam.camera_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAI(cam.camera_id, isActive)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-semibold transition ${
                        isActive
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      }`}
                    >
                      {isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {isActive ? 'PAUSE AI' : 'START AI'}
                    </button>

                    <button
                      onClick={() => setSelectedCameraForTuning(cam)}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                      title="Adjust Thresholds"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Video Preview */}
                <div className="h-64">
                  <LiveVideoPlayer camera={cam} showControls={false} />
                </div>

                {/* Footer Metrics */}
                <div className="p-3 bg-[#0c1322] border-t border-[#1e293b] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">
                      INFERENCE: <strong>{camStatus?.inference_fps ?? 0} FPS</strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-sky-400">
                      LATENCY: <strong>{camStatus?.latency_ms ?? 0}ms</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedCameraForTuning(cam)}
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Sliders className="w-3 h-3" /> TUNING
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-Time Tracked Objects Inspector Table */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
          <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" />
            Live Multi-Frame Tracked Objects Registry
          </h3>
          <span className="text-xs font-mono text-slate-400">
            TOTAL ACTIVE ENTITIES: <strong className="text-white">{allTracks.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-3 py-2.5">TRACK ID</th>
                <th className="px-3 py-2.5">CAMERA</th>
                <th className="px-3 py-2.5">OBJECT TYPE</th>
                <th className="px-3 py-2.5">CONFIDENCE</th>
                <th className="px-3 py-2.5">IMAGE DIRECTION</th>
                <th className="px-3 py-2.5">RELATIVE SPEED</th>
                <th className="px-3 py-2.5">FRAMES</th>
                <th className="px-3 py-2.5">STATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {allTracks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No active targets currently tracked in camera video feeds.
                  </td>
                </tr>
              ) : (
                allTracks.map((t) => (
                  <tr key={`${t.camera_id}-${t.track_id}`} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-sky-400 font-bold">#{t.track_id}</td>
                    <td className="px-3 py-2 text-slate-200">{t.camera_id}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-500/20 uppercase text-[10px]">
                        {t.object_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-emerald-400">{Math.round(t.confidence * 100)}%</td>
                    <td className="px-3 py-2 text-slate-300">{t.direction}</td>
                    <td className="px-3 py-2 text-indigo-300">{Math.round(t.speed)} px/s</td>
                    <td className="px-3 py-2 text-slate-400">{t.frame_count}</td>
                    <td className="px-3 py-2">
                      <span className="text-emerald-400 text-[10px] font-bold">● {t.tracking_state}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Controls Modal */}
      {selectedCameraForTuning && (
        <AIControlModal
          isOpen={!!selectedCameraForTuning}
          onClose={() => setSelectedCameraForTuning(null)}
          cameraId={selectedCameraForTuning.camera_id}
          cameraName={selectedCameraForTuning.camera_name}
          onSaved={loadData}
        />
      )}
    </div>
  );
};
