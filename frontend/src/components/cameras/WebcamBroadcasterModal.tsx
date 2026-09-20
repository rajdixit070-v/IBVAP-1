import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from '../../types/camera';
import { Modal } from '../common/Modal';
import { cameraService } from '../../services/cameraService';
import { Video, VideoOff, Radio, CheckCircle2, AlertCircle, Laptop } from 'lucide-react';

interface WebcamBroadcasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  camera: Camera | null;
}

export const WebcamBroadcasterModal: React.FC<WebcamBroadcasterModalProps> = ({
  isOpen,
  onClose,
  camera
}) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [framesSent, setFramesSent] = useState(0);
  const [liveFps, setLiveFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const framesCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());
  const isBroadcastingRef = useRef(false);

  // Stop broadcasting and release hardware
  const stopBroadcasting = useCallback(() => {
    isBroadcastingRef.current = false;
    setIsBroadcasting(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Clean up on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopBroadcasting();
      setFramesSent(0);
      setLiveFps(0);
      setDeviceError(null);
    }
  }, [isOpen, stopBroadcasting]);

  const startBroadcasting = async () => {
    if (!camera?.camera_id) return;
    setDeviceError(null);

    try {
      // Request laptop/device webcam with 720p / 480p resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      isBroadcastingRef.current = true;
      setIsBroadcasting(true);
      framesCountRef.current = 0;
      lastFpsCalcRef.current = Date.now();

      // Broadcast frames to Render Cloud at ~12-15 FPS (every 75ms)
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      timerRef.current = setInterval(() => {
        if (!isBroadcastingRef.current || !videoRef.current || !ctx) return;

        try {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          canvas.toBlob(
            (blob) => {
              if (blob && camera?.camera_id && isBroadcastingRef.current) {
                cameraService.ingestDirectFrame(camera.camera_id, blob).catch(() => {});
                framesCountRef.current += 1;
                setFramesSent((prev) => prev + 1);

                const now = Date.now();
                if (now - lastFpsCalcRef.current >= 1000) {
                  setLiveFps(Math.round((framesCountRef.current * 1000) / (now - lastFpsCalcRef.current)));
                  framesCountRef.current = 0;
                  lastFpsCalcRef.current = now;
                }
              }
            },
            'image/jpeg',
            0.65
          );
        } catch (e) {
          // ignore dropped canvas frames
        }
      }, 75);
    } catch (err: any) {
      stopBroadcasting();
      if (err.name === 'NotAllowedError') {
        setDeviceError('Camera access denied. Please allow browser camera permission to stream.');
      } else if (err.name === 'NotFoundError') {
        setDeviceError('No webcam hardware found on this device.');
      } else {
        setDeviceError(err.message || 'Unable to access laptop webcam.');
      }
    }
  };

  if (!isOpen || !camera) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopBroadcasting();
        onClose();
      }}
      title={`Broadcast Laptop Webcam • [${camera.camera_id}]`}
      subtitle="Stream your laptop's real camera directly into Central Command via Cloud Reverse Edge Ingestion"
      maxWidth="xl"
    >
      <div className="space-y-4">
        {deviceError && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{deviceError}</span>
          </div>
        )}

        {/* Video Canvas Box */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isBroadcasting ? 'block' : 'hidden'}`}
          />

          {!isBroadcasting && (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                <Laptop className="w-6 h-6" />
              </div>
              <div className="text-xs font-mono">
                <p className="text-slate-200 font-semibold uppercase">Laptop Camera Ready</p>
                <p className="text-slate-500 text-[11px] mt-1">
                  Click "Start Broadcasting" to stream your real camera feed to the Cloud Video Wall.
                </p>
              </div>
            </div>
          )}

          {/* Broadcaster HUD Tag */}
          {isBroadcasting && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-600/90 text-white font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 animate-pulse">
                <Radio className="w-3 h-3" /> LIVE BROADCASTING
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950/80 text-cyan-300 border border-cyan-800/60 font-mono text-[10px] font-bold">
                {liveFps > 0 ? `${liveFps} FPS` : '15 FPS'}
              </span>
            </div>
          )}
        </div>

        {/* Streaming Diagnostics */}
        <div className="bg-[#0b1220] border border-[#1e2c44] rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Target Camera</span>
            <span className="text-sky-300 font-bold">{camera.camera_id}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Frames Ingested</span>
            <span className="text-emerald-400 font-bold">{framesSent}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Cloud Sync</span>
            <span className={isBroadcasting ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {isBroadcasting ? 'ONLINE (RENDER)' : 'STANDBY'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded border border-slate-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Jaise hi broadcast start hoga, <strong>Render Cloud</strong> aapke laptop ke camera se real frames lena shuru kar dega.
            Admin aur Commander dono ko <strong>"Live Border Video Wall"</strong> par real video aur AI detection dikhne lagega!
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              stopBroadcasting();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>

          {!isBroadcasting ? (
            <button
              type="button"
              onClick={startBroadcasting}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              START BROADCASTING
            </button>
          ) : (
            <button
              type="button"
              onClick={stopBroadcasting}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20 cursor-pointer"
            >
              <VideoOff className="w-4 h-4" />
              STOP BROADCASTING
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
