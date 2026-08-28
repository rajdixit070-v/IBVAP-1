import React, { useState } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { CameraDetailsModal } from '../components/cameras/CameraDetailsModal';
import { CameraModal } from '../components/cameras/CameraModal';
import {
  RefreshCw,
  Cctv,
  Radio
} from 'lucide-react';

export const LivePreviewPage: React.FC = () => {
  const { cameras, selectedBop, setSelectedBop, refreshCameras } = useCameras();

  const [gridMode, setGridMode] = useState<'1' | '4' | '9'>('4');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Modals state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cameraForDetails, setCameraForDetails] = useState<Camera | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cameraForEdit, setCameraForEdit] = useState<Camera | null>(null);

  const activeCameras = cameras.filter((c: Camera) => c.enabled);
  const uniqueBops: string[] = Array.from(new Set(cameras.map((c: Camera) => c.bop_site)));

  // Display cameras depending on layout
  const getDisplayCameras = () => {
    if (gridMode === '1') {
      const selected = cameras.find((c: Camera) => c.camera_id === selectedCameraId) || activeCameras[0];
      return selected ? [selected] : [];
    }
    if (gridMode === '4') {
      return activeCameras.slice(0, 4);
    }
    return activeCameras.slice(0, 9);
  };

  const displayCameras = getDisplayCameras();

  const handleInspect = (camera: Camera) => {
    setCameraForDetails(camera);
    setDetailsModalOpen(true);
  };

  const handleEdit = (camera: Camera) => {
    setCameraForEdit(camera);
    setEditModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & Grid Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Live Video Wall & Tactical Stream Grid
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ultra low-latency RTSP camera ingestion matrix with HUD metrics overlay
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Site Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-[#111a2e] border border-[#1e293b] rounded-lg px-2.5 py-1">
            <span className="text-slate-400 font-mono uppercase text-[10px]">SITE:</span>
            <select
              value={selectedBop}
              onChange={(e) => setSelectedBop(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-medium"
            >
              <option value="ALL" className="bg-[#111a2e]">All Outposts</option>
              {uniqueBops.map((bop: string) => (
                <option key={bop} value={bop} className="bg-[#111a2e]">
                  {bop}
                </option>
              ))}
            </select>
          </div>

          {/* Grid Layout Switcher */}
          <div className="flex items-center bg-[#111a2e] border border-[#1e293b] rounded-lg p-1 gap-1">
            <button
              onClick={() => setGridMode('1')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                gridMode === '1' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              1×1 FOCUS
            </button>
            <button
              onClick={() => setGridMode('4')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                gridMode === '4' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              2×2 GRID
            </button>
            <button
              onClick={() => setGridMode('9')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                gridMode === '9' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              3×3 MATRIX
            </button>
          </div>

          <button
            onClick={() => refreshCameras()}
            className="p-2 bg-[#111a2e] hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-lg border border-[#1e293b] transition"
            title="Refresh Streams"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Focus Mode Camera Selector Bar */}
      {gridMode === '1' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {cameras.map((cam: Camera) => (
            <button
              key={cam.camera_id}
              onClick={() => setSelectedCameraId(cam.camera_id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap border transition ${
                (selectedCameraId === cam.camera_id || (!selectedCameraId && cam === activeCameras[0]))
                  ? 'bg-sky-600/20 text-sky-400 border-sky-500 font-bold'
                  : 'bg-[#111a2e] text-slate-400 border-[#1e293b] hover:text-white'
              }`}
            >
              <Cctv className="w-3.5 h-3.5" />
              <span>{cam.camera_id}</span>
              <span className="text-[10px] text-slate-500">• {cam.camera_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Video Wall Surface */}
      {displayCameras.length === 0 ? (
        <div className="h-96 bg-[#111a2e] border border-[#1e293b] rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Radio className="w-8 h-8 text-sky-400/60" />
          </div>
          <h3 className="text-base font-bold text-white font-mono">NO ACTIVE STREAMS CONFIGURED</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            No enabled IP cameras found for the active filter. Go to Camera Management to register an RTSP camera stream.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            gridMode === '1'
              ? 'grid-cols-1'
              : gridMode === '4'
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {displayCameras.map((camera: Camera) => (
            <div
              key={camera.camera_id}
              className={`${gridMode === '1' ? 'h-[620px]' : gridMode === '4' ? 'h-[360px]' : 'h-[280px]'}`}
            >
              <LiveVideoPlayer
                camera={camera}
                showControls={true}
                className="w-full h-full"
                onOpenDetails={() => handleInspect(camera)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CameraDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        camera={cameraForDetails}
        onRefresh={refreshCameras}
        onEdit={handleEdit}
      />

      <CameraModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={refreshCameras}
        cameraToEdit={cameraForEdit}
      />
    </div>
  );
};
