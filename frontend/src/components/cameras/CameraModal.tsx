import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraCreateInput, CameraUpdateInput, CameraTestResponse } from '../../types/camera';
import { cameraService } from '../../services/cameraService';
import { RTSPTestModal } from './RTSPTestModal';
import { Activity, Cctv, Radio, Eye, EyeOff, Save, MapPin, Navigation, Laptop, Globe } from 'lucide-react';
import { webcamStreamService } from '../../services/webcamStreamService';
import { useAuth } from '../../context/AuthContext';

const BOP_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'bop wagah': { lat: 31.6048, lng: 74.5721 },
  'bop-wagah': { lat: 31.6048, lng: 74.5721 },
  'wagah': { lat: 31.6048, lng: 74.5721 },
  'bop munabao': { lat: 25.7197, lng: 70.2520 },
  'bop-munabao': { lat: 25.7197, lng: 70.2520 },
  'munabao': { lat: 25.7197, lng: 70.2520 },
  'bop longewala': { lat: 27.5255, lng: 70.1558 },
  'bop-longewala': { lat: 27.5255, lng: 70.1558 },
  'longewala': { lat: 27.5255, lng: 70.1558 },
  'bop sadqi': { lat: 30.9328, lng: 74.2825 },
  'bop-sadqi': { lat: 30.9328, lng: 74.2825 },
  'sadqi': { lat: 30.9328, lng: 74.2825 },
  'bop hussainiwala': { lat: 30.9328, lng: 74.6048 },
  'bop-hussaini': { lat: 30.9328, lng: 74.6048 },
  'hussainiwala': { lat: 30.9328, lng: 74.6048 },
  'bop uri': { lat: 34.0886, lng: 74.0416 },
  'bop-uri': { lat: 34.0886, lng: 74.0416 },
  'uri': { lat: 34.0886, lng: 74.0416 },
  'bop kupwara': { lat: 34.7578, lng: 74.2541 },
  'bop-kupwara': { lat: 34.7578, lng: 74.2541 },
  'kupwara': { lat: 34.7578, lng: 74.2541 }
};

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
    latitude: 31.6048,
    longitude: 74.5721,
    rtsp_url: '',
    username: '',
    password: '',
    stream_type: 'main',
    enabled: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPS state
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

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
      const bopKey = (defaultBop || '').trim().toLowerCase();
      const defaultCoords = BOP_COORDINATES[bopKey] || { lat: 31.6048, lng: 74.5721 };
      setFormData({
        camera_id: `CAM-${randomSuffix}`,
        camera_name: 'Perimeter Sentry Camera',
        description: 'Border surveillance camera feed.',
        bop_site: defaultBop,
        sector: defaultSector,
        location: 'Tower 1',
        latitude: defaultCoords.lat,
        longitude: defaultCoords.lng,
        rtsp_url: 'rtsp://192.168.1.100:554/live',
        username: 'admin',
        password: '',
        stream_type: 'main',
        enabled: true
      });
    }
    setError(null);
    setGpsMessage(null);
  }, [cameraToEdit, isOpen, defaultBop, defaultSector]);

  const handleBopChange = (newBop: string) => {
    const bopKey = newBop.trim().toLowerCase();
    const coords = BOP_COORDINATES[bopKey];
    setFormData(prev => ({
      ...prev,
      bop_site: newBop,
      latitude: coords ? coords.lat : prev.latitude,
      longitude: coords ? coords.lng : prev.longitude
    }));
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Geolocation is not supported by your browser.');
      setTimeout(() => setGpsMessage(null), 4000);
      return;
    }
    setDetectingGps(true);
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        setDetectingGps(false);
        setGpsMessage(`Device GPS Locked: ${lat}°N, ${lng}°E (Accuracy ±${Math.round(pos.coords.accuracy)}m)`);
        setTimeout(() => setGpsMessage(null), 4000);
      },
      (err) => {
        setDetectingGps(false);
        setGpsMessage('GPS Detection failed: ' + err.message);
        setTimeout(() => setGpsMessage(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleStreamTypeChange = (newType: string) => {
    let suggestedUrl = formData.rtsp_url;
    const isDefaultUrl = !formData.rtsp_url || 
      formData.rtsp_url.startsWith('rtsp://192.168.1.100') ||
      formData.rtsp_url.startsWith('http://192.168.1.50') ||
      formData.rtsp_url.startsWith('webcam://') ||
      formData.rtsp_url.startsWith('rtsp://192.168.1.200') ||
      formData.rtsp_url.startsWith('rtsp://192.168.1.120');

    if (isDefaultUrl && !isEditing) {
      if (newType === 'tunnel') {
        suggestedUrl = 'https://xxxx.trycloudflare.com/api/stream.m3u8?src=mycamera';
      } else if (newType === 'ip_camera') {
        suggestedUrl = 'rtsp://192.168.1.100:554/live';
      } else if (newType === 'phone') {
        suggestedUrl = 'http://192.168.1.50:8080/video';
      } else if (newType === 'webcam') {
        suggestedUrl = 'webcam://0';
      } else if (newType === 'drone') {
        suggestedUrl = 'rtsp://192.168.1.200:8554/live';
      } else if (newType === 'thermal') {
        suggestedUrl = 'rtsp://192.168.1.120:554/Streaming/Channels/201';
      } else {
        suggestedUrl = 'rtsp://192.168.1.100:554/live';
      }
    }

    setFormData(prev => ({
      ...prev,
      stream_type: newType,
      rtsp_url: suggestedUrl
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.rtsp_url.trim()) {
      setError('Please provide an RTSP URL to test.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);
    try {
      if (formData.stream_type === 'webcam' || formData.rtsp_url.startsWith('webcam://')) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
          setTestResult({
            success: true,
            connected: true,
            resolution: '640x480 (Laptop Webcam)',
            fps: 15.0,
            codec: 'Direct Web MediaStream',
            latency_ms: 2.5,
            details: { mode: 'Laptop Integrated / USB Webcam', status: 'Ready to Stream Live' }
          });
          return;
        } catch (camErr: any) {
          setTestResult({
            success: false,
            connected: false,
            error_type: 'DEVICE_PERMISSION_ERROR',
            error_message: camErr.message || 'Please allow browser camera permission to test webcam.'
          });
          return;
        }
      }

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

      // If registered camera is a laptop webcam, automatically activate browser stream
      if (formData.stream_type === 'webcam' || formData.rtsp_url.startsWith('webcam://')) {
        const targetId = isEditing ? cameraToEdit!.camera_id : cleanCameraId!;
        webcamStreamService.startStream(targetId).catch(() => {});
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

  let streamPlaceholder = 'rtsp://192.168.1.100:554/live';
  let streamHelpText = 'Enter RTSP stream address. Hikvision, CP Plus, Dahua, PTZ, FLIR Thermal, and Drone feeds are fully supported.';

  if (formData.stream_type === 'tunnel') {
    streamPlaceholder = 'https://xxxx.trycloudflare.com/api/stream.m3u8?src=mycamera  (or http://localhost:1984/api/stream.m3u8?src=mycamera)';
    streamHelpText = '🌐 go2rtc + Cloudflare Tunnel: Connects your local DVR/NVR/IP camera to IBVAP securely across the internet without router port forwarding or credit cards. Supports HLS (.m3u8) & MJPEG (.mjpeg).';
  } else if (formData.stream_type === 'ip_camera') {
    streamPlaceholder = 'rtsp://192.168.1.100:554/live';
    streamHelpText = '📡 Standalone IP Camera (RTSP / ONVIF): Supports Hikvision, CP Plus, Dahua, Uniview, and all standard ONVIF/RTSP IP cameras.';
  } else if (formData.stream_type === 'phone') {
    streamPlaceholder = 'https://xxxx.ngrok-free.app/video  (or http://192.168.1.50:8080/video)';
    streamHelpText = '📱 Mobile / Phone IP Camera: Run "IP Webcam" app. If backend is on Render cloud, expose your local phone port with ngrok ("ngrok http 8080") to get a public HTTPS video URL.';
  } else if (formData.stream_type === 'webcam') {
    streamPlaceholder = 'webcam://0';
    streamHelpText = '💻 Web / USB Webcam: Enter "webcam://0" for built-in camera, or "webcam://1" for external USB webcam (when backend runs locally).';
  } else if (formData.stream_type === 'drone') {
    streamPlaceholder = 'rtsp://192.168.1.200:8554/live  (or udp://0.0.0.0:5600)';
    streamHelpText = '🚁 Drone / UAV Stream: Supports DJI RTSP (rtsp://...), RTMP ground station, or QGroundControl UDP.';
  } else if (formData.stream_type === 'thermal') {
    streamPlaceholder = 'rtsp://192.168.1.120:554/Streaming/Channels/201';
    streamHelpText = '🔥 Thermal IR Sensor: FLIR or dual-spectrum thermal RTSP channel with heat-signature detection.';
  } else if (formData.stream_type === 'ptz') {
    streamPlaceholder = 'rtsp://192.168.1.105:554/ptz_main';
    streamHelpText = '🎯 PTZ Speed Dome: 360° Pan/Tilt/Zoom optical turret with remote directional control & auto-tracking.';
  } else if (formData.stream_type === 'nvr') {
    streamPlaceholder = 'rtsp://192.168.1.110:554/ch1/main';
    streamHelpText = '📼 NVR / DVR Multi-Channel: Network Video Recorder channel stream (e.g. /ch1/main, /ch2/main).';
  } else if (formData.stream_type === 'sub') {
    streamPlaceholder = 'rtsp://192.168.1.100:554/sub';
    streamHelpText = '📡 Sub Stream (Low Bitrate SD): Secondary 640x360 bandwidth-saving stream for remote border posts.';
  } else {
    streamPlaceholder = 'rtsp://192.168.1.100:554/live';
    streamHelpText = '🌐 Main Stream (HD Optical RTSP): Primary 1080p surveillance feed from border watchtowers and checkposts.';
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? `Edit Camera [${cameraToEdit?.camera_id}]` : 'Register New Surveillance Camera'}
        subtitle="Configure stream connection parameters, geospatial coordinates, and sector deployment"
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
                  onChange={(e) => handleBopChange(e.target.value)}
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

            {/* GPS Geospatial Coordinates Box */}
            <div className="bg-[#0b1220] border border-[#1e2c44] rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-mono font-bold text-sky-300 uppercase tracking-wider">
                    GEOSPATIAL COORDINATES (GPS)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={detectingGps}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 rounded border border-sky-500/30 text-[11px] font-mono font-medium transition cursor-pointer disabled:opacity-50"
                  title="Auto-detect current device GPS coordinates"
                >
                  <Navigation className={`w-3 h-3 ${detectingGps ? 'animate-spin' : ''}`} />
                  {detectingGps ? 'LOCATING...' : 'AUTO-DETECT DEVICE GPS'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Latitude (°N) <span className="text-slate-500 font-normal font-mono">(Decimal e.g. 31.6048)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude ?? ''}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 31.6048"
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Longitude (°E) <span className="text-slate-500 font-normal font-mono">(Decimal e.g. 74.5721)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude ?? ''}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g. 74.5721"
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {gpsMessage && (
                <div className="text-[11px] font-mono text-sky-300 bg-sky-950/40 px-2.5 py-1 rounded border border-sky-800/40 flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 shrink-0 text-sky-400" />
                  <span>{gpsMessage}</span>
                </div>
              )}

              <p className="text-[10px] text-slate-500 font-mono">
                Used to plot this camera on the 2D Tactical Map, 3D Terrain Geospatial HUD, and Radar overlays.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stream Sensor Type</label>
                <select
                  value={formData.stream_type}
                  onChange={(e) => handleStreamTypeChange(e.target.value)}
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="main">Main Stream (HD Optical RTSP)</option>
                  <option value="tunnel">🌐 Cloudflare Tunnel / go2rtc (HLS .m3u8 / HTTP)</option>
                  <option value="ip_camera">📡 IP Camera (Standard RTSP / HTTP / ONVIF)</option>
                  <option value="nvr">📼 NVR / DVR Multi-Channel (Local / Port-Forwarded)</option>
                  <option value="sub">Sub Stream (Low Bitrate SD)</option>
                  <option value="thermal">Thermal Sensor Feed (FLIR IR)</option>
                  <option value="ptz">PTZ Surveillance Turret</option>
                  <option value="drone">Drone / UAV Aerial Feed</option>
                  <option value="phone">Phone / Mobile IP Camera (HTTP / RTSP)</option>
                  <option value="webcam">Web / USB Webcam (webcam://0)</option>
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

          {/* Section 2: Stream Ingestion Config */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4" /> 2. STREAM CONNECTION & CREDENTIALS
              </h4>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded border border-sky-500/40 text-xs font-mono font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'TESTING...' : 'TEST STREAM CONNECTION'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Stream URL (RTSP / HTTP / Web) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.rtsp_url}
                onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                placeholder={streamPlaceholder}
                className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-sky-300 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {streamHelpText}
              </p>
            </div>

            {formData.stream_type === 'tunnel' && (
              <div className="bg-teal-950/40 border border-teal-500/40 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <Globe className="w-4 h-4 text-teal-400" />
                  <span>CLOUDFLARE TUNNEL + go2rtc STREAM ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Aapka local DVR/NVR stream go2rtc aur Cloudflare Tunnel ke zariye Render cloud par bina kisi router port forwarding ya credit card ke 100% free &amp; secure connect hoga. Public tunnel URL paste karein aur "TEST STREAM CONNECTION" par click karein.
                </p>
              </div>
            )}

            {formData.stream_type === 'webcam' && (
              <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-lg p-3 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Laptop className="w-4 h-4 text-cyan-400" />
                  <span>LAPTOP WEBCAM AUTO-LINK ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans">
                  Camera register hote hi aapka browser is laptop ke webcam se live video Render cloud ko bhejna shuru kar dega, aur Live Video Wall par 100% live chalne lagega.
                </p>
              </div>
            )}

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
