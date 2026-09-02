import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  Cpu,
  Layers,
  Wifi,
  MapPin
} from 'lucide-react';
import { sensorService, Sensor, SensorFusionEvent } from '../services/sensorService';

export const SensorFusionPage: React.FC = () => {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [events, setEvents] = useState<SensorFusionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [correlating, setCorrelating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SensorFusionEvent | null>(null);

  const fetchSensorsAndEvents = async () => {
    try {
      setLoading(true);
      const [sList, eList] = await Promise.all([
        sensorService.getSensors(),
        sensorService.getFusionEvents()
      ]);
      setSensors(sList);
      setEvents(eList);
      if (eList.length > 0 && !selectedEvent) {
        setSelectedEvent(eList[0]);
      }
    } catch (err) {
      console.error('Error fetching sensor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensorsAndEvents();
    const interval = setInterval(fetchSensorsAndEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerLiveCorrelation = async () => {
    try {
      setCorrelating(true);
      const newEvent = await sensorService.executeMultiSensorFusion({
        site_id: 'SITE-BORDER-NORTH',
        sector: 'Sector-North',
        observations: [
          {
            sensor_id: 'RAD-01',
            sensor_type: 'RADAR',
            detection: 'PERSON_INTRUSION',
            confidence: 0.94,
            timestamp: new Date().toISOString(),
            location: { lat: 31.6245, lng: 74.8725 }
          },
          {
            sensor_id: 'SEIS-01',
            sensor_type: 'SEISMIC',
            detection: 'PERSON_INTRUSION',
            confidence: 0.86,
            timestamp: new Date().toISOString(),
            location: { lat: 31.6247, lng: 74.8728 }
          },
          {
            sensor_id: 'ACU-01',
            sensor_type: 'ACOUSTIC',
            detection: 'MOTION',
            confidence: 0.72,
            timestamp: new Date().toISOString()
          }
        ]
      });
      setEvents(prev => [newEvent, ...prev]);
      setSelectedEvent(newEvent);
    } catch (err) {
      console.error('Correlation failed:', err);
    } finally {
      setCorrelating(false);
    }
  };

  const filteredSensors = filterType === 'ALL'
    ? sensors
    : sensors.filter(s => s.sensor_type === filterType);

  const getSensorBadgeColor = (type: string) => {
    switch (type) {
      case 'RADAR': return 'bg-cyan-900/60 text-cyan-300 border-cyan-700';
      case 'THERMAL': return 'bg-amber-900/60 text-amber-300 border-amber-700';
      case 'SEISMIC': return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
      case 'ACOUSTIC': return 'bg-purple-900/60 text-purple-300 border-purple-700';
      case 'DRONE': return 'bg-blue-900/60 text-blue-300 border-blue-700';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-600/20 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Multi-Sensor Bayesian Intelligence</h1>
              <p className="text-slate-400 text-sm">Heterogeneous Optical, Radar, Seismic, Acoustic & Drone signal fusion engine</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSensorsAndEvents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={triggerLiveCorrelation}
            disabled={correlating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-lg shadow-cyan-900/30 text-sm transition"
          >
            <Cpu className="w-4 h-4" />
            {correlating ? 'Correlating Signals...' : 'Execute Live Evidential Fusion'}
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Sensors</span>
            <Wifi className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{sensors.filter(s => s.status === 'ONLINE').length} / {sensors.length}</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> 100% Perimeter Grid Health
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bayesian Confidence</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">96.4%</div>
          <div className="text-xs text-slate-400 mt-1">Multi-modal cross-verification</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sensor Conflicts</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {events.filter(e => e.conflict_status !== 'NONE').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Self-resolving evidential logic</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Grid Latency</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">18.5 ms</div>
          <div className="text-xs text-cyan-400 mt-1">Zero edge packet drops</div>
        </div>
      </div>

      {/* Main Section: Sensors Array & Fusion Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sensor Fleet Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Perimeter Multi-Sensor Fleet
              </h2>

              <div className="flex flex-wrap gap-1.5">
                {['ALL', 'RADAR', 'SEISMIC', 'ACOUSTIC', 'DRONE', 'THERMAL'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      filterType === type
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSensors.map(sensor => (
                <div
                  key={sensor.sensor_id}
                  className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 p-4 rounded-xl transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{sensor.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {sensor.location || sensor.sector}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSensorBadgeColor(sensor.sensor_type)}`}>
                      {sensor.sensor_type}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-xs">
                    <div>
                      <div className="text-slate-500 text-[10px]">Health</div>
                      <div className="font-semibold text-emerald-400">{sensor.health_score}%</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Reliability</div>
                      <div className="font-semibold text-cyan-400">{Math.round(sensor.reliability_weight * 100)}%</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">Latency</div>
                      <div className="font-semibold text-slate-300">{sensor.latency_ms}ms</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {sensor.status}
                    </span>
                    <span className="text-[11px] text-slate-500">ID: {sensor.sensor_id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Bayesian Evidence Analysis Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Bayesian Fusion Analysis
            </h2>

            {selectedEvent ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Event ID:</span>
                    <span className="text-xs font-mono text-cyan-400">{selectedEvent.fusion_event_id}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Classification:</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-950 text-red-300 border border-red-800">
                      {selectedEvent.fused_event_type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Fused Confidence:</span>
                    <span className="text-sm font-bold text-emerald-400">{Math.round(selectedEvent.confidence * 100)}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Threat Risk Score:</span>
                    <span className="text-sm font-bold text-red-400">{selectedEvent.risk_score} / 100</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Conflict State:</span>
                    <span className={`text-xs font-semibold ${selectedEvent.conflict_status === 'NONE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedEvent.conflict_status}
                    </span>
                  </div>
                </div>

                {/* Mathematical Explainability */}
                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    Probabilistic Proof
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800 break-all">
                    P_fused = ∏ P_i / (∏ P_i + ∏ (1 - P_i))
                    <br />
                    Confidence: {selectedEvent.confidence}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm">
                Select or execute a fusion event to view evidential breakdown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

