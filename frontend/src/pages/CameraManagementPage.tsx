import React, { useState, useMemo } from 'react';
import { useCameras } from '../context/CameraContext';
import { Camera } from '../types/camera';
import { CameraTable } from '../components/cameras/CameraTable';
import { CameraCard } from '../components/cameras/CameraCard';
import { CameraModal } from '../components/cameras/CameraModal';
import { CameraDetailsModal } from '../components/cameras/CameraDetailsModal';
import { RTSPTestModal } from '../components/cameras/RTSPTestModal';
import { DeleteConfirmModal } from '../components/cameras/DeleteConfirmModal';
import { AIControlModal } from '../components/ai/AIControlModal';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  Cctv
} from 'lucide-react';

interface CameraManagementPageProps {
  onLocateOnMap?: (camera: Camera) => void;
}

export const CameraManagementPage: React.FC<CameraManagementPageProps> = ({ onLocateOnMap }) => {
  const {
    cameras,
    loading,
    selectedBop,
    selectedStatus,
    searchQuery,
    setSelectedBop,
    setSelectedStatus,
    setSearchQuery,
    refreshCameras,
    testConnection,
    deleteCamera
  } = useCameras();

  const { user } = useAuth();
  const isSuperAdmin = 
    user?.role === 'admin' || 
    user?.role === 'SUPER_ADMIN' || 
    user?.role === 'superadmin' ||
    user?.scope_type === 'GLOBAL';

  // Unified Camera Visibility: Central HQ Admin and Border Outpost Commanders share full operational oversight
  const scopedCameras = cameras;




  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [selectedCameraForEdit, setSelectedCameraForEdit] = useState<Camera | null>(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCameraForView, setSelectedCameraForView] = useState<Camera | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AI Detection Tuning state
  const [selectedCameraForAI, setSelectedCameraForAI] = useState<Camera | null>(null);

  // RTSP Quick Test state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testingCamName, setTestingCamName] = useState<string>('');

  // Extract unique BOPs
  const uniqueBops: string[] = useMemo(() => Array.from(new Set(scopedCameras.map((c: Camera) => c.bop_site))).filter(Boolean), [scopedCameras]);

  const handleOpenAddModal = () => {
    setSelectedCameraForEdit(null);
    setCameraModalOpen(true);
  };

  const handleOpenEditModal = (cam: Camera) => {
    setSelectedCameraForEdit(cam);
    setCameraModalOpen(true);
  };

  const handleOpenViewModal = (cam: Camera) => {
    setSelectedCameraForView(cam);
    setDetailsModalOpen(true);
  };

  const handleOpenDeleteModal = (cam: Camera) => {
    setCameraToDelete(cam);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cameraToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const targetId = cameraToDelete.camera_id || String(cameraToDelete.id);
      await deleteCamera(targetId);
      setDeleteModalOpen(false);
      setCameraToDelete(null);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Failed to delete camera.';
      setDeleteError(errMsg);
      console.error('Failed to delete camera', e);
    } finally {
      setDeleting(false);
    }
  };


  const handleQuickTest = async (cam: Camera) => {
    setTestingCamName(cam.camera_name);
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);
    try {
      const res = await testConnection(cam.camera_id);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        connected: false,
        error_type: 'NETWORK_ERROR',
        error_message: err.response?.data?.detail || err.message || 'Testing error.'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Cctv className="w-5 h-5 text-sky-400" />
            {isSuperAdmin ? 'Central Surveillance Stream Matrix • National Federation' : 'Wagah Checkpost Camera Fleet • Tactical Ground Control'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {isSuperAdmin
              ? 'Real-time HQ stream monitoring & diagnostics for all cameras deployed across India border commands'
              : 'Configure PoE IP cameras, NVR/DVR channels, and manage tactical sentry points for Attari-Wagah Outpost'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refreshCameras()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            Refresh
          </button>

          {!isSuperAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              REGISTER NEW CAMERA
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Camera ID, Name, Location..."
            className="w-full bg-[#0b101c] border border-[#22324d] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* BOP Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-mono uppercase text-[10px]">BOP:</span>
            <select
              value={selectedBop}
              onChange={(e) => setSelectedBop(e.target.value)}
              className="bg-[#0b101c] border border-[#22324d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">All BOPs / Sites</option>
              {uniqueBops.map((bop: string) => (
                <option key={bop} value={bop}>
                  {bop}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-mono uppercase text-[10px]">STATUS:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#0b101c] border border-[#22324d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="HEALTHY">Healthy (Live)</option>
              <option value="DEGRADED">Degraded</option>
              <option value="OFFLINE">Offline</option>
              <option value="ERROR">Error</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0b101c] border border-[#22324d] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${
                viewMode === 'table' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        <CameraTable
          cameras={scopedCameras}
          onView={handleOpenViewModal}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteModal}
          onTest={handleQuickTest}
          onLocate={onLocateOnMap}
          onConfigureAI={(cam) => setSelectedCameraForAI(cam)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scopedCameras.map((camera: Camera) => (
            <CameraCard
              key={camera.camera_id}
              camera={camera}
              onView={handleOpenViewModal}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteModal}
              onTest={handleQuickTest}
              onLocate={onLocateOnMap}
              onConfigureAI={(cam) => setSelectedCameraForAI(cam)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Camera Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={refreshCameras}
        cameraToEdit={selectedCameraForEdit}
      />

      {/* Camera Full Details & Live Inspection Modal */}
      <CameraDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        camera={selectedCameraForView}
        onRefresh={refreshCameras}
        onEdit={isSuperAdmin ? undefined : handleOpenEditModal}
        onConfigureAI={(cam) => setSelectedCameraForAI(cam)}
      />

      {/* AI Inference & Detection Tuning Modal */}
      {selectedCameraForAI && (
        <AIControlModal
          isOpen={!!selectedCameraForAI}
          onClose={() => setSelectedCameraForAI(null)}
          cameraId={selectedCameraForAI.camera_id}
          cameraName={selectedCameraForAI.camera_name}
          onSaved={refreshCameras}
        />
      )}

      {/* RTSP Diagnostic Result Modal */}
      <RTSPTestModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        result={testResult}
        loading={testing}
        cameraName={testingCamName}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteError(null); }}
        onConfirm={handleConfirmDelete}
        camera={cameraToDelete}
        loading={deleting}
        error={deleteError}
      />

    </div>
  );
};
