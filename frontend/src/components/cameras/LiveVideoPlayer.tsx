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
  Sliders,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Square
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
  globalProfile?: 'main' | 'sub';
}

export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = ({
  camera,
  autoPlay = true,
  className = '',
  showControls = true,
  globalProfile = 'main'
}) => {
  const [streamProfile, setStreamProfile] = useState<'main' | 'sub'>(globalProfile);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(camera.fps || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useFallbackMjpeg, setUseFallbackMjpeg] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);

  useEffect(() => {
    if (globalProfile) {
      setStreamProfile(globalProfile);
    }
  }, [globalProfile]);

  useEffect(() => {
    setStreamError(false);
    setUseFallbackMjpeg(false);
    setFrameSrc(null);
    setSnapshotSrc(cameraService.getSnapshotUrl(camera.camera_id));
  }, [camera.camera_id]);
  
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

  const [isBroadcastingLocalCam, setIsBroadcastingLocalCam] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const broadcastIntervalRef = useRef<any>(null);

  const startLocalCamBroadcast = async (requestedFacing?: 'environment' | 'user') => {
    try {
      if (isBroadcastingLocalCam && !requestedFacing) {
        stopLocalCamBroadcast();
        return;
      }
      if (isBroadcastingLocalCam && requestedFacing) {
        stopLocalCamBroadcast();
      }

      const targetFacing = requestedFacing || facingMode;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: targetFacing },
        audio: false
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      setIsBroadcastingLocalCam(true);
      setFacingMode(targetFacing);
      setStreamError(false);

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 640;
      offscreenCanvas.height = 360;
      const ctx = offscreenCanvas.getContext('2d');

      broadcastIntervalRef.current = setInterval(() => {
        if (!localVideoRef.current || localVideoRef.current.readyState < 2) return;
        if (ctx) {
          ctx.drawImage(localVideoRef.current, 0, 0, 640, 360);
          offscreenCanvas.toBlob((blob) => {
            if (blob) {
              cameraService.ingestDirectFrame(camera.camera_id, blob).catch(() => {});
            }
          }, 'image/jpeg', 0.65);
        }
      }, 125);
    } catch (err: any) {
      alert(`Camera access notice: ${err.message || 'Permission denied or no camera device found.'}`);
    }
  };

  const flipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startLocalCamBroadcast(nextFacing);
  };

  const stopLocalCamBroadcast = () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setIsBroadcastingLocalCam(false);
  };

  useEffect(() => {
    return () => {
      stopLocalCamBroadcast();
    };
  }, []);

  // Measure local render FPS
  const frameCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());

  // Load Zones for this camera
  useEffect(() => {
    if (camera.camera_id) {
      zoneService.getZones(camera.camera_id).then(setZones).catch(() => {});
    }
  }, [camera.camera_id]);

  // Video Streaming WebSocket

  useEffect(() => {
    if (!autoPlay || camera.enabled === false) {
      return;
    }

    let isSubscribed = true;
    let ws: LiveFeedWebSocket | null = null;
    let retryTimer: any = null;

    if (!useFallbackMjpeg) {
      try {
        ws = new LiveFeedWebSocket(
          camera.camera_id,
          (blobUrl) => {
            if (!isSubscribed) return;
            setFrameSrc(blobUrl);
            setStreamError(false);

            frameCountRef.current += 1;
            const now = Date.now();
            if (now - lastFpsCalcRef.current >= 1000) {
              setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcRef.current)));
              frameCountRef.current = 0;
              lastFpsCalcRef.current = now;
            }
          },
          (err) => {
            console.warn(`WebSocket stream notice for ${camera.camera_id}, fallback active:`, err);
            if (isSubscribed) {
              setUseFallbackMjpeg(true);
            }
          }
        );
        wsVideoRef.current = ws;
      } catch (e) {
        if (isSubscribed) {
          setUseFallbackMjpeg(true);
        }
      }
    } else {
      // Gracefully retry reconnecting WebSocket stream after 10s
      retryTimer = setTimeout(() => {
        if (isSubscribed) {
          setUseFallbackMjpeg(false);
        }
      }, 10000);
    }

    return () => {
      isSubscribed = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [camera.camera_id, camera.enabled, autoPlay, useFallbackMjpeg]);

  // Layer 3: Automated Rapid Snapshot Polling Fallback
  useEffect(() => {
    if (!autoPlay || camera.enabled === false) return;

    let timer: any = null;
    if (useFallbackMjpeg || streamError || !frameSrc) {
      const pollSnapshot = () => {
        if (!frameSrc) {
          setSnapshotSrc(cameraService.getSnapshotUrl(camera.camera_id));
        }
      };
      timer = setInterval(pollSnapshot, 800);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [useFallbackMjpeg, streamError, frameSrc, camera.camera_id, camera.enabled, autoPlay]);

  // AI Telemetry WebSocket
  useEffect(() => {
    if (!autoPlay || camera.enabled === false) return;

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
            {/* Tactical Tunnel / Edge Relay Status */}
            {camera.edge_node_id && camera.edge_node_id !== 'CENTRAL' && camera.edge_node_id !== 'NONE' && (
              <span
                className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                title={`Connected via Border Edge Appliance ${camera.edge_node_id} (Outbound Reverse Push / Encrypted Tunnel)`}
              >
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                TUNNEL RELAY
              </span>
            )}

            {/* Stream Profile Switcher (HD vs SD Sub-Stream) */}
            <button
              onClick={() => setStreamProfile(p => p === 'main' ? 'sub' : 'main')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                streamProfile === 'sub'
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-300 shadow-sm'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={streamProfile === 'sub' ? 'SD Sub-Stream Active: Consumes ~75% less bandwidth for slow border connections' : 'HD Main Stream Active: Click to switch to low-bandwidth SD'}
            >
              {streamProfile === 'sub' ? 'SD (SUB -75%)' : 'HD (MAIN)'}
            </button>

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
        {camera.enabled && (camera.status === 'HEALTHY' || camera.status === 'ONLINE') && showAiOverlay && (
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
        <div className="relative flex-1 flex items-center justify-center min-h-[160px] sm:min-h-[220px] bg-slate-950 overflow-hidden">
          {camera.enabled !== false ? (
            <>
              {isBroadcastingLocalCam ? (
                <>
                  {/* Direct Local Video preview: Instant 60 FPS zero-latency */}
                  <video
                    ref={localVideoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-contain select-none bg-black"
                  />
                  {/* Top Active Broadcast Overlay Banner */}
                  <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 rounded-md text-[10px] font-mono font-bold shadow-lg animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>LIVE FROM THIS DEVICE</span>
                    </div>
                    <button
                      type="button"
                      onClick={flipCamera}
                      className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-md text-[10px] font-mono transition flex items-center gap-1 cursor-pointer"
                      title="Flip Front / Rear Camera"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span className="hidden sm:inline">Flip</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopLocalCamBroadcast}
                      className="p-1.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-600 rounded-md text-[10px] font-mono transition flex items-center gap-1 cursor-pointer"
                      title="Stop Camera Stream"
                    >
                      <Square className="w-3 h-3" />
                      <span className="hidden sm:inline">Stop</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {frameSrc ? (
                    <img
                      src={frameSrc}
                      alt={camera.camera_name}
                      className="w-full h-full object-contain select-none"
                    />
                  ) : !useFallbackMjpeg && !streamError ? (
                    <img
                      src={cameraService.getLiveStreamUrl(camera.camera_id, streamProfile === 'sub' ? 15 : 25, streamProfile)}
                      alt={camera.camera_name}
                      className="w-full h-full object-contain select-none"
                      onError={() => {
                        setUseFallbackMjpeg(true);
                        setStreamError(true);
                      }}
                    />
                  ) : (
                    <img
                      src={snapshotSrc || cameraService.getSnapshotUrl(camera.camera_id)}
                      alt={camera.camera_name}
                      className="w-full h-full object-contain select-none"
                      onError={() => {}}
                    />
                  )}

                  {/* Central 1-Click Interactive Activation Overlay ONLY for direct browser phone/webcam edge nodes */}
                  {(camera.rtsp_url?.startsWith('edge://') || (camera.stream_type === 'android' && !camera.rtsp_url?.startsWith('http'))) &&
                    !frameSrc &&
                    !isBroadcastingLocalCam && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-[2px] p-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center mb-2.5 shadow-lg shadow-emerald-950/60 animate-bounce">
                        <Smartphone className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h4 className="text-xs font-bold font-mono text-white tracking-wider mb-1 uppercase">
                        {camera.stream_type === 'webcam' ? 'Laptop / USB Webcam Node' : 'Phone / Mobile Camera Node'}
                      </h4>
                      <p className="text-[11px] text-slate-300 max-w-xs mb-3 font-sans leading-tight">
                        Turn on this phone or laptop's camera to stream real-time video directly into this outpost.
                      </p>
                      <button
                        type="button"
                        onClick={() => startLocalCamBroadcast()}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-mono font-bold text-xs rounded-lg shadow-lg shadow-emerald-900/50 border border-emerald-400 flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <CameraIcon className="w-3.5 h-3.5" />
                        <span>START LIVE CAMERA STREAM</span>
                      </button>
                    </div>
                  )}

                  {/* Hidden local video capture source when inactive */}
                  <video ref={localVideoRef} playsInline muted className="hidden" />
                </>
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
                CAMERA DISABLED
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                Camera feed is disabled by administrator policy.
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

              {/* Device / Phone Camera Broadcaster Button */}
              <button
                onClick={() => startLocalCamBroadcast()}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                  isBroadcastingLocalCam
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/40 animate-pulse'
                    : 'bg-slate-900/80 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 border-slate-700/60'
                }`}
                title={isBroadcastingLocalCam ? 'Stop Broadcasting Phone/Device Camera' : 'Stream Phone/Device Camera Directly into this Node'}
              >
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">{isBroadcastingLocalCam ? 'BROADCASTING' : 'PHONE CAM'}</span>
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
