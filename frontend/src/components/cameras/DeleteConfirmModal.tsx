import React from 'react';
import { Modal } from '../common/Modal';
import { Camera } from '../../types/camera';
import { AlertTriangle, Trash2, XCircle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  camera: Camera | null;
  loading: boolean;
  error?: string | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  camera,
  loading,
  error
}) => {
  if (!camera) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Camera Removal"
      subtitle={`De-registering ${camera.camera_id}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-300">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-rose-200">
              Are you sure you want to delete camera <span className="font-mono font-bold text-white">{camera.camera_id}</span> ({camera.camera_name})?
            </p>
            <p className="text-rose-300/80">
              This will stop the RTSP stream ingestion, release system decoding resources, and remove all associated diagnostic logs.
            </p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-500/60 rounded-lg flex items-start gap-2 text-red-300 text-xs">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'DELETING...' : 'DELETE CAMERA'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

