import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraCreateInput, CameraUpdateInput, CameraTestResponse } from '../../types/camera';
import { cameraService } from '../../services/cameraService';
import { RTSPTestModal } from './RTSPTestModal';
import { Activity, Cctv, Radio, Eye, EyeOff, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cameraToEdit?: Camera | null;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cameraToEdit
}) => {
  const isEditing = !!cameraToEdit;
  const { user } = useAuth();

  const defaultBop = user?.post_name || 'BOP Wagah';
  const defaultSector = user?.sector || 'Punjab Frontier';

  const [formData, setFormData] = useState<CameraCreateInput>({
    camera_id: '',
    camera_name: '',
    description: '',
    bop_site: defaultBop,
    sector: defaultSector,
    location: '',
    latitude: undefined,
    longitude: undefined,
    rtsp_url: '',
    username: '',
    password: '',
    stream_type: 'main',
    enabled: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RTSP Testing state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CameraTestResponse | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  useEffect(() => {
    if (cameraToEdit) {
      setFormData({
        camera_id: cameraToEdit.camera_id,
        camera_name: cameraToEdit.camera_name,
        description: cameraToEdit.description || '',
        bop_site: cameraToEdit.bop_site || defaultBop,
        sector: cameraToEdit.sector || defaultSector,
        location: cameraToEdit.location || '',
        latitude: cameraToEdit.latitude,
        longitude: cameraToEdit.longitude,
        rtsp_url: cameraToEdit.rtsp_url,
        username: cameraToEdit.username || '',
        password: '', // Blank by default when editing
        stream_type: cameraToEdit.stream_type || 'main',
        enabled: cameraToEdit.enabled
      });
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setFormData({
        camera_id: `CAM-${randomSuffix}`,
        camera_name: 'Perimeter Sentry Camera',
        description: 'Border surveillance camera feed.',
        bop_site: defaultBop,
        sector: defaultSector,
        location: 'Tower 1',
        latitude: undefined,
        longitude: undefined,
        rtsp_url: 'rtsp://192.168.1.100:554/live',
        username: 'admin',
        password: '',
        stream_type: 'main',
        enabled: true
      });
    }
    setError(null);
  }, [cameraToEdit, isOpen, defaultBop, defaultSector]);

  const handleTestConnection = async () => {
    if (!formData.rtsp_url.trim()) {
      setError('Please provide an RTSP URL to test.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);
    try {
      let res: CameraTestResponse;
      if (isEditing && !formData.password) {
        res = await cameraService.testSavedCamera(cameraToEdit!.camera_id);
      } else {
        res = await cameraService.testRawStream({
          rtsp_url: formData.rtsp_url,
          username: formData.username || undefined,
          password: formData.password || undefined
        });
      }
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        connected: false,
        error_type: 'NETWORK_ERROR',
        error_message: err.response?.data?.detail || err.message || 'Unable to contact RTSP endpoint.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const cleanCameraId = formData.camera_id?.trim().toUpperCase();
      if (!isEditing && !cleanCameraId) {
        setError('Please enter a Camera ID.');
        setSaving(false);
        return;
      }
      if (!formData.rtsp_url?.trim()) {
        setError('Please enter a valid RTSP Stream URL.');
        setSaving(false);
        return;
      }

      if (isEditing) {
        const updatePayload: CameraUpdateInput = {
          camera_name: formData.camera_name,
          description: formData.description,
          bop_site: formData.bop_site,
          sector: formData.sector,
          location: formData.location,
          latitude: formData.latitude,
          longitude: formData.longitude,
          rtsp_url: formData.rtsp_url,
          username: formData.username,
          stream_type: formData.stream_type,
          enabled: formData.enabled
        };
        if (formData.password?.trim()) {
          updatePayload.password = formData.password;
        }
        await cameraService.updateCamera(cameraToEdit!.camera_id, updatePayload);
      } else {
        await cameraService.createCamera({
          ...formData,
          camera_id: cleanCameraId
        });
      }

      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
      window.dispatchEvent(new CustomEvent('ibvap:refresh-cameras'));

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save camera.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? `Edit Camera [${cameraToEdit?.camera_id}]` : 'Register New IP Camera'}
        subtitle="Configure RTSP connection parameters and deployment sector details"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Section 1: Identification */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Cctv className="w-4 h-4" /> 1. CAMERA IDENTIFICATION & SITE
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Camera ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={formData.camera_id}
                  onChange={(e) => setFormData({ ...formData, camera_id: e.target.value.toUpperCase() })}
                  placeholder="e.g. CAM-005"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Camera Name / Designation <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.camera_name}
                  onChange={(e) => setFormData({ ...formData, camera_name: e.target.value })}
                  placeholder="e.g. Perimeter Sentry Gate"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  BOP / Site <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.bop_site}
                  onChange={(e) => setFormData({ ...formData, bop_site: e.target.value })}
                  placeholder="e.g. BOP Wagah"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sector <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  placeholder="e.g. Punjab Frontier"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Specific Location / Tower
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Watchtower 1"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stream Sensor Type</label>
                <select
                  value={formData.stream_type}
                  onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="main">Main Stream (HD Optical Sentry)</option>
                  <option value="sub">Sub Stream (Low Bitrate SD)</option>
                  <option value="thermal">Thermal Sensor Feed (FLIR IR)</option>
                  <option value="ptz">PTZ Surveillance Turret</option>
                  <option value="drone">Drone / UAV Aerial Feed</option>
                  <option value="nvr">NVR / DVR Multi-Channel</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Operational State</label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Stream Enabled & Active</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: RTSP Ingestion Config */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4" /> 2. RTSP CONNECTION & CREDENTIALS
              </h4>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded border border-sky-500/40 text-xs font-mono font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'TESTING...' : 'TEST RTSP CONNECTION'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                RTSP Stream URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.rtsp_url}
                onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                placeholder="rtsp://192.168.1.100:554/live"
                className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-sky-300 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Enter RTSP stream address. Hikvision, CP Plus, Dahua, PTZ, FLIR Thermal, and Drone feeds are fully supported.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Camera Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Camera Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={isEditing ? '•••••••• (Leave blank to keep existing)' : 'Enter camera password'}
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'SAVING...' : isEditing ? 'UPDATE CAMERA' : 'REGISTER CAMERA'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RTSP Diagnostic Modal */}
      <RTSPTestModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        result={testResult}
        loading={testing}
        cameraName={formData.camera_name}
      />
    </>
  );
};
