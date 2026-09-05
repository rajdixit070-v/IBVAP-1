import React, { useState, useEffect } from 'react';
import {
  Send,
  Battery,
  Square,
  RefreshCw,
  Share2,
  Plane
} from 'lucide-react';
import { droneService, Drone, DroneMission, DroneHandoffEvent } from '../services/droneService';
import { RegisterDroneModal } from '../components/drones/RegisterDroneModal';
import { Plus } from 'lucide-react';

export const DroneOperationsPage: React.FC = () => {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [missions, setMissions] = useState<DroneMission[]>([]);
  const [handoffs, setHandoffs] = useState<DroneHandoffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [isDroneModalOpen, setIsDroneModalOpen] = useState(false);


  // New Mission form state
  const [missionObjective, setMissionObjective] = useState('');
  const [missionType, setMissionType] = useState('PATROL');

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

  const handleTriggerHandoff = async () => {
    if (!selectedDrone) return;
    try {
      const hEvent = await droneService.executeHandoff({
        source_type: 'CAMERA',
        source_id: 'CAM-001',
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
          <button
            onClick={() => setIsDroneModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 text-sm transition cursor-pointer"
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
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-lg shadow-purple-900/30 text-sm transition"
          >
            <Share2 className="w-4 h-4" />
            Trigger Camera ↔ Drone Handoff
          </button>
        </div>
      </div>

      {/* Fleet Overview Cards */}
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
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                drone.status === 'AVAILABLE'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
              }`}>
                {drone.status}
              </span>
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

                    {m.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleAbortMission(m.mission_id)}
                        className="px-2.5 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 rounded text-xs font-medium transition flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" /> Abort
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Handoff Evidence Console */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" />
              Target Handoff History
            </h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {handoffs.map(h => (
                <div key={h.handoff_id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-purple-400 font-bold">{h.handoff_id}</span>
                    <span className="text-emerald-400 font-bold">{Math.round(h.confidence * 100)}% Conf</span>
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


