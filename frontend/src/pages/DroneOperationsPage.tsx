import React, { useState, useEffect } from 'react';
import {
  Send,
  Battery,
  Square,
  RefreshCw,
  Share2,
  Plane,
  Trash2,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { droneService, Drone, DroneMission, DroneHandoffEvent } from '../services/droneService';
import { RegisterDroneModal } from '../components/drones/RegisterDroneModal';
import { useCameras } from '../context/CameraContext';

interface DroneOperationsPageProps {
  onBackToDashboard?: () => void;
}

export const DroneOperationsPage: React.FC<DroneOperationsPageProps> = ({ onBackToDashboard }) => {
  const { cameras } = useCameras();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [missions, setMissions] = useState<DroneMission[]>([]);
  const [handoffs, setHandoffs] = useState<DroneHandoffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [isDroneModalOpen, setIsDroneModalOpen] = useState(false);

  // New Mission form state
  const [missionObjective, setMissionObjective] = useState('');
  const [missionType, setMissionType] = useState('PATROL');

  const handleDeleteDrone = async (droneId: string) => {
    if (!window.confirm(`Are you sure you want to delete drone ${droneId}?`)) return;
    try {
      await droneService.deleteDrone(droneId);
      if (selectedDrone?.drone_id === droneId) {
        setSelectedDrone(null);
      }
      fetchFleetData();
    } catch (err) {
      console.error('Failed to delete drone:', err);
    }
  };


  const fetchFleetData = async () => {
    try {
      setLoading(true);
      const [dList, mList, hList] = await Promise.all([
        droneService.getDrones(),
        droneService.getMissions(),
        droneService.getHandoffHistory()
      ]);
      setDrones(dList);
      setMissions(mList);
      setHandoffs(hList);
      if (dList.length > 0 && !selectedDrone) {
        setSelectedDrone(dList[0]);
      }
    } catch (err) {
      console.error('Error fetching drone data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateAndDispatchMission = async () => {
    if (!selectedDrone || !missionObjective.trim()) return;
    try {
      const mission = await droneService.createMission({
        drone_id: selectedDrone.drone_id,
        mission_type: missionType,
        objective: missionObjective,
        priority: 'HIGH'
      });
      await droneService.dispatchMission(mission.mission_id);
      setMissionObjective('');
      fetchFleetData();
    } catch (err) {
      console.error('Failed to create/dispatch mission:', err);
    }
  };

  const handleAbortMission = async (missionId: string) => {
    try {
      await droneService.abortMission(missionId, 'Operator Emergency Abort');
      fetchFleetData();
    } catch (err) {
      console.error('Abort mission failed:', err);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!window.confirm(`Delete mission record ${missionId}?`)) return;
    try {
      await droneService.deleteMission(missionId);
      setMissions(prev => prev.filter(m => m.mission_id !== missionId));
    } catch (err) {
      console.error('Failed to delete mission:', err);
    }
  };

  const handleDeleteHandoff = async (handoffId: string) => {
    if (!window.confirm(`Delete trigger handoff record ${handoffId}?`)) return;
    try {
      await droneService.deleteHandoff(handoffId);
      setHandoffs(prev => prev.filter(h => h.handoff_id !== handoffId));
    } catch (err) {
      console.error('Failed to delete handoff record:', err);
    }
  };

  const handleClearAllHandoffs = async () => {
    if (!window.confirm('Are you sure you want to delete all trigger & handoff history?')) return;
    try {
      await droneService.clearHandoffHistory();
      setHandoffs([]);
    } catch (err) {
      console.error('Failed to clear handoff history:', err);
    }
  };

  const handleTriggerHandoff = async () => {
    if (!selectedDrone) return;
    const activeCamId = cameras.length > 0 ? cameras[0].camera_id : 'CAM-ALPHA-01';
    try {
      const hEvent = await droneService.executeHandoff({
        source_type: 'CAMERA',
        source_id: activeCamId,
        destination_type: 'DRONE',
        destination_id: selectedDrone.drone_id,
        global_track_id: 'GTRK-98214',
        target_class: 'PERSON',
        location_lat: selectedDrone.latitude || 31.6245,
        location_lng: selectedDrone.longitude || 74.8725,
        reason: 'Target exiting ground camera sector toward riverbed.'
      });
      setHandoffs(prev => [hEvent, ...prev]);
      fetchFleetData();
    } catch (err) {
      console.error('Target handoff failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Plane className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Autonomous Drone Fleet & Handoff Operations</h1>
            <p className="text-slate-400 text-sm">Airborne reconnaissance, mission lifecycle automation & seamless ground-to-air track handoff</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-sm transition cursor-pointer font-mono font-medium"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Dashboard</span>
            </button>
          )}
          <button
            onClick={() => setIsDroneModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-900/30 text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Drone (UAV)
          </button>
          <button
            onClick={fetchFleetData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleTriggerHandoff}
            disabled={!selectedDrone}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 text-sm transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Trigger Camera ↔ Drone Handoff
          </button>
        </div>
      </div>

      {/* Fleet Overview Cards */}
      {drones.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
          <Plane className="w-12 h-12 text-emerald-500/40" />
          <div>
            <h3 className="text-base font-bold text-white">No UAVs / Drones Registered</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Register an autonomous surveillance UAV or quadcopter to initiate perimeter patrols and target handoff tracking.
            </p>
          </div>
          <button
            onClick={() => setIsDroneModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register First Drone
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drones.map(drone => (
            <div
              key={drone.drone_id}
              onClick={() => setSelectedDrone(drone)}
              className={`p-4 rounded-xl border transition cursor-pointer ${
                selectedDrone?.drone_id === drone.drone_id
                  ? 'bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Plane className="w-4 h-4 text-emerald-400" />
                    {drone.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{drone.model} | ID: {drone.drone_id}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    drone.status === 'AVAILABLE'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
                  }`}>
                    {drone.status}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDrone(drone.drone_id);
                    }}
                    title="Delete UAV"
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/60 rounded border border-transparent hover:border-red-800/80 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 my-2 border-y border-slate-800 text-xs">
                <div>
                  <div className="text-slate-500 text-[10px]">Battery</div>
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <Battery className="w-3 h-3" /> {drone.battery_pct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Altitude</div>
                  <div className="font-bold text-cyan-400">{drone.altitude_m}m</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">Speed</div>
                  <div className="font-bold text-slate-300">{drone.speed_mps} m/s</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Flight: {drone.flight_state}</span>
                <span className="font-mono text-[11px] text-slate-500">Satellites: {drone.gps_satellites}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: Mission Planning & Handoff Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Mission Dispatcher & Active Missions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Tactical Mission Dispatcher
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Target UAV</label>
                <input
                  type="text"
                  disabled
                  value={selectedDrone ? `${selectedDrone.name} (${selectedDrone.drone_id})` : 'Select a Drone'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Mission Profile</label>
                <select
                  value={missionType}
                  onChange={e => setMissionType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="PATROL">PATROL (Perimeter Orbit)</option>
                  <option value="INTERCEPT">INTERCEPT (Rapid Response)</option>
                  <option value="TRACK_TARGET">TRACK TARGET (Autonomous Chase)</option>
                  <option value="RECONNAISSANCE">RECONNAISSANCE (Thermal Sweep)</option>
                </select>
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  onClick={handleCreateAndDispatchMission}
                  disabled={!selectedDrone || !missionObjective.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Mission
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Tactical Objective & Waypoint Directives</label>
              <input
                type="text"
                placeholder="e.g. Conduct thermal sweep along North Ravine zero-line corridor..."
                value={missionObjective}
                onChange={e => setMissionObjective(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            {/* Active Missions Table */}
            <div className="pt-3 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Live Fleet Missions</h3>
              {missions.length === 0 ? (
                <div className="p-4 text-center bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-500">
                  No active or planned missions. Dispatch a mission above to start a flight path.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {missions.map(m => (
                    <div
                      key={m.mission_id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{m.mission_type}</span>
                          <span className="font-mono text-[10px] text-cyan-400">{m.mission_id}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{m.objective}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {m.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleAbortMission(m.mission_id)}
                            className="px-2.5 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 rounded text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                          >
                            <Square className="w-3 h-3" /> Abort
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMission(m.mission_id)}
                          title="Delete Mission Record"
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/60 rounded border border-transparent hover:border-red-800/80 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Handoff Evidence Console */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                Target Handoff & Trigger History
              </h2>
              {handoffs.length > 0 && (
                <button
                  onClick={handleClearAllHandoffs}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 rounded-lg text-xs font-mono transition cursor-pointer"
                  title="Clear all trigger & handoff history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {handoffs.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-500">
                <Share2 className="w-8 h-8 mx-auto mb-2 text-purple-500/30" />
                <span>No trigger or handoff events recorded yet.</span>
                <p className="text-[11px] text-slate-600 mt-1">Click 'Trigger Camera ↔ Drone Handoff' above to log a new trigger.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {handoffs.map(h => (
                  <div key={h.handoff_id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5 relative group">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-purple-400 font-bold">{h.handoff_id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{Math.round(h.confidence * 100)}% Conf</span>
                        <button
                          onClick={() => handleDeleteHandoff(h.handoff_id)}
                          title="Delete this trigger record"
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/60 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-white font-semibold flex items-center gap-1">
                      <span>{h.source_type} ({h.source_id})</span>
                      <span>→</span>
                      <span className="text-emerald-400">{h.destination_type} ({h.destination_id})</span>
                    </div>
                    <div className="text-slate-400 text-[11px] flex justify-between">
                      <span>Track: <span className="text-cyan-400 font-mono">{h.global_track_id}</span></span>
                      <span>Class: <span className="text-slate-300">{h.target_class}</span></span>
                    </div>
                    {h.reason && <div className="text-slate-500 text-[10px] italic">{h.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <RegisterDroneModal
        isOpen={isDroneModalOpen}
        onClose={() => setIsDroneModalOpen(false)}
        onSuccess={fetchFleetData}
      />
    </div>
  );
};


