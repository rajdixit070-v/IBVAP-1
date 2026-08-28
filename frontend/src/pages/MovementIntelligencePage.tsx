import React, { useState, useEffect } from 'react';
import {
  GlobalTrack,
  TrackAssociation,
  MovementAnomaly,
  CrossCameraAnalyticsSummary
} from '../types/crossCamera';
import { crossCameraService } from '../services/crossCameraService';
import { GlobalTrackDetailModal } from '../components/cross_camera/GlobalTrackDetailModal';
import { CameraGraphModal } from '../components/cross_camera/CameraGraphModal';
import { AssociationReviewModal } from '../components/cross_camera/AssociationReviewModal';
import {
  Compass,
  Search,
  RefreshCw,
  Sliders,
  Layers,
  AlertTriangle,
  Car,
  User
} from 'lucide-react';

export const MovementIntelligencePage: React.FC = () => {
  const [tracks, setTracks] = useState<GlobalTrack[]>([]);
  const [anomalies, setAnomalies] = useState<MovementAnomaly[]>([]);
  const [analytics, setAnalytics] = useState<CrossCameraAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'vehicles' | 'persons' | 'anomalies'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedAssociation] = useState<TrackAssociation | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, selectedStatus, activeTab]);

  const loadData = async () => {
    try {
      const objType = activeTab === 'vehicles' ? 'vehicle' : activeTab === 'persons' ? 'person' : undefined;
      const [tracksData, anomData, analyticsData] = await Promise.all([
        crossCameraService.getGlobalTracks({
          search: searchQuery || undefined,
          status: selectedStatus || undefined,
          object_type: objType,
          limit: 100
        }),
        crossCameraService.getMovementAnomalies({ limit: 50 }),
        crossCameraService.getAnalyticsSummary().catch(() => null)
      ]);
      setTracks(tracksData);
      setAnomalies(anomData);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (e) {
      console.error('Failed to load movement intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (trackId: string) => {
    setSelectedTrackId(trackId);
    setDetailModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#112338] via-[#0f172a] to-[#0d131f] border border-[#1e3a5f] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              CROSS-CAMERA MOVEMENT MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• CROSS-CAMERA RECONSTRUCTION</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Multi-Camera Movement Intelligence & Trajectory Console
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Probabilistic cross-camera association, camera network topology validation, continuous vehicle journeys with ANPR consensus, impossible travel detection, and route deviation analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGraphModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            CAMERA GRAPH
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-cyan-400 font-bold">TOTAL GLOBAL TRACKS</span>
            <div className="text-2xl font-mono font-black text-cyan-400">
              {analytics?.total_global_tracks ?? tracks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">VEHICLE JOURNEYS</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {analytics?.vehicle_journeys ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">MOVEMENT ANOMALIES</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {analytics?.movement_anomalies ?? anomalies.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">TOPOLOGY EDGES</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {analytics?.active_transitions_count ?? 0} Active
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'all'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            ALL GLOBAL TRACKS ({tracks.length})
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'vehicles'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            VEHICLE JOURNEYS
          </button>
          <button
            onClick={() => setActiveTab('persons')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'persons'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            PERSON MOVEMENT
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search plate or track ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">🟢 Active</option>
            <option value="PAUSED">🟠 Paused</option>
            <option value="COMPLETED">🔵 Completed</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Movement Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Tracks Table */}
      <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
              <tr>
                <th className="px-4 py-3">GLOBAL TRACK ID</th>
                <th className="px-4 py-3">PRIMARY IDENTIFIER</th>
                <th className="px-4 py-3">OBJECT TYPE</th>
                <th className="px-4 py-3">CURRENT / PREVIOUS CAMERA</th>
                <th className="px-4 py-3">TOTAL STOPS</th>
                <th className="px-4 py-3">CONFIDENCE</th>
                <th className="px-4 py-3">LAST SEEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {tracks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No global multi-camera movement records found.
                  </td>
                </tr>
              ) : (
                tracks.map((gt) => (
                  <tr
                    key={gt.id}
                    onClick={() => handleOpenDetail(gt.global_track_id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-bold text-white">
                      {gt.global_track_id}
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-400">
                      {gt.primary_identifier || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 uppercase">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        {gt.object_type === 'vehicle' ? (
                          <Car className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-sky-400" />
                        )}
                        {gt.object_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sky-400 font-bold">{gt.current_camera_id}</span>
                      {gt.previous_camera_id && (
                        <span className="text-slate-500 text-[11px]"> (from {gt.previous_camera_id})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white font-bold">
                      {gt.total_observations} stops
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-bold">
                        {Math.round(gt.overall_confidence * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {new Date(gt.last_observation_time).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <GlobalTrackDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        globalTrackId={selectedTrackId}
      />

      <CameraGraphModal
        isOpen={graphModalOpen}
        onClose={() => setGraphModalOpen(false)}
        onUpdated={loadData}
      />

      <AssociationReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        association={selectedAssociation}
        onSuccess={loadData}
      />
    </div>
  );
};
