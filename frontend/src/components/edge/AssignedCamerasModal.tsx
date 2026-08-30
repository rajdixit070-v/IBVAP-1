import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { EdgeNode, EdgeAssignedCamera } from '../../types/edge';
import { edgeService } from '../../services/edgeService';
import { Camera, Radio, RefreshCw } from 'lucide-react';

interface AssignedCamerasModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: EdgeNode | null;
}

export const AssignedCamerasModal: React.FC<AssignedCamerasModalProps> = ({
  isOpen,
  onClose,
  node
}) => {
  const [cameras, setCameras] = useState<EdgeAssignedCamera[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && node) {
      loadCameras();
    }
  }, [isOpen, node]);

  const loadCameras = async () => {
    if (!node) return;
    try {
      setLoading(true);
      const data = await edgeService.getNodeCameras(node.node_id);
      setCameras(data);
    } catch (e) {
      console.error('Failed to load edge node cameras', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`LOCAL CAMERAS MANAGED BY ${node?.node_id || 'EDGE NODE'}`}
      maxWidth="xl"
    >
      <div className="space-y-4 text-xs font-mono">
        <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-400">Border Outpost</span>
            <div className="text-white font-bold">{node?.bop_site}</div>
          </div>
          <button
            onClick={loadCameras}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>

        <div className="space-y-2">
          {cameras.length === 0 ? (
            <div className="p-8 text-center bg-[#090d16] border border-slate-800 rounded-xl text-slate-500">
              <Camera className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <div>No cameras currently assigned to this Edge Node.</div>
              <div className="text-[11px] text-slate-600 mt-1">
                Assign cameras in the Camera Registry by selecting this Edge Node.
              </div>
            </div>
          ) : (
            cameras.map((c) => (
              <div
                key={c.camera_id}
                className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-white font-bold flex items-center gap-2">
                      <span>{c.camera_name}</span>
                      <span className="text-[10px] text-slate-500">({c.camera_id})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Stream: <span className="uppercase text-slate-300">{c.stream_type}</span> • FPS: {c.fps || 15}
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      c.status === 'HEALTHY' || c.status === 'EDGE_MANAGED'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    {c.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
