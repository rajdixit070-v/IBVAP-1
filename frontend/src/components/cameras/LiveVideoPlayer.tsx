import React, { useState, useEffect, useRef } from 'react';
import { Camera } from '../../types/camera';
import { TrackedObject, CameraAICounters } from '../../types/ai';
import { SecurityZone } from '../../types/zone';
import { StatusBadge } from '../common/StatusBadge';
import { DetectionOverlay } from '../ai/DetectionOverlay';
import { AIControlModal } from '../ai/AIControlModal';
import {
  Maximize2,
  Minimize2,
  Camera as CameraIcon,
  AlertTriangle,
  Cpu,
  Eye,
  EyeOff,
  Sliders
} from 'lucide-react';
import { cameraService } from '../../services/cameraService';
import { zoneService } from '../../services/zoneService';
import { LiveFeedWebSocket } from '../../services/websocket';
import { AIFeedWebSocket } from '../../services/aiService';

interface LiveVideoPlayerProps {
  camera: Camera;
  autoPlay?: boolean;
  className?: string;
  showControls?: boolean;
  onOpenDetails?: () => void;
}

export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = ({
  camera,
  autoPlay = true,
  className = '',
  showControls = true
}) => {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(camera.fps || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useFallbackMjpeg, setUseFallbackMjpeg] = useState(false);
  
  // AI Telemetry State
  const [showAiOverlay, setShowAiOverlay] = useState(true);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [tracks, setTracks] = useState<TrackedObject[]>([]);
  const [zones, setZones] = useState<SecurityZone[]>([]);
  const [aiStatus, setAiStatus] = useState<string>('STARTING');
  const [aiFps, setAiFps] = useState<number>(0);
  const [aiLatency, setAiLatency] = useState<number>(0);
  const [counters, setCounters] = useState<CameraAICounters>({
    people: 0,
    vehicles: 0,
    animals: 0,
    other: 0,
    total_tracks: 0
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const wsVideoRef = useRef<LiveFeedWebSocket | null>(null);
  const wsAiRef = useRef<AIFeedWebSocket | null>(null);

  // Measure local render FPS
  const frameCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());

  // Load Zones for this camera
  useEffect(() => {
    if (camera.camera_id) {
      zoneService.getZones(camera.camera_id).then(setZones).catch(() => {});
    }
  }, [camera.camera_id]);

  // Clear frame buffer when camera transitions to OFFLINE
  useEffect(() => {
    if (camera.status === 'OFFLINE') {
      setFrameSrc(null);
      setFps(0);
    }
  }, [camera.status]);

  // Video Streaming WebSocket

  useEffect(() => {
    if (!autoPlay || !camera.enabled) {
      return;
    }

    if (!useFallbackMjpeg) {
      try {
        const ws = new LiveFeedWebSocket(
          camera.camera_id,
          (blobUrl) => {
            setFrameSrc(blobUrl);

            frameCountRef.current += 1;
            const now = Date.now();
            if (now - lastFpsCalcRef.current >= 1000) {
              setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcRef.current)));
              frameCountRef.current = 0;
              lastFpsCalcRef.current = now;
            }
          },
          (err) => {
            console.warn(`WebSocket stream issue for ${camera.camera_id}, switching to MJPEG:`, err);
            setUseFallbackMjpeg(true);
          }
        );
        wsVideoRef.current = ws;

        return () => {
          ws.close();
        };
      } catch (e) {
        setUseFallbackMjpeg(true);
      }
    }
  }, [camera.camera_id, camera.enabled, autoPlay, useFallbackMjpeg]);

  // AI Telemetry WebSocket
  useEffect(() => {
    if (!autoPlay || !camera.enabled) return;

    try {
      const aiWs = new AIFeedWebSocket(camera.camera_id, (msg) => {
        if (msg.tracks) setTracks(msg.tracks);
        if (msg.status) setAiStatus(msg.status);
        if (msg.inference_fps !== undefined) setAiFps(msg.inference_fps);
        if (msg.latency_ms !== undefined) setAiLatency(msg.latency_ms);
        if (msg.counters) setCounters(msg.counters);
      });
      wsAiRef.current = aiWs;

      return () => {
        aiWs.close();
      };
    } catch (e) {
      console.warn('AI telemetry WS connection error', e);
    }
  }, [camera.camera_id, camera.enabled, autoPlay]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleSnapshot = async () => {
    try {
      await cameraService.downloadSnapshot(camera.camera_id);
    } catch (err) {
      console.warn('Snapshot download failed:', err);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative group bg-[#090d16] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl flex flex-col ${className}`}
      >
        {/* Top Video HUD */}
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between text-xs pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
              {camera.camera_id}
            </span>
            <span className="text-slate-200 font-semibold truncate max-w-[140px] md:max-w-[200px]">
              {camera.camera_name}
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* AI Engine Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                aiStatus === 'ACTIVE'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                  : aiStatus === 'STARTING'
                  ? 'bg-sky-950/80 border-sky-500/40 text-sky-400'
                  : aiStatus === 'ERROR'
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-400'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>{aiStatus === 'ACTIVE' ? `AI ACTIVE (${aiFps} FPS)` : `AI ${aiStatus}`}</span>
            </div>

            <StatusBadge status={camera.status} />
          </div>
        </div>

        {/* Real-Time Live Object Counters Bar */}
        {camera.enabled && camera.status === 'HEALTHY' && showAiOverlay && (
          <div className="absolute top-11 left-3 z-20 flex items-center gap-2 pointer-events-none">
            <div className="bg-slate-950/80 border border-slate-800/80 backdrop-blur-md rounded-lg px-2.5 py-1 flex items-center gap-3 text-[11px] font-mono shadow-lg">
              <span className="text-sky-400 font-bold">
                PEOPLE: <strong>{counters.people}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-bold">
                VEHICLES: <strong>{counters.vehicles}</strong>
              </span>
              {counters.animals > 0 && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-400 font-bold">
                    ANIMALS: <strong>{counters.animals}</strong>
                  </span>
                </>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">
                TRACKS: <strong>{counters.total_tracks}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Main Video & Detection Overlay Surface */}
        <div className="relative flex-1 flex items-center justify-center min-h-[220px] bg-slate-950 overflow-hidden">
          {camera.enabled && camera.status !== 'OFFLINE' ? (
            <>
              {frameSrc ? (
                <img
                  src={frameSrc}
                  alt={camera.camera_name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={cameraService.getLiveStreamUrl(camera.camera_id)}
                  alt={camera.camera_name}
                  className="w-full h-full object-contain"
                  onError={() => {
                    // Fallback to retrying or showing connection spinner
                  }}
                />
              )}

              {/* Tactical Bounding Boxes & Virtual Zones Overlay */}
              {showAiOverlay && (
                <DetectionOverlay
                  tracks={tracks}
                  zones={zones}
                  showTrajectories={true}
                  showZones={true}
                />
              )}
            </>
          ) : (
            /* Offline or Disabled State */
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500">
                <AlertTriangle className="w-6 h-6 text-amber-400/80" />
              </div>
              <div className="font-mono text-sm font-semibold text-slate-300 uppercase">
                {!camera.enabled ? 'CAMERA DISABLED' : 'STREAM OFFLINE'}
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                {!camera.enabled
                  ? 'Camera feed is disabled by administrator policy.'
                  : 'Camera stream disconnected. Backend automatic exponential backoff is actively retrying.'}
              </p>
            </div>
          )}

          {/* Tactical Scanline Overlay */}
          <div className="absolute inset-0 scanline-effect opacity-40 pointer-events-none"></div>
        </div>

        {/* Bottom Video HUD */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
            <span className="text-sky-400 font-medium">{camera.bop_site}</span>
            <span className="text-slate-500">•</span>
            <span>{camera.resolution || '1920x1080'}</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">{fps > 0 ? `${fps} FPS` : `${camera.fps || 25} FPS`}</span>
            {aiStatus === 'ACTIVE' && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-purple-400">LATENCY: {aiLatency}ms</span>
              </>
            )}
          </div>

          {showControls && (
            <div className="flex items-center gap-1.5">
              {/* Toggle AI Overlay Button */}
              <button
                onClick={() => setShowAiOverlay(!showAiOverlay)}
                className={`p-1.5 rounded border transition ${
                  showAiOverlay
                    ? 'bg-sky-600/30 text-sky-300 border-sky-500/50'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-700/60'
                }`}
                title={showAiOverlay ? 'Hide AI Bounding Boxes & Zones' : 'Show AI Bounding Boxes & Zones'}
              >
                {showAiOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              {/* AI Settings Button */}
              <button
                onClick={() => setAiModalOpen(true)}
                className="p-1.5 bg-slate-900/80 text-slate-300 hover:text-sky-400 hover:bg-slate-800 rounded border border-slate-700/60 transition"
                title="AI Detection Settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>

              {/* Snapshot Button */}
              <button
                onClick={handleSnapshot}
                className="p-1.5 bg-slate-900/80 text-slate-300 hover:text-sky-400 hover:bg-slate-800 rounded border border-slate-700/60 transition"
                title="Capture Snapshot"
              >
                <CameraIcon className="w-3.5 h-3.5" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 rounded border border-slate-700/60 transition"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Controls Modal */}
      <AIControlModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        cameraId={camera.camera_id}
        cameraName={camera.camera_name}
      />
    </>
  );
};
