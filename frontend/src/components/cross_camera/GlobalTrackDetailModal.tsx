import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { GlobalTrackDetail, TrackObservation } from '../../types/crossCamera';
import { crossCameraService } from '../../services/crossCameraService';
import { useCameras } from '../../context/CameraContext';
import { LiveVideoPlayer } from '../cameras/LiveVideoPlayer';
import {
  Radio,
  ArrowRight,
  AlertTriangle,
  Layers
} from 'lucide-react';

interface GlobalTrackDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalTrackId: string | null;
}

export const GlobalTrackDetailModal: React.FC<GlobalTrackDetailModalProps> = ({
  isOpen,
  onClose,
  globalTrackId
}) => {
  const { cameras } = useCameras();
  const [detail, setDetail] = useState<GlobalTrackDetail | null>(null);
  const [selectedObs, setSelectedObs] = useState<TrackObservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (globalTrackId && isOpen) {
      loadTrackDetail();
    }
  }, [globalTrackId, isOpen]);

  const loadTrackDetail = async () => {
    if (!globalTrackId) return;
    setLoading(true);
    try {
      const data = await crossCameraService.getGlobalTrackDetail(globalTrackId);
      setDetail(data);
      if (data.observations.length > 0) {
        setSelectedObs(data.observations[data.observations.length - 1]);
      }
    } catch (e) {
      console.error('Failed to load global track detail', e);
    } finally {
      setLoading(false);
    }
  };

  if (!detail && !loading) return null;

  const currentCam = cameras.find((c) => c.camera_id === (selectedObs?.camera_id || detail?.current_camera_id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={detail ? `Multi-Camera Journey Dossier // ${detail.global_track_id}` : 'Global Track Dossier'}
      subtitle={detail ? `Continuous ${detail.object_type.toUpperCase()} Track • Primary ID: ${detail.primary_identifier || 'N/A'}` : 'Loading movement timeline...'}
      maxWidth="3xl"
    >
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-xs">
          Reconstructing multi-camera movement history...
        </div>
      ) : detail ? (
        <div className="space-y-6">
          {/* Top Status Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#090d16] p-4 rounded-xl border border-[#1e293b] font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">TRACK STATUS</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block mt-0.5 border ${
                  detail.status === 'ACTIVE'
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {detail.status}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">TOTAL CAMERA STOPS</span>
              <span className="text-white font-bold block mt-0.5">
                {detail.total_observations} Observations
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">OVERALL CONFIDENCE</span>
              <span className="text-sky-400 font-bold block mt-0.5">
                {Math.round(detail.overall_confidence * 100)}% Match
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">PRIMARY IDENTIFIER</span>
              <span className="text-amber-400 font-bold block mt-0.5">
                {detail.primary_identifier || 'Unknown Target'}
              </span>
            </div>
          </div>

          {/* Sequential Multi-Camera Journey Timeline */}
          <div className="bg-[#090d16] p-4 rounded-xl border border-[#1e293b] space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Reconstructed Multi-Camera Trajectory Sequence
            </h4>

            <div className="flex items-center gap-2 overflow-x-auto py-2">
              {detail.observations.map((obs, idx) => {
                const isSelected = selectedObs?.observation_id === obs.observation_id;
                return (
                  <React.Fragment key={obs.observation_id}>
                    <div
                      onClick={() => setSelectedObs(obs)}
                      className={`p-3 rounded-xl border transition cursor-pointer shrink-0 space-y-1 ${
                        isSelected
                          ? 'bg-[#14233c] border-sky-500 text-white shadow-lg'
                          : 'bg-[#111a2e] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="font-bold text-sky-400">STOP #{idx + 1}</span>
                        <span className="text-slate-400">{new Date(obs.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs font-bold text-white">{obs.camera_id}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Local Track #{obs.local_track_id} • {obs.direction}
                      </div>
                    </div>

                    {idx < detail.observations.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Live Camera View of Selected Stop & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                  SURVEILLANCE FEED // {selectedObs?.camera_id || detail.current_camera_id}
                </span>
                <span className="text-slate-500">Track #{selectedObs?.local_track_id}</span>
              </div>

              {currentCam ? (
                <div className="rounded-xl overflow-hidden border border-[#1e293b] shadow-lg">
                  <LiveVideoPlayer camera={currentCam} showControls={false} />
                </div>
              ) : (
                <div className="bg-[#090d16] border border-[#1e293b] p-8 rounded-xl text-center text-slate-500 text-xs font-mono">
                  Camera feed disconnected.
                </div>
              )}
            </div>

            {/* Pairwise Associations & Anomalies */}
            <div className="space-y-4">
              {detail.anomalies.length > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300 font-mono">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Movement Anomalies Detected ({detail.anomalies.length})</span>
                  </div>
                  {detail.anomalies.map((anm) => (
                    <div key={anm.id} className="text-[11px] font-mono text-rose-200">
                      • <strong>{anm.anomaly_type}</strong>: {anm.from_camera_id} $\to$ {anm.to_camera_id} ({anm.time_delta_sec}s)
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[#090d16] p-4 rounded-xl border border-[#1e293b] space-y-2">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase">
                  Cross-Camera Association Links
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {detail.associations.length === 0 ? (
                    <div className="text-[11px] font-mono text-slate-500">Single camera sighting recorded.</div>
                  ) : (
                    detail.associations.map((asc) => (
                      <div
                        key={asc.id}
                        className="p-2.5 bg-[#111a2e] rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="space-y-0.5">
                          <div className="text-white font-bold">
                            {asc.from_camera_id} <span className="text-slate-500">$\to$</span> {asc.to_camera_id}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Category: {asc.match_category.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sky-400 font-bold block">{Math.round(asc.association_score * 100)}%</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {asc.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
