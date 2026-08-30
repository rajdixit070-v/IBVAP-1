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
  Lock
} from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cameraToEdit?: Camera | null;
}

type SourceCategory = 'rtsp' | 'webcam' | 'drone' | 'android';

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cameraToEdit
}) => {
  const isEditing = !!cameraToEdit;

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
    bop_site: '',
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

      setFormData({
        camera_id: '',
        camera_name: '',
        description: '',
        bop_site: '',
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
    }
    setError(null);
  }, [cameraToEdit, isOpen]);

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
    } else {
      setFormData((prev) => ({
        ...prev,
        stream_type: 'main',
        rtsp_url: prev.rtsp_url.startsWith('webcam://') || prev.rtsp_url.startsWith('udp://') ? '' : prev.rtsp_url
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

  const handleAndroidConfigChange = (ip: string, port: string, mode: string) => {
    setAndroidIp(ip);
    setAndroidPort(port);
    setAndroidAppMode(mode);
    let url = `http://${ip}:${port}/video`;
    if (mode === 'ipwebcam_rtsp') {
      url = `rtsp://${ip}:${port}/h264_pcm.sdp`;
    } else if (mode === 'droidcam') {
      url = `http://${ip}:${port || '4747'}/video`;
    }
    setFormData((prev) => ({
      ...prev,
      stream_type: 'android',
      rtsp_url: url
    }));
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
      if (isEditing) {
        const updatePayload: any = {
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
          enabled: formData.enabled,
          edge_node_id: chosenEdgeId
        };
        if (formData.password?.trim()) {
          updatePayload.password = formData.password;
        }
        await cameraService.updateCamera(cameraToEdit!.camera_id, updatePayload);
      } else {
        const createPayload: any = {
          ...formData,
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

            {/* Deployment Architecture Toggle */}
            <div className="p-3.5 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-sky-400" />
                  <span className="text-white font-bold text-xs font-mono">Deployment Architecture</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEdgeManaged(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                      !isEdgeManaged
                        ? 'bg-sky-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Direct HQ Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEdgeManaged(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                      isEdgeManaged
                        ? 'bg-sky-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Remote Edge Managed
                  </button>
                </div>
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
                <div className="text-[11px] font-mono text-slate-400">
                  Central IBVAP connects directly to this camera over the headquarters local network.
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('rtsp')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    sourceCategory === 'rtsp'
                      ? 'bg-sky-950/50 border-sky-500 text-white shadow-md shadow-sky-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Cctv className={`w-4 h-4 ${sourceCategory === 'rtsp' ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">IP Camera</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">Standard RTSP / ONVIF IP Cameras</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('webcam')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    sourceCategory === 'webcam'
                      ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Laptop className={`w-4 h-4 ${sourceCategory === 'webcam' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">PC Webcam</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">Laptop Integrated or USB Webcams</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('drone')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    sourceCategory === 'drone'
                      ? 'bg-purple-950/50 border-purple-500 text-white shadow-md shadow-purple-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plane className={`w-4 h-4 ${sourceCategory === 'drone' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">Drone / UAV</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">DJI, Autel, Skydio, UDP Streams</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSourceCategory('android')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    sourceCategory === 'android'
                      ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md shadow-emerald-950'
                      : 'bg-[#111a2e] border-[#22324d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${sourceCategory === 'android' ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold font-mono">Android Phone</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">IP Webcam & DroidCam Testing</span>
                </button>
              </div>
            </div>

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
                <div className="bg-[#0b1320] p-3 rounded-lg border border-emerald-900/40 text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3-Step Phone Setup:
                  </div>
                  <div>1. Play Store se free <strong>"IP Webcam"</strong> (by Pavel Khlebovich) ya <strong>"DroidCam"</strong> app install karein.</div>
                  <div>2. Phone aur laptop dono ko <strong>same Wi-Fi network</strong> se connect karein.</div>
                  <div>3. App me <strong>"Start Server"</strong> tap karein — screen par local IP dikhega (e.g. <code>192.168.1.15:8080</code>).</div>
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
