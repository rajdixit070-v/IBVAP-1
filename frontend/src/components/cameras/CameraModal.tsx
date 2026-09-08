import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraCreateInput, CameraTestResponse } from '../../types/camera';
import { cameraService } from '../../services/cameraService';
import { edgeService } from '../../services/edgeService';
import { EdgeNode } from '../../types/edge';
import { RTSPTestModal } from './RTSPTestModal';
import {
  Activity,
  Cctv,
  Radio,
  Eye,
  EyeOff,
  Save,
  Laptop,
  Plane,
  Smartphone,
  Info,
  CheckCircle2,
  Server,
  Lock,
  MapPin,
  Compass,
  Locate,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cameraToEdit?: Camera | null;
}

type SourceCategory = 'rtsp' | 'webcam' | 'drone' | 'android' | 'synthetic';

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cameraToEdit
}) => {
  const isEditing = !!cameraToEdit;
  const { user } = useAuth();

  const [sourceCategory, setSourceCategory] = useState<SourceCategory>('rtsp');
  const [webcamIndex, setWebcamIndex] = useState<string>('0');
  const [dronePreset, setDronePreset] = useState<string>('dji_rtsp');
  const [androidAppMode, setAndroidAppMode] = useState<string>('ipwebcam_http');
  const [androidIp, setAndroidIp] = useState<string>('192.168.1.15');
  const [androidPort, setAndroidPort] = useState<string>('8080');

  const [formData, setFormData] = useState<CameraCreateInput>({
    camera_id: '',
    camera_name: '',
    description: '',
    bop_site: user?.scope_id && user?.scope_id !== '*' ? user.scope_id : '',
    sector: '',
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

  // Edge Management state
  const [edgeNodes, setEdgeNodes] = useState<EdgeNode[]>([]);
  const [isEdgeManaged, setIsEdgeManaged] = useState(false);
  const [selectedEdgeNodeId, setSelectedEdgeNodeId] = useState('');

  useEffect(() => {
    edgeService.getNodes().then(nodes => {
      setEdgeNodes(nodes);
      if (!cameraToEdit && nodes.length > 0) {
        setSelectedEdgeNodeId(nodes[0].node_id);
      }
    }).catch(console.error);

    if (cameraToEdit) {
      const edgeId = (cameraToEdit as any).edge_node_id;
      if (edgeId && edgeId !== 'CENTRAL' && edgeId !== 'LOCAL' && edgeId !== 'NONE') {
        setIsEdgeManaged(true);
        setSelectedEdgeNodeId(edgeId);
      } else {
        setIsEdgeManaged(false);
      }

      const url = cameraToEdit.rtsp_url || '';
      const st = cameraToEdit.stream_type || 'main';

      if (url.startsWith('webcam://') || st === 'webcam') {
        setSourceCategory('webcam');
        const idx = url.replace('webcam://', '').replace('device://', '').trim();
        setWebcamIndex(idx || '0');
      } else if (url.startsWith('synthetic://') || url.startsWith('test://')) {
        setSourceCategory('synthetic');
      } else if (st === 'drone' || url.startsWith('udp://') || url.startsWith('rtmp://')) {
        setSourceCategory('drone');
      } else if (st === 'android' || url.includes(':8080') || url.includes(':4747')) {
        setSourceCategory('android');
      } else {
        setSourceCategory('rtsp');
      }

      setFormData({
        camera_id: cameraToEdit.camera_id,
        camera_name: cameraToEdit.camera_name,
        description: cameraToEdit.description || '',
        bop_site: cameraToEdit.bop_site,
        sector: cameraToEdit.sector,
        location: cameraToEdit.location || '',
        latitude: cameraToEdit.latitude,
        longitude: cameraToEdit.longitude,
        rtsp_url: cameraToEdit.rtsp_url,
        username: cameraToEdit.username || '',
        password: '',
        stream_type: cameraToEdit.stream_type || 'main',
        enabled: cameraToEdit.enabled
      });
    } else {
      setSourceCategory('rtsp');
      setWebcamIndex('0');
      setDronePreset('dji_rtsp');
      setAndroidAppMode('ipwebcam_http');
      setAndroidIp('192.168.1.15');
      setAndroidPort('8080');

      const defaultBop = user?.scope_id && user?.scope_id !== '*' ? user.scope_id : 'BOP-ALPHA';

      setFormData({
        camera_id: '',
        camera_name: '',
        description: '',
        bop_site: defaultBop,
        sector: 'Sector-North',
        location: 'Perimeter Gate Tower 1',
        latitude: 31.6245,
        longitude: 74.8725,
        rtsp_url: '',
        username: '',
        password: '',
        stream_type: 'main',
        enabled: true
      });
    }
    setError(null);
  }, [cameraToEdit, isOpen, user]);

  // Handle source category change
  const handleSelectSourceCategory = (cat: SourceCategory) => {
    setSourceCategory(cat);
    if (cat === 'webcam') {
      setFormData((prev) => ({
        ...prev,
        stream_type: 'webcam',
        rtsp_url: `webcam://${webcamIndex}`,
        username: '',
        password: ''
      }));
    } else if (cat === 'drone') {
      let defaultDroneUrl = 'rtsp://192.168.1.200:8554/live';
      if (dronePreset === 'qgc_udp') defaultDroneUrl = 'udp://0.0.0.0:5600';
      else if (dronePreset === 'dji_rtmp') defaultDroneUrl = 'rtmp://192.168.1.100:1935/live/drone';
      setFormData((prev) => ({
        ...prev,
        stream_type: 'drone',
        rtsp_url: defaultDroneUrl
      }));
    } else if (cat === 'android') {
      let androidUrl = `http://${androidIp}:${androidPort}/video`;
      if (androidAppMode === 'ipwebcam_rtsp') androidUrl = `rtsp://${androidIp}:${androidPort}/h264_pcm.sdp`;
      else if (androidAppMode === 'droidcam') androidUrl = `http://${androidIp}:4747/video`;
      setFormData((prev) => ({
        ...prev,
        stream_type: 'android',
        rtsp_url: androidUrl
      }));
    } else if (cat === 'synthetic') {
      const simId = formData.camera_id ? formData.camera_id.toLowerCase() : 'sim-01';
      setFormData((prev) => ({
        ...prev,
        stream_type: 'main',
        rtsp_url: `synthetic://${simId}/main`,
        username: '',
        password: ''
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        stream_type: 'main',
        rtsp_url: prev.rtsp_url.startsWith('webcam://') || prev.rtsp_url.startsWith('udp://') || prev.rtsp_url.startsWith('synthetic://') ? '' : prev.rtsp_url
      }));
    }
  };

  const handleWebcamIndexChange = (idx: string) => {
    setWebcamIndex(idx);
    setFormData((prev) => ({
      ...prev,
      stream_type: 'webcam',
      rtsp_url: `webcam://${idx}`
    }));
  };

  const handleDronePresetChange = (preset: string) => {
    setDronePreset(preset);
    let url = 'rtsp://192.168.1.200:8554/live';
    if (preset === 'dji_rtmp') url = 'rtmp://192.168.1.100:1935/live/drone';
    else if (preset === 'qgc_udp') url = 'udp://0.0.0.0:5600';
    else if (preset === 'autel_rtsp') url = 'rtsp://192.168.1.200:554/live';
    else if (preset === 'custom') url = '';
    setFormData((prev) => ({
      ...prev,
      stream_type: 'drone',
      rtsp_url: url
    }));
  };

  const handleAndroidConfigChange = (rawIp: string, port: string, mode: string) => {
    let cleanIp = (rawIp || '').trim();
    let cleanPort = (port || '').trim();

    // If user pasted a full URL (e.g. http://192.168.1.15:8080 or https://xyz.ngrok-free.app/video)
    if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://') || cleanIp.startsWith('rtsp://')) {
      try {
        const u = new URL(cleanIp);
        cleanIp = u.hostname;
        if (u.port) cleanPort = u.port;
      } catch {
        cleanIp = cleanIp.replace(/^https?:\/\//, '').replace(/^rtsp:\/\//, '').split('/')[0];
      }
    }

    if (cleanIp.includes(':')) {
      const parts = cleanIp.split(':');
      cleanIp = parts[0];
      if (parts[1]) cleanPort = parts[1];
    }

    if (!cleanPort) {
      cleanPort = mode === 'droidcam' ? '4747' : '8080';
    }

    setAndroidIp(cleanIp);
    setAndroidPort(cleanPort);
    setAndroidAppMode(mode);

    let url = `http://${cleanIp}:${cleanPort}/video`;
    if (mode === 'ipwebcam_rtsp') {
      url = `rtsp://${cleanIp}:${cleanPort}/h264_pcm.sdp`;
    } else if (mode === 'droidcam') {
      url = `http://${cleanIp}:${cleanPort}/video`;
    }
    setFormData((prev) => ({
      ...prev,
      stream_type: 'android',
      rtsp_url: url
    }));
  };


  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const handleAutoDetectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS not supported on this browser/device');
      return;
    }
    setIsLocatingGPS(true);
    setGpsStatus('Acquiring real-time device GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGPS(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));
        setGpsStatus(`GPS Locked: ${lat}° N, ${lng}° E`);
        setTimeout(() => setGpsStatus(null), 4000);
      },
      (err) => {
        setIsLocatingGPS(false);
        setGpsStatus(`GPS error: ${err.message || 'Permission denied'}`);
        setTimeout(() => setGpsStatus(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleTestConnection = async () => {

    if (!formData.rtsp_url.trim()) {
      setError('Please provide a stream URL or device index to test.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setTestModalOpen(true);
    try {
      let res: CameraTestResponse;
      if (isEditing && !formData.password && !formData.rtsp_url.startsWith('webcam://')) {
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
        error_message: err.response?.data?.detail || err.message || 'Unable to contact test endpoint.'
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
      const chosenEdgeId = isEdgeManaged ? (selectedEdgeNodeId || (edgeNodes[0]?.node_id || 'EDGE-BOP-001')) : 'CENTRAL';
      const cleanBopSite = formData.bop_site?.trim() || 'BOP-ALPHA';
      const cleanSector = formData.sector?.trim() || 'Sector-North';
      const cleanCameraId = formData.camera_id?.trim().toUpperCase();

      if (!isEditing && !cleanCameraId) {
        setError('Please enter a valid Camera ID (e.g. CAM-NORTH-01).');
        setSaving(false);
        return;
      }
      if (!formData.rtsp_url?.trim()) {
        setError('Please enter a valid Stream URL (e.g. rtsp://, http://, or webcam://0).');
        setSaving(false);
        return;
      }

      if (isEditing) {
        const updatePayload: any = {
          camera_name: formData.camera_name.trim(),
          description: formData.description?.trim() || undefined,
          bop_site: cleanBopSite,
          sector: cleanSector,
          location: formData.location?.trim() || undefined,
          latitude: formData.latitude ?? 31.6245,
          longitude: formData.longitude ?? 74.8725,
          rtsp_url: formData.rtsp_url.trim(),
          username: formData.username?.trim() || undefined,
          stream_type: formData.stream_type || 'main',
          enabled: formData.enabled,
          edge_node_id: chosenEdgeId
        };
        if (formData.password?.trim()) {
          updatePayload.password = formData.password.trim();
        }
        await cameraService.updateCamera(cameraToEdit!.camera_id, updatePayload);
      } else {
        const createPayload: any = {
          camera_id: cleanCameraId,
          camera_name: formData.camera_name.trim(),
          description: formData.description?.trim() || undefined,
          bop_site: cleanBopSite,
          sector: cleanSector,
          location: formData.location?.trim() || undefined,
          latitude: formData.latitude ?? 31.6245,
          longitude: formData.longitude ?? 74.8725,
          rtsp_url: formData.rtsp_url.trim(),
          username: formData.username?.trim() || undefined,
          password: formData.password?.trim() || undefined,
          stream_type: formData.stream_type || 'main',
          enabled: formData.enabled,
          edge_node_id: chosenEdgeId
        };
        await cameraService.createCamera(createPayload);
      }
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
        title={isEditing ? `Edit Camera [${cameraToEdit?.camera_id}]` : 'Register New Surveillance Feed'}
        subtitle="Connect IP Cameras, PC Webcams, Drone UAV Feeds, or Android Phone Testing Cameras"
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

            {/* Deployment Architecture & Defense Network Topology */}
            <div className="p-3.5 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-sky-400" />
                  <span className="text-white font-bold text-xs font-mono">Defense Network Architecture</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  REAL-WORLD TOPOLOGY READY
                </span>
              </div>

              {/* Topology Selection Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEdgeManaged(false);
                    if (!formData.rtsp_url || formData.rtsp_url.startsWith('synthetic') || formData.rtsp_url.startsWith('webcam')) {
                      setFormData(prev => ({ ...prev, rtsp_url: 'rtsp://admin:border2026@10.25.1.50:554/stream1', stream_type: 'main' }));
                    }
                  }}
                  className={`p-2 rounded-lg text-left transition border ${
                    !isEdgeManaged && formData.rtsp_url?.includes('10.')
                      ? 'bg-purple-950/50 border-purple-500/60 text-purple-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold font-mono text-purple-300">🛡️ Defence VPN</div>
                  <div className="text-[9px] text-slate-400">10.x.x.x Tunnel</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEdgeManaged(false);
                    if (!formData.rtsp_url || formData.rtsp_url.startsWith('synthetic') || formData.rtsp_url.startsWith('webcam')) {
                      setFormData(prev => ({ ...prev, rtsp_url: 'rtsp://admin:border2026@192.168.1.108:554/ch1/main', stream_type: 'main' }));
                    }
                  }}
                  className={`p-2 rounded-lg text-left transition border ${
                    !isEdgeManaged && formData.rtsp_url?.includes('192.168.')
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold font-mono text-emerald-300">🏢 Outpost LAN</div>
                  <div className="text-[9px] text-slate-400">192.168.x.x PoE</div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEdgeManaged(true)}
                  className={`p-2 rounded-lg text-left transition border ${
                    isEdgeManaged
                      ? 'bg-sky-950/50 border-sky-500/60 text-sky-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold font-mono text-sky-300">⚡ Edge Managed</div>
                  <div className="text-[9px] text-slate-400">Local AI Appliance</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEdgeManaged(false);
                    setSourceCategory('synthetic');
                    setFormData(prev => ({ ...prev, rtsp_url: 'synthetic://cam-north-01/main', stream_type: 'main' }));
                  }}
                  className={`p-2 rounded-lg text-left transition border ${
                    !isEdgeManaged && (formData.rtsp_url?.startsWith('synthetic') || formData.rtsp_url?.startsWith('webcam'))
                      ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold font-mono text-amber-300">🧪 Simulator/PC</div>
                  <div className="text-[9px] text-slate-400">Synthetic / Webcam</div>
                </button>
              </div>

              {isEdgeManaged ? (
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-sky-400" />
                    Managing Edge Appliance Node *
                  </label>
                  {edgeNodes.length === 0 ? (
                    <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 text-[11px]">
                      No Edge Nodes registered yet. Go to <strong className="text-white">Edge Infrastructure</strong> to provision an Edge Node first.
                    </div>
                  ) : (
                    <select
                      value={selectedEdgeNodeId}
                      onChange={(e) => setSelectedEdgeNodeId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d131f] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-sky-500"
                    >
                      {edgeNodes.map((n) => (
                        <option key={n.node_id} value={n.node_id}>
                          {n.node_id} — {n.name} ({n.bop_site}) [{n.status}]
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Secure Outpost: Camera RTSP is ingested locally on Outpost LAN. Central direct RTSP bypassed.</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {formData.rtsp_url?.includes('10.')
                      ? 'Encrypted Optical Fiber/Satellite VPN Tunnel: Central HQ connects securely to border camera subnet 10.x.x.x.'
                      : 'Central IBVAP connects directly to this camera over local/WAN network address.'}
                  </span>
                </div>
              )}
            </div>

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
                  placeholder="e.g. CAM-NORTH-01, DRONE-UAV-01, WEBCAM-01"
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
                  placeholder="e.g. Sector 4 Gate Camera, DJI Matrice 300 UAV, Laptop HD Webcam"
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
                  placeholder="e.g. BOP Alpha, Base Station"
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
                  placeholder="e.g. North Sector, Aerial Patrol"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Specific Location / Deployment
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Perimeter Gate, Airspace Grid-B"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Section 1.5: Geospatial GPS Positioning for Tactical GIS Map */}
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-semibold">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Geospatial Coordinates & Tactical GIS Placement</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoDetectLocation}
                  disabled={isLocatingGPS}
                  className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Locate className={`w-3.5 h-3.5 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                  <span>{isLocatingGPS ? 'Detecting...' : 'Live GPS Locate'}</span>
                </button>
              </div>

              {gpsStatus && (
                <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 rounded px-2.5 py-1 flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 animate-spin" />
                  <span>{gpsStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Latitude (North / South) <span className="text-emerald-400 font-mono">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 31.6048"
                    value={formData.latitude ?? ''}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Longitude (East / West) <span className="text-emerald-400 font-mono">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g. 74.5727"
                    value={formData.longitude ?? ''}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full bg-[#0d131f] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                These GPS coordinates position the camera's optical viewing cone on the GIS Tactical Map and calculate blind spots.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stream Classification</label>
                <select
                  value={formData.stream_type}
                  onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="main">Main Stream (Optical HD)</option>
                  <option value="sub">Sub Stream (Bandwidth Saving)</option>
                  <option value="webcam">Local Webcam (USB / Integrated)</option>
                  <option value="drone">Drone / UAV Aerial Stream</option>
                  <option value="android">Android Phone Camera (Mobile IP)</option>
                  <option value="thermal">Thermal Sensor Feed</option>
                  <option value="ptz">PTZ Surveillance Dome</option>
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
                    <span>Stream Enabled & Ingestion Active</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Multi-Source Video Feed Ingestion */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4" /> 2. VIDEO STREAM SOURCE & CONNECTION
              </h4>
              <button
                type="button"
                onClick={handleTestConnection}
                className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded border border-sky-500/40 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                TEST CONNECTION
              </button>
            </div>

            {/* Source Category Selector Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Select Camera Source Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('rtsp')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    sourceCategory === 'rtsp'
                      ? 'bg-sky-950/50 border-sky-500 text-white shadow-md shadow-sky-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Cctv className={`w-4 h-4 ${sourceCategory === 'rtsp' ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">IP Camera</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">Standard RTSP / ONVIF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('webcam')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    sourceCategory === 'webcam'
                      ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Laptop className={`w-4 h-4 ${sourceCategory === 'webcam' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">PC Webcam</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">USB / Integrated</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('android')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    sourceCategory === 'android'
                      ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md shadow-emerald-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${sourceCategory === 'android' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">Phone Camera</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">IP Webcam / DroidCam</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('drone')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    sourceCategory === 'drone'
                      ? 'bg-purple-950/50 border-purple-500 text-white shadow-md shadow-purple-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plane className={`w-4 h-4 ${sourceCategory === 'drone' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">Drone / UAV</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">DJI, UDP, RTMP</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('synthetic')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                    sourceCategory === 'synthetic'
                      ? 'bg-amber-950/50 border-amber-500 text-white shadow-md shadow-amber-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${sourceCategory === 'synthetic' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">Simulated AI</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">Tactical Test Stream</span>
                </button>
              </div>
            </div>

            {/* CASE 0: SIMULATED TEST STREAM */}
            {sourceCategory === 'synthetic' && (
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Simulated Tactical Border CCTV Generator</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Stream Identifier</label>
                    <input
                      type="text"
                      value={formData.rtsp_url}
                      onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                      placeholder="synthetic://cam-01/main"
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Features Enabled</label>
                    <div className="text-[11px] font-mono text-slate-300 bg-[#0a0e17] border border-slate-800 rounded-lg p-2 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>HUD Overlay • Moving Target • 1080p 25 FPS</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Perfect for testing AI models, zone alerts, and video wall without needing physical CCTV hardware.</span>
                </p>
              </div>
            )}

            {/* CASE 1: PC WEBCAM CONFIG */}
            {sourceCategory === 'webcam' && (
              <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-semibold">
                  <Laptop className="w-4 h-4 text-cyan-400" />
                  <span>Local DirectShow / USB Webcam Setup</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Select Webcam Device</label>
                    <select
                      value={webcamIndex}
                      onChange={(e) => handleWebcamIndexChange(e.target.value)}
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="0">Camera 0 (Default Integrated Webcam)</option>
                      <option value="1">Camera 1 (External USB Webcam #1)</option>
                      <option value="2">Camera 2 (Secondary USB Webcam #2)</option>
                      <option value="3">Camera 3 (External Video Capture Device)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Internal Device URI</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.rtsp_url}
                      className="w-full bg-[#0a0e17] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Direct hardware access via Windows DirectShow (low latency, zero authentication needed).</span>
                </p>
              </div>
            )}

            {/* CASE 2: DRONE UAV CONFIG */}
            {sourceCategory === 'drone' && (
              <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-mono font-semibold">
                  <Plane className="w-4 h-4 text-purple-400" />
                  <span>Aerial Drone / UAV Live Feed Configuration</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Drone System Preset</label>
                    <select
                      value={dronePreset}
                      onChange={(e) => handleDronePresetChange(e.target.value)}
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    >
                      <option value="dji_rtsp">DJI Enterprise / Pilot 2 (RTSP H.264)</option>
                      <option value="dji_rtmp">DJI RTMP Live Broadcast</option>
                      <option value="qgc_udp">QGroundControl / MAVLink (UDP 5600)</option>
                      <option value="autel_rtsp">Autel EVO Max / Skydio (RTSP)</option>
                      <option value="custom">Custom Drone Stream URL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Drone Video Stream URL <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.rtsp_url}
                      onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                      placeholder="rtsp://<drone-ip>:8554/live or udp://0.0.0.0:5600"
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Supports RTSP, RTMP broadcast relays, and QGroundControl / MAVLink UDP raw streams.</span>
                </p>
              </div>
            )}

            {/* CASE 3: ANDROID PHONE CONFIG */}
            {sourceCategory === 'android' && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-semibold">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Android Smartphone Live IP Camera (Testing Tool)</span>
                </div>

                {/* Quick Step Guide */}
                <div className="bg-[#0b1320] p-3 rounded-lg border border-emerald-900/40 text-[11px] text-slate-300 space-y-1.5">
                  <div className="font-bold text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3-Step Phone Setup (Same Wi-Fi / Hotspot):
                  </div>
                  <div>1. Play Store se free <strong>"IP Webcam"</strong> (by Pavel Khlebovich) app install karein.</div>
                  <div>2. Laptop aur Phone ko <strong>same Wi-Fi ya Phone ke Mobile Hotspot</strong> se connect karein.</div>
                  <div>3. App me sabse niche jakar <strong>"Start Server"</strong> tap karein — screen par IP aayega (jaise <code>http://192.168.1.15:8080</code>). Use yahan dalein.</div>
                  <div className="pt-1.5 border-t border-emerald-900/40 text-[10px] text-amber-300/90 flex items-start gap-1">
                    <span className="font-bold font-mono text-amber-400">🌐 DOOR KA CAMERA (Remote/Internet):</span>
                    <span>Agar camera kisi doosre shahar/network par hai, to <strong>Ngrok Tunnel</strong> (e.g. <code>https://mycam.ngrok-free.app/video</code>) ya Cloudflare URL direct yahan dalein.</span>
                  </div>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Android App Mode</label>
                    <select
                      value={androidAppMode}
                      onChange={(e) => handleAndroidConfigChange(androidIp, androidPort, e.target.value)}
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="ipwebcam_http">IP Webcam HTTP (MJPEG - Recommended)</option>
                      <option value="ipwebcam_rtsp">IP Webcam RTSP (H.264)</option>
                      <option value="droidcam">DroidCam App (Port 4747)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Wi-Fi IP Address</label>
                    <input
                      type="text"
                      value={androidIp}
                      onChange={(e) => handleAndroidConfigChange(e.target.value, androidPort, androidAppMode)}
                      placeholder="e.g. 192.168.1.15"
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Port</label>
                    <input
                      type="text"
                      value={androidPort}
                      onChange={(e) => handleAndroidConfigChange(androidIp, e.target.value, androidAppMode)}
                      placeholder="8080"
                      className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Generated Stream Connection URL</label>
                  <input
                    type="text"
                    required
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* CASE 4: STANDARD RTSP IP CAMERA CONFIG */}
            {sourceCategory === 'rtsp' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    RTSP Stream URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                    placeholder="rtsp://192.168.1.100:554/stream1"
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter full RTSP URL. Passwords are automatically encrypted at rest using AES-256 Fernet.
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              {saving ? 'SAVING...' : isEditing ? 'UPDATE FEED' : 'REGISTER FEED'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Diagnostic Modal */}
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
