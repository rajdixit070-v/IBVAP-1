import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Camera, CameraCreateInput, CameraTestResponse } from '../../types/camera';
import { cameraService } from '../../services/cameraService';
import { RTSPTestModal } from './RTSPTestModal';
import { COMPREHENSIVE_CHECKPOSTS } from '../../constants/checkposts';
import {
  Activity,
  Cctv,
  Save,
  Smartphone,
  MapPin,
  Compass,
  Locate,
  Laptop,
  AlertCircle,
  Video,
  Eye,
  EyeOff,
  Plane,
  Flame,
  Sliders,
  Server,
  ChevronDown,
  ChevronUp,
  Wifi
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cameraToEdit?: Camera | null;
}

export type BorderEquipmentType = 'rtsp' | 'nvr' | 'ptz' | 'thermal' | 'drone' | 'phone' | 'webcam';

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cameraToEdit
}) => {
  const isEditing = !!cameraToEdit;
  const { user } = useAuth();

  const commanderScope = (user?.scope_id && user?.scope_id !== '*') ? user.scope_id : 'BOP-WAGAH';

  const matchedCommanderPost = useMemo(() => {
    return COMPREHENSIVE_CHECKPOSTS.find(cp => cp.id === commanderScope || cp.code === commanderScope) ||
           COMPREHENSIVE_CHECKPOSTS.find(cp => cp.name.toLowerCase().includes('wagah')) ||
           COMPREHENSIVE_CHECKPOSTS[0];
  }, [commanderScope]);

  const commanderPostName = user?.post_name || matchedCommanderPost.name;
  const commanderSector = user?.sector || matchedCommanderPost.sector || 'Punjab Frontier';
  const commanderLat = matchedCommanderPost.latitude ?? 31.6048;
  const commanderLng = matchedCommanderPost.longitude ?? 74.5731;

  // Selected Border Equipment Type
  const [equipmentType, setEquipmentType] = useState<BorderEquipmentType>('rtsp');

  // NVR / DVR Multi-Channel inputs
  const [nvrDeviceType, setNvrDeviceType] = useState<'nvr' | 'dvr'>('nvr');
  const [nvrBrand, setNvrBrand] = useState<'hikvision' | 'dahua_cpplus' | 'generic' | 'custom'>('hikvision');
  const [nvrIp, setNvrIp] = useState<string>('192.168.1.100');
  const [nvrPort, setNvrPort] = useState<string>('554');
  const [nvrChannel, setNvrChannel] = useState<number>(1);

  // Phone Camera inputs & Mode
  const [phoneMode, setPhoneMode] = useState<'browser' | 'ipwebcam'>('browser');
  const [phoneIp, setPhoneIp] = useState<string>('192.168.1.15');
  const [phonePort, setPhonePort] = useState<string>('8080');

  // PC Webcam input & Mode
  const [webcamMode, setWebcamMode] = useState<'browser' | 'device'>('browser');
  const [webcamIndex, setWebcamIndex] = useState<string>('0');

  // Drone Preset
  const [droneProtocol, setDroneProtocol] = useState<string>('dji_rtsp');

  // Show Sub-Stream field toggle
  const [showSubStreamField, setShowSubStreamField] = useState(false);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<CameraCreateInput>({
    camera_id: '',
    camera_name: '',
    description: '',
    bop_site: commanderPostName,
    sector: commanderSector,
    location: '',
    latitude: commanderLat,
    longitude: commanderLng,
    rtsp_url: '',
    sub_stream_url: '',
    username: '',
    password: '',
    stream_type: 'main',
    enabled: true
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connection Testing state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CameraTestResponse | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // GPS Auto-detect state
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Helper to construct NVR/DVR stream URLs
  const computeNvrUrls = (
    brand: 'hikvision' | 'dahua_cpplus' | 'generic' | 'custom',
    ip: string,
    port: string,
    channel: number
  ) => {
    const cleanIp = ip.trim() || '192.168.1.100';
    const cleanPort = port.trim() || '554';
    const ch = Math.max(1, channel || 1);

    let mainUrl = '';
    let subUrl = '';

    if (brand === 'hikvision') {
      // Hikvision / Uniview: Channel 1 -> 101, Channel 2 -> 201, Channel 10 -> 1001
      mainUrl = `rtsp://${cleanIp}:${cleanPort}/Streaming/Channels/${ch}01`;
      subUrl = `rtsp://${cleanIp}:${cleanPort}/Streaming/Channels/${ch}02`;
    } else if (brand === 'dahua_cpplus') {
      // Dahua / CP Plus / Imou
      mainUrl = `rtsp://${cleanIp}:${cleanPort}/cam/realmonitor?channel=${ch}&subtype=0`;
      subUrl = `rtsp://${cleanIp}:${cleanPort}/cam/realmonitor?channel=${ch}&subtype=1`;
    } else if (brand === 'generic') {
      // Generic ONVIF / RTSP NVR
      mainUrl = `rtsp://${cleanIp}:${cleanPort}/ch${ch}/main/av_stream`;
      subUrl = `rtsp://${cleanIp}:${cleanPort}/ch${ch}/sub/av_stream`;
    } else {
      mainUrl = `rtsp://${cleanIp}:${cleanPort}/live/ch${ch}`;
      subUrl = `rtsp://${cleanIp}:${cleanPort}/sub/ch${ch}`;
    }

    return { mainUrl, subUrl };
  };

  // Initialize form
  useEffect(() => {
    if (cameraToEdit) {
      const url = cameraToEdit.rtsp_url || '';
      const st = cameraToEdit.stream_type || 'main';

      if (url.startsWith('edge://')) {
        if (st === 'android' || st === 'phone' || cameraToEdit.camera_name.toLowerCase().includes('phone')) {
          setEquipmentType('phone');
          setPhoneMode('browser');
        } else {
          setEquipmentType('webcam');
          setWebcamMode('browser');
        }
      } else if (url.startsWith('webcam://') || st === 'webcam') {
        setEquipmentType('webcam');
        setWebcamMode('device');
        setWebcamIndex(url.replace('webcam://', '').replace('device://', '').trim() || '0');
      } else if (st === 'nvr' || st === 'dvr' || url.includes('/Streaming/Channels/') || url.includes('channel=') || url.includes('/cam/realmonitor')) {
        setEquipmentType('nvr');
        setNvrDeviceType(st === 'dvr' ? 'dvr' : 'nvr');
        if (url.includes('/Streaming/Channels/')) {
          setNvrBrand('hikvision');
          const match = url.match(/\/Streaming\/Channels\/(\d+)01/);
          if (match) setNvrChannel(parseInt(match[1]));
        } else if (url.includes('channel=')) {
          setNvrBrand('dahua_cpplus');
          const match = url.match(/channel=(\d+)/);
          if (match) setNvrChannel(parseInt(match[1]));
        }
      } else if (st === 'drone' || url.startsWith('udp://') || url.startsWith('rtmp://')) {
        setEquipmentType('drone');
      } else if (st === 'thermal' || url.includes('thermal') || url.includes('/201')) {
        setEquipmentType('thermal');
      } else if (st === 'ptz') {
        setEquipmentType('ptz');
      } else if (url.includes(':8080') || url.includes('/video') || st === 'android') {
        setEquipmentType('phone');
        setPhoneMode('ipwebcam');
      } else {
        setEquipmentType('rtsp');
      }

      if (cameraToEdit.sub_stream_url) {
        setShowSubStreamField(true);
      }

      setFormData({
        camera_id: cameraToEdit.camera_id,
        camera_name: cameraToEdit.camera_name,
        description: cameraToEdit.description || '',
        bop_site: cameraToEdit.bop_site || commanderPostName,
        sector: cameraToEdit.sector || commanderSector,
        location: cameraToEdit.location || '',
        latitude: cameraToEdit.latitude ?? commanderLat,
        longitude: cameraToEdit.longitude ?? commanderLng,
        rtsp_url: cameraToEdit.rtsp_url,
        sub_stream_url: cameraToEdit.sub_stream_url || '',
        username: cameraToEdit.username || '',
        password: '',
        stream_type: cameraToEdit.stream_type || 'main',
        enabled: cameraToEdit.enabled
      });
    } else {
      const randomSuffix = Math.floor(10 + Math.random() * 89);
      const postPrefix = (matchedCommanderPost?.code)
        ? matchedCommanderPost.code.replace('BOP-', '')
        : 'WAGAH';
      const initialCamId = `CAM-${postPrefix}-${randomSuffix}`;

      setEquipmentType('rtsp');
      setShowSubStreamField(false);
      setFormData({
        camera_id: initialCamId,
        camera_name: 'Perimeter Sentry Camera',
        description: 'Border surveillance camera feed.',
        bop_site: commanderPostName,
        sector: commanderSector,
        location: 'Tower 1',
        latitude: commanderLat,
        longitude: commanderLng,
        rtsp_url: 'rtsp://192.168.1.100:554/live',
        sub_stream_url: '',
        username: 'admin',
        password: '',
        stream_type: 'main',
        enabled: true
      });
    }
    setError(null);
  }, [
    cameraToEdit,
    isOpen,
    commanderPostName,
    commanderSector,
    commanderLat,
    commanderLng,
    matchedCommanderPost
  ]);

  // Handle Equipment Type Change
  const handleTypeChange = (type: BorderEquipmentType) => {
    setEquipmentType(type);

    if (type === 'rtsp') {
      setFormData(prev => ({
        ...prev,
        stream_type: 'main',
        camera_name: prev.camera_name || 'Perimeter Sentry Camera',
        rtsp_url: prev.rtsp_url && !prev.rtsp_url.startsWith('webcam://') && !prev.rtsp_url.startsWith('edge://') && !prev.rtsp_url.startsWith('udp://') && !prev.rtsp_url.includes(':8080')
          ? prev.rtsp_url
          : 'rtsp://192.168.1.100:554/live'
      }));
    } else if (type === 'nvr') {
      const { mainUrl, subUrl } = computeNvrUrls(nvrBrand, nvrIp, nvrPort, nvrChannel);
      setFormData(prev => ({
        ...prev,
        stream_type: nvrDeviceType,
        rtsp_url: mainUrl,
        sub_stream_url: subUrl,
        camera_name: prev.camera_name.includes('Channel') || prev.camera_name === 'Perimeter Sentry Camera'
          ? `${nvrDeviceType.toUpperCase()} Channel ${nvrChannel}`
          : prev.camera_name
      }));
    } else if (type === 'ptz') {
      setFormData(prev => ({
        ...prev,
        stream_type: 'ptz',
        camera_name: prev.camera_name === 'Perimeter Sentry Camera' ? 'PTZ Speed Dome Turret' : prev.camera_name,
        rtsp_url: prev.rtsp_url && !prev.rtsp_url.startsWith('webcam://') && !prev.rtsp_url.startsWith('edge://') && !prev.rtsp_url.startsWith('udp://') && !prev.rtsp_url.includes(':8080')
          ? prev.rtsp_url
          : 'rtsp://192.168.1.100:554/Streaming/Channels/101'
      }));
    } else if (type === 'thermal') {
      setFormData(prev => ({
        ...prev,
        stream_type: 'thermal',
        camera_name: prev.camera_name === 'Perimeter Sentry Camera' ? 'FLIR Thermal Night-Vision' : prev.camera_name,
        rtsp_url: prev.rtsp_url && !prev.rtsp_url.startsWith('webcam://') && !prev.rtsp_url.startsWith('edge://') && !prev.rtsp_url.startsWith('udp://') && !prev.rtsp_url.includes(':8080')
          ? prev.rtsp_url
          : 'rtsp://192.168.1.120:554/Streaming/Channels/201'
      }));
    } else if (type === 'drone') {
      let defaultDroneUrl = 'rtsp://192.168.1.200:8554/live';
      if (droneProtocol === 'dji_rtsp') defaultDroneUrl = 'rtsp://192.168.1.200:8554/live';
      else if (droneProtocol === 'qgc_udp') defaultDroneUrl = 'udp://0.0.0.0:5600';
      else if (droneProtocol === 'dji_rtmp') defaultDroneUrl = 'rtmp://192.168.1.100:1935/live/drone';
      setFormData(prev => ({
        ...prev,
        stream_type: 'drone',
        camera_name: prev.camera_name === 'Perimeter Sentry Camera' ? 'Border Patrol UAV Recon' : prev.camera_name,
        rtsp_url: defaultDroneUrl
      }));
    } else if (type === 'phone') {
      const url = phoneMode === 'browser'
        ? `edge://${(formData.camera_id || 'CAM-PHONE').toLowerCase()}`
        : `http://${phoneIp.trim() || '192.168.1.15'}:${phonePort.trim() || '8080'}/video`;
      setFormData(prev => ({
        ...prev,
        stream_type: 'android',
        camera_name: prev.camera_name === 'Perimeter Sentry Camera' ? 'Mobile Patrol Phone Feed' : prev.camera_name,
        rtsp_url: url
      }));
    } else if (type === 'webcam') {
      const url = webcamMode === 'browser'
        ? `edge://${(formData.camera_id || 'CAM-WEBCAM').toLowerCase()}`
        : `webcam://${webcamIndex}`;
      setFormData(prev => ({
        ...prev,
        stream_type: 'webcam',
        camera_name: prev.camera_name === 'Perimeter Sentry Camera' ? 'HQ Operations Desk Webcam' : prev.camera_name,
        rtsp_url: url
      }));
    }
  };

  // Handle NVR / DVR updates
  const updateNvrState = (
    devType: 'nvr' | 'dvr',
    brand: 'hikvision' | 'dahua_cpplus' | 'generic' | 'custom',
    ip: string,
    port: string,
    channel: number
  ) => {
    setNvrDeviceType(devType);
    setNvrBrand(brand);
    setNvrIp(ip);
    setNvrPort(port);
    setNvrChannel(channel);

    const { mainUrl, subUrl } = computeNvrUrls(brand, ip, port, channel);
    setFormData(prev => ({
      ...prev,
      stream_type: devType,
      rtsp_url: mainUrl,
      sub_stream_url: subUrl,
      camera_name: prev.camera_name.includes('Channel') || prev.camera_name === 'Perimeter Sentry Camera'
        ? `${devType.toUpperCase()} Channel ${channel}`
        : prev.camera_name
    }));
  };

  // Handle Drone Protocol Change
  const handleDroneProtocolChange = (protocol: string) => {
    setDroneProtocol(protocol);
    let url = 'rtsp://192.168.1.200:8554/live';
    if (protocol === 'dji_rtsp') url = 'rtsp://192.168.1.200:8554/live';
    else if (protocol === 'qgc_udp') url = 'udp://0.0.0.0:5600';
    else if (protocol === 'dji_rtmp') url = 'rtmp://192.168.1.100:1935/live/drone';
    else if (protocol === 'custom') url = '';
    setFormData(prev => ({
      ...prev,
      stream_type: 'drone',
      rtsp_url: url
    }));
  };

  // Handle Phone IP/Port Change
  const handlePhoneChange = (ip: string, port: string) => {
    setPhoneIp(ip);
    setPhonePort(port);
    const cleanIp = ip.trim() || '192.168.1.15';
    const cleanPort = port.trim() || '8080';
    setFormData(prev => ({
      ...prev,
      rtsp_url: `http://${cleanIp}:${cleanPort}/video`,
      stream_type: 'android'
    }));
  };

  // Handle Webcam Index Change
  const handleWebcamChange = (idx: string) => {
    setWebcamIndex(idx);
    setFormData(prev => ({
      ...prev,
      rtsp_url: `webcam://${idx}`,
      stream_type: 'webcam'
    }));
  };

  // GPS Auto-detect
  const handleAutoDetectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS not supported on this device');
      return;
    }
    setIsLocatingGPS(true);
    setGpsStatus('Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGPS(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
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

  // Test Connection Probe
  const handleTestConnection = async () => {
    if (!formData.rtsp_url?.trim()) {
      setError('Please enter a Stream URL to test.');
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
        error_message: err.response?.data?.detail || err.message || 'Camera is offline or unreachable.'
      });
    } finally {
      setTesting(false);
    }
  };

  // Form Submit
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
        setError('Please enter a valid Stream URL.');
        setSaving(false);
        return;
      }

      const finalBopSite = formData.bop_site?.trim() || commanderPostName;
      const finalSector = formData.sector?.trim() || commanderSector;

      const finalCameraName = (formData.camera_name || '').trim() || (isEditing ? (cameraToEdit?.camera_name || 'Perimeter Camera') : (cleanCameraId || 'Perimeter Camera'));

      if (isEditing) {
        const updatePayload: any = {
          camera_name: finalCameraName,
          description: formData.description?.trim() || undefined,
          bop_site: finalBopSite,
          sector: finalSector,
          location: formData.location?.trim() || undefined,
          latitude: formData.latitude ?? commanderLat,
          longitude: formData.longitude ?? commanderLng,
          rtsp_url: formData.rtsp_url.trim(),
          sub_stream_url: formData.sub_stream_url?.trim() || undefined,
          username: formData.username?.trim() || undefined,
          stream_type: formData.stream_type || 'main',
          enabled: formData.enabled
        };
        if (formData.password?.trim()) {
          updatePayload.password = formData.password.trim();
        }
        await cameraService.updateCamera(cameraToEdit!.camera_id, updatePayload);
      } else {
        const createPayload: any = {
          camera_id: cleanCameraId,
          camera_name: finalCameraName,
          description: formData.description?.trim() || undefined,
          bop_site: finalBopSite,
          sector: finalSector,
          location: formData.location?.trim() || undefined,
          latitude: formData.latitude ?? commanderLat,
          longitude: formData.longitude ?? commanderLng,
          rtsp_url: formData.rtsp_url.trim(),
          sub_stream_url: formData.sub_stream_url?.trim() || undefined,
          username: formData.username?.trim() || undefined,
          password: formData.password?.trim() || undefined,
          stream_type: formData.stream_type || 'main',
          enabled: formData.enabled
        };
        await cameraService.createCamera(createPayload);
      }

      window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
      window.dispatchEvent(new CustomEvent('ibvap:refresh-cameras'));

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to register camera.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? `Edit Camera [${cameraToEdit?.camera_id}]` : 'Register Border Surveillance Equipment'}
        subtitle={`Duty Outpost: ${formData.bop_site || commanderPostName} (${formData.sector || commanderSector})`}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-500 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: CAMERA IDENTIFICATION & OUTPOST */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Cctv className="w-4 h-4" /> 1. OUTPOST & CAMERA IDENTIFICATION
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Camera ID */}
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
                  placeholder="e.g. CAM-WAGAH-01, DRONE-01, PTZ-01"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-sky-300 font-bold placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-60"
                />
              </div>

              {/* Camera Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Camera Name / Designation <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.camera_name}
                  onChange={(e) => setFormData({ ...formData, camera_name: e.target.value })}
                  placeholder="e.g. Main Gate Sentry Cam, PTZ Speed Dome Tower 1"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Border Outpost (User types their own BOP directly) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Border Outpost (BOP Site) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.bop_site}
                  onChange={(e) => setFormData(prev => ({ ...prev, bop_site: e.target.value }))}
                  placeholder="e.g. BOP Wagah, BOP Amar, Outpost 1"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              {/* Sector (User can type or edit their frontier sector) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Frontier Sector <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.sector}
                  onChange={(e) => setFormData(prev => ({ ...prev, sector: e.target.value }))}
                  placeholder="e.g. Punjab Frontier, Rajasthan Sector"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              {/* Tower / Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mounting Location / Tower
                </label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Watchtower 1, Gate Barrier Lane"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: BORDER EQUIPMENT TYPE & STREAM URL */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Video className="w-4 h-4" /> 2. BORDER SURVEILLANCE EQUIPMENT TYPE
            </h4>

            {/* 7 Real-World Border Equipment Categories */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {/* 1. Standalone IP Camera */}
              <button
                type="button"
                onClick={() => handleTypeChange('rtsp')}
                className={`py-2 px-2 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'rtsp'
                    ? 'bg-sky-600 text-white border-sky-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-[11px] truncate">Standalone IP</span>
              </button>

              {/* 2. NVR / DVR Recorder Box */}
              <button
                type="button"
                onClick={() => handleTypeChange('nvr')}
                className={`py-2 px-2 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'nvr'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Server className="w-4 h-4" />
                <span className="text-[11px] truncate">NVR / DVR Box</span>
              </button>

              {/* 2. PTZ Turret */}
              <button
                type="button"
                onClick={() => handleTypeChange('ptz')}
                className={`py-2 px-2.5 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'ptz'
                    ? 'bg-blue-600 text-white border-blue-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span className="text-[11px] truncate">PTZ Speed Dome</span>
              </button>

              {/* 3. Thermal FLIR */}
              <button
                type="button"
                onClick={() => handleTypeChange('thermal')}
                className={`py-2 px-2.5 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'thermal'
                    ? 'bg-amber-600 text-white border-amber-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span className="text-[11px] truncate">Thermal / Night</span>
              </button>

              {/* 4. Drone UAV */}
              <button
                type="button"
                onClick={() => handleTypeChange('drone')}
                className={`py-2 px-2.5 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'drone'
                    ? 'bg-purple-600 text-white border-purple-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Plane className="w-4 h-4" />
                <span className="text-[11px] truncate">Drone / UAV</span>
              </button>

              {/* 5. Mobile Phone Camera */}
              <button
                type="button"
                onClick={() => handleTypeChange('phone')}
                className={`py-2 px-2.5 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'phone'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[11px] truncate">Phone Camera</span>
              </button>

              {/* 6. PC / USB Webcam */}
              <button
                type="button"
                onClick={() => handleTypeChange('webcam')}
                className={`py-2 px-2.5 rounded-lg border text-center text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                  equipmentType === 'webcam'
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow'
                    : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span className="text-[11px] truncate">PC / USB Webcam</span>
              </button>
            </div>

            {/* CONNECTION INPUTS BASED ON EQUIPMENT TYPE */}
            {/* CASE 1, 2, 3: Fixed IP, PTZ, Thermal RTSP Streams */}
            {(equipmentType === 'rtsp' || equipmentType === 'ptz' || equipmentType === 'thermal') && (
              <div className="p-3.5 bg-[#0e1626] border border-slate-800 rounded-xl space-y-3">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {equipmentType === 'thermal' ? 'Thermal RTSP Stream URL' : equipmentType === 'ptz' ? 'PTZ Speed Dome RTSP URL' : 'RTSP Stream URL'}{' '}
                      <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            rtsp_url: equipmentType === 'thermal'
                              ? 'rtsp://192.168.1.120:554/Streaming/Channels/201'
                              : equipmentType === 'ptz'
                              ? 'rtsp://192.168.1.100:554/Streaming/Channels/101'
                              : 'rtsp://192.168.1.100:554/live'
                          }));
                        }}
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                        title="Fill standard IP Camera RTSP Template"
                      >
                        Reset to Default RTSP
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                    placeholder={
                      equipmentType === 'thermal'
                        ? 'rtsp://admin:pass@192.168.1.64:554/Streaming/Channels/201 (Thermal Sensor)'
                        : 'rtsp://admin:pass@192.168.1.64:554/Streaming/Channels/101'
                    }
                    className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-sky-300 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 font-mono mt-1.5">
                    <span>Hikvision/CP+: <code className="text-slate-300">rtsp://user:pass@IP:554/Streaming/Channels/101</code></span>
                    <span>Dahua: <code className="text-slate-300">rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0</code></span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Camera Username (if not in URL)
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="admin"
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Camera Password (if not in URL)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CASE NVR / DVR: Central Video Recorder (Multi-Channel) */}
            {equipmentType === 'nvr' && (
              <div className="p-4 bg-[#0e1626] border border-indigo-500/40 rounded-xl space-y-3.5">
                {/* Header Banner with NVR vs DVR Toggle */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-indigo-900/40">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                        {nvrDeviceType.toUpperCase()} Multi-Channel Central Recorder
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Connect border cameras via central {nvrDeviceType.toUpperCase()} box channel slots.
                      </p>
                    </div>
                  </div>

                  {/* NVR vs DVR Switch */}
                  <div className="flex items-center bg-[#080d1a] border border-[#22324d] rounded-lg p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateNvrState('nvr', nvrBrand, nvrIp, nvrPort, nvrChannel)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                        nvrDeviceType === 'nvr' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      NVR (IP Box)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNvrState('dvr', nvrBrand, nvrIp, nvrPort, nvrChannel)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                        nvrDeviceType === 'dvr' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      DVR (BNC Box)
                    </button>
                  </div>
                </div>

                {/* Brand and Network Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {nvrDeviceType.toUpperCase()} Brand Preset
                    </label>
                    <select
                      value={nvrBrand}
                      onChange={(e) => updateNvrState(nvrDeviceType, e.target.value as any, nvrIp, nvrPort, nvrChannel)}
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="hikvision">Hikvision / Uniview (/Channels/X01)</option>
                      <option value="dahua_cpplus">CP Plus / Dahua (/realmonitor?channel=X)</option>
                      <option value="generic">Generic ONVIF / RTSP (/chX/main/)</option>
                      <option value="custom">Custom NVR Stream Path</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {nvrDeviceType.toUpperCase()} IP Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nvrIp}
                      onChange={(e) => updateNvrState(nvrDeviceType, nvrBrand, e.target.value, nvrPort, nvrChannel)}
                      placeholder="192.168.1.100"
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      RTSP Port
                    </label>
                    <input
                      type="text"
                      required
                      value={nvrPort}
                      onChange={(e) => updateNvrState(nvrDeviceType, nvrBrand, nvrIp, e.target.value, nvrChannel)}
                      placeholder="554"
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Channel Selector */}
                <div className="space-y-2 bg-[#080d1a] p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">
                      Select Video Channel (Camera Slot):
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Channel #:</span>
                      <input
                        type="number"
                        min="1"
                        max="128"
                        value={nvrChannel}
                        onChange={(e) => updateNvrState(nvrDeviceType, nvrBrand, nvrIp, nvrPort, parseInt(e.target.value) || 1)}
                        className="w-16 bg-[#111a2e] border border-indigo-500/50 rounded px-2 py-1 text-xs font-mono text-indigo-300 font-bold text-center focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Channel Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 32, 64].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => updateNvrState(nvrDeviceType, nvrBrand, nvrIp, nvrPort, ch)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded border transition cursor-pointer ${
                          nvrChannel === ch
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                            : 'bg-[#111a2e] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        Ch {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Channel Stream URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Channel {nvrChannel} Stream URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                    className="w-full bg-[#080d1a] border border-indigo-500/40 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Auto-configured for {nvrBrand === 'hikvision' ? 'Hikvision' : nvrBrand === 'dahua_cpplus' ? 'CP Plus / Dahua' : 'NVR'} Channel {nvrChannel}. Editable if custom parameters are needed.
                  </p>
                </div>

                {/* Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {nvrDeviceType.toUpperCase()} Username
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="admin"
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {nvrDeviceType.toUpperCase()} Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CASE 4: Drone / UAV Aerial Recon Stream */}
            {equipmentType === 'drone' && (
              <div className="p-3.5 bg-[#0e1626] border border-purple-900/40 rounded-xl space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Drone System Preset</label>
                    <select
                      value={droneProtocol}
                      onChange={(e) => handleDroneProtocolChange(e.target.value)}
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="dji_rtsp">DJI Enterprise / Pilot 2 (RTSP Stream)</option>
                      <option value="qgc_udp">QGroundControl / MAVLink (UDP 5600)</option>
                      <option value="dji_rtmp">DJI RTMP Live Broadcast</option>
                      <option value="custom">Custom UAV Video Feed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Drone Stream URL / Port <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.rtsp_url}
                      onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                      placeholder="udp://0.0.0.0:5600 or rtsp://192.168.1.200:8554/live"
                      className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-purple-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CASE 5: Phone Camera (Direct Browser vs IP Webcam App) */}
            {equipmentType === 'phone' && (
              <div className="p-3.5 bg-[#0e1626] border border-emerald-900/40 rounded-xl space-y-3">
                {/* Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneMode('browser');
                      setFormData(prev => ({ ...prev, rtsp_url: `edge://${prev.camera_id || 'CAM-PHONE'}`, stream_type: 'android' }));
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                      phoneMode === 'browser'
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow'
                        : 'bg-[#080d1a] border-[#22324d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-white mb-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Direct Mobile / Browser Cam</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Recommended for Cloud & Mobile. Zero setup, no IP or 3rd-party app needed.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPhoneMode('ipwebcam');
                      const cleanIp = phoneIp.trim() || '192.168.1.15';
                      const cleanPort = phonePort.trim() || '8080';
                      setFormData(prev => ({ ...prev, rtsp_url: `http://${cleanIp}:${cleanPort}/video`, stream_type: 'android' }));
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                      phoneMode === 'ipwebcam'
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow'
                        : 'bg-[#080d1a] border-[#22324d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-white mb-1">
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span>IP Webcam Android App</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      For local Wi-Fi IP (192.168.x.x). Requires running START_IBVAP.bat on laptop.
                    </p>
                  </button>
                </div>

                {phoneMode === 'browser' ? (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs space-y-1.5">
                    <div className="font-mono font-semibold text-emerald-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Direct Browser Camera Mode (Cloud & Mobile Compatible)
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Aapke phone ya laptop ke camera se seedha live video stream hoga. Camera save karne ke baad video player par <strong>"START LIVE CAMERA STREAM"</strong> click karein!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Wi-Fi IP Address</label>
                        <input
                          type="text"
                          value={phoneIp}
                          onChange={(e) => handlePhoneChange(e.target.value, phonePort)}
                          placeholder="192.168.1.15"
                          className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Port</label>
                        <input
                          type="text"
                          value={phonePort}
                          onChange={(e) => handlePhoneChange(phoneIp, e.target.value)}
                          placeholder="8080"
                          className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Stream URL</label>
                      <input
                        type="text"
                        required
                        value={formData.rtsp_url}
                        onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                        className="w-full bg-[#080d1a] border border-emerald-600/40 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CASE 6: Laptop / PC Webcam */}
            {equipmentType === 'webcam' && (
              <div className="p-3.5 bg-[#0e1626] border border-cyan-900/40 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWebcamMode('browser');
                      setFormData(prev => ({ ...prev, rtsp_url: `edge://${prev.camera_id || 'CAM-WEBCAM'}`, stream_type: 'webcam' }));
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                      webcamMode === 'browser'
                        ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow'
                        : 'bg-[#080d1a] border-[#22324d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-white mb-1">
                      <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Direct Browser Webcam</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Recommended. Streams laptop webcam directly from browser.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWebcamMode('device');
                      setFormData(prev => ({ ...prev, rtsp_url: `webcam://${webcamIndex}`, stream_type: 'webcam' }));
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                      webcamMode === 'device'
                        ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300 shadow'
                        : 'bg-[#080d1a] border-[#22324d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-white mb-1">
                      <Video className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Direct Hardware Device</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      For backend running locally on laptop via START_IBVAP.bat.
                    </p>
                  </button>
                </div>

                {webcamMode === 'browser' ? (
                  <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-xs space-y-1.5">
                    <div className="font-mono font-semibold text-cyan-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Direct Browser Webcam Mode (Cloud & Local Compatible)
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Camera save hone ke baad player par <strong>"START LIVE CAMERA STREAM"</strong> click karein. Aapka laptop webcam seedha Central Command me stream hone lagega!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Select Camera Device</label>
                      <select
                        value={webcamIndex}
                        onChange={(e) => handleWebcamChange(e.target.value)}
                        className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="0">Default Built-in Webcam (webcam://0)</option>
                        <option value="1">Secondary / USB Webcam (webcam://1)</option>
                        <option value="2">External Video Device (webcam://2)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Stream URL</label>
                      <input
                        type="text"
                        readOnly
                        value={formData.rtsp_url}
                        className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OPTIONAL SUB-STREAM URL FIELD (NO ERROR IF LEFT EMPTY) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSubStreamField(!showSubStreamField)}
                className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer select-none"
              >
                {showSubStreamField ? <ChevronUp className="w-3.5 h-3.5 text-sky-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                <span>Secondary Sub-Stream URL (Optional low-bandwidth SD feed for 2G/slow links)</span>
              </button>

              {showSubStreamField && (
                <div className="mt-2 p-3 bg-[#0a0f1d] border border-slate-800 rounded-lg space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Secondary Sub-Stream URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.sub_stream_url || ''}
                    onChange={(e) => setFormData({ ...formData, sub_stream_url: e.target.value })}
                    placeholder="e.g. rtsp://admin:password@192.168.1.64:554/Streaming/Channels/102"
                    className="w-full bg-[#080d1a] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-purple-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Khali chhodne par koi error nahi aayegi — system automatically main stream ko downsample karke sub-stream bana lega.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: GPS COORDINATES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> 3. GPS COORDINATES (TACTICAL MAP PLACEMENT)
              </h4>
              <button
                type="button"
                onClick={handleAutoDetectLocation}
                disabled={isLocatingGPS}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-mono flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Locate className={`w-3.5 h-3.5 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                <span>{isLocatingGPS ? 'Detecting...' : 'Detect GPS'}</span>
              </button>
            </div>

            {gpsStatus && (
              <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/40 rounded-lg px-2.5 py-1 flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 animate-spin" />
                <span>{gpsStatus}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Latitude (North)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude ?? ''}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      latitude: e.target.value ? parseFloat(e.target.value) : undefined
                    }))
                  }
                  placeholder="31.604800"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Longitude (East)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude ?? ''}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      longitude: e.target.value ? parseFloat(e.target.value) : undefined
                    }))
                  }
                  placeholder="74.573100"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-semibold transition cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 text-sky-400 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'TEST RTSP CONNECTION'}</span>
            </button>

            <div className="flex items-center gap-2.5">
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
                <span>{saving ? 'SAVING...' : isEditing ? 'UPDATE CAMERA' : 'REGISTER CAMERA'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* RTSP Diagnostic Tester Modal */}
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
