import React, { useState, useEffect } from 'react';
import {
  ActivityTimeSeriesResponse,
  ForecastResponse,
  EarlyWarning,
  HotspotZone,
  RecommendedAttentionItem,
  ModelHealth
} from '../types/predictive';
import { predictiveService } from '../services/predictiveService';
import { EarlyWarningDetailModal } from '../components/predictive/EarlyWarningDetailModal';
import { HotspotsMapModal } from '../components/predictive/HotspotsMapModal';
import { BaselineShiftModal } from '../components/predictive/BaselineShiftModal';
import {
  TrendingUp,
  AlertTriangle,
  MapPin,
  Cctv,
  Activity,
  ShieldCheck,
  Sparkles,
  Sliders,
  RefreshCw
} from 'lucide-react';

export const PredictiveIntelligencePage: React.FC = () => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [timeSeries, setTimeSeries] = useState<ActivityTimeSeriesResponse | null>(null);
  const [warnings, setWarnings] = useState<EarlyWarning[]>([]);
  const [hotspots, setHotspots] = useState<HotspotZone[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedAttentionItem[]>([]);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected filters
  const [selectedCamera, setSelectedCamera] = useState('CAM-001');
  const [horizonMinutes, setHorizonMinutes] = useState(60);

  // Modals
  const [selectedWarning, setSelectedWarning] = useState<EarlyWarning | null>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [hotspotsModalOpen, setHotspotsModalOpen] = useState(false);
  const [shiftsModalOpen, setShiftsModalOpen] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedCamera, horizonMinutes]);

  const loadData = async () => {
    try {
      const [fData, tsData, wData, hData, rData, mData] = await Promise.all([
        predictiveService.getForecast({ target_id: selectedCamera, horizon_minutes: horizonMinutes }),
        predictiveService.getActivityTimeSeries({ target_id: selectedCamera, window_minutes: 15, history_points: 12 }),
        predictiveService.getEarlyWarnings({ limit: 50 }),
        predictiveService.getHotspots(),
        predictiveService.getRecommendedAttention(),
        predictiveService.getModelHealth()
      ]);

      setForecast(fData);
      setTimeSeries(tsData);
      setWarnings(wData);
      setHotspots(hData);
      setRecommendations(rData.recommendations || []);
      setModelHealth(mData);
    } catch (e) {
      console.error('Failed to load predictive intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWarning = (w: EarlyWarning) => {
    setSelectedWarning(w);
    setWarningModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#172138] via-[#10192b] to-[#0a101d] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              PREDICTIVE FORECASTING MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• ANOMALY FORECASTING & EARLY WARNING</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Predictive Intelligence & Early Warning Decision Console
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Short-term activity anomaly forecasting, trend slope estimation, statistical baseline comparisons, spatial activity hotspots, and AI-assisted monitoring camera recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHotspotsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <MapPin className="w-4 h-4 text-cyan-400" />
            HOTSPOTS MAP ({hotspots.length})
          </button>
          <button
            onClick={() => setShiftsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            BASELINE SHIFTS
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Predictive Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[11px] text-cyan-400 font-bold">FORECAST RISK</span>
            <div className="text-2xl font-black text-cyan-400">
              {forecast?.forecast_risk_score ?? 40} <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Current Risk: {forecast?.current_risk_score ?? 35}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[11px] text-amber-400 font-bold">ACTIVITY TREND</span>
            <div className="text-2xl font-black text-amber-400">
              {timeSeries?.trend ?? 'STABLE'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Slope: {timeSeries?.trend_slope ?? 0.0} events/h
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[11px] text-emerald-400 font-bold">DATA QUALITY</span>
            <div className="text-2xl font-black text-emerald-400">
              {Math.round((forecast?.data_quality_score ?? 0.94) * 100)}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              Confidence: {Math.round((forecast?.confidence ?? 0.78) * 100)}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1 font-mono">
            <span className="text-[11px] text-purple-400 font-bold">ACTIVE EARLY WARNINGS</span>
            <div className="text-2xl font-black text-purple-400">
              {warnings.filter((w) => w.lifecycle_status === 'ACTIVE').length}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Hotspots: {hotspots.filter((h) => h.hotspot_level !== 'NORMAL').length} elevated
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Target Selector Bar */}
      <div className="flex items-center justify-between bg-[#111a2e] p-3 rounded-xl border border-[#1e293b] font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-bold">SURVEILLANCE TARGET:</span>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-slate-700 rounded-lg text-white font-bold"
          >
            <option value="CAM-001">CAM-001 (Perimeter Gate North-1)</option>
            <option value="CAM-002">CAM-002 (Sector 4 River Crossing)</option>
            <option value="CAM-003">CAM-003 (East Boundary Fencing)</option>
            <option value="CAM-004">CAM-004 (South Approach Road)</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-bold">FORECAST HORIZON:</span>
          <select
            value={horizonMinutes}
            onChange={(e) => setHorizonMinutes(Number(e.target.value))}
            className="px-3 py-1.5 bg-[#090d16] border border-slate-700 rounded-lg text-white font-bold"
          >
            <option value={30}>Next 30 Minutes</option>
            <option value={60}>Next 60 Minutes</option>
            <option value={120}>Next 2 Hours</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Forecast Breakdown + Timeline Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Short-Term Anomaly Forecast Card */}
        {forecast && (
          <div className="bg-[#111a2e] border border-cyan-500/30 rounded-xl p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Short-Term Activity Forecast
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                  forecast.forecast_level === 'HIGH'
                    ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                    : forecast.forecast_level === 'ELEVATED'
                    ? 'bg-orange-950 text-orange-300 border-orange-500/40'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {forecast.forecast_level} ACTIVITY
              </span>
            </div>

            <div className="bg-[#090d16] p-4 rounded-xl border border-slate-800 space-y-2 text-center">
              <span className="text-[10px] text-slate-500 block">EXPECTED ACTIVITY COUNT</span>
              <div className="text-3xl font-black text-cyan-400">
                {forecast.expected_activity_count.toFixed(1)} <span className="text-xs text-slate-400">events</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Uncertainty Range: <span className="text-white font-bold">{forecast.expected_range_min}</span> to <span className="text-white font-bold">{forecast.expected_range_max}</span> events
              </div>
            </div>

            {/* Contributing Risk Drivers */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">
                Contributing Risk Drivers ({forecast.reasons.length})
              </span>
              {forecast.reasons.length === 0 ? (
                <div className="p-2 bg-[#090d16] rounded-lg text-slate-500 text-center">
                  No elevated risk drivers detected.
                </div>
              ) : (
                forecast.reasons.map((r, idx) => (
                  <div key={idx} className="p-2.5 bg-[#171424] border border-amber-500/20 rounded-lg space-y-0.5">
                    <div className="text-amber-300 font-bold text-xs">{r.driver.replace(/_/g, ' ')}</div>
                    <div className="text-slate-400 text-[11px]">{r.description}</div>
                  </div>
                ))
              )}
            </div>

            {/* Mitigating Counter-signals */}
            {forecast.counter_signals.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">
                  Mitigating Evidence ({forecast.counter_signals.length})
                </span>
                {forecast.counter_signals.map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-[#091a1a] border border-emerald-500/20 rounded-lg space-y-0.5">
                    <div className="text-emerald-300 font-bold text-xs">{c.signal.replace(/_/g, ' ')}</div>
                    <div className="text-slate-400 text-[11px]">{c.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Time-Series Activity Timeline Table / Chart */}
        <div className="lg:col-span-2 bg-[#111a2e] border border-[#1e293b] rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Activity Time-Series & Baseline Comparison
            </span>
            <span className="text-slate-400 text-[11px]">
              15-Min Windows • Linear Trend: <span className="text-amber-400 font-bold">{timeSeries?.trend}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#142038] text-slate-400 uppercase text-[10px] border-b border-[#1e293b]">
                <tr>
                  <th className="px-3 py-2">TIME</th>
                  <th className="px-3 py-2">ACTUAL</th>
                  <th className="px-3 py-2">EXPECTED BASELINE</th>
                  <th className="px-3 py-2">UNCERTAINTY BAND</th>
                  <th className="px-3 py-2">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {timeSeries?.points.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="px-3 py-2 font-bold text-white">
                      {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 font-bold text-cyan-400">
                      {p.actual_count} events
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {p.expected_count.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      [{p.lower_bound} – {p.upper_bound}]
                    </td>
                    <td className="px-3 py-2">
                      {p.is_spike ? (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                          ACTIVITY SPIKE
                        </span>
                      ) : p.is_drop ? (
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                          ACTIVITY DROP
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                          NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Early Warnings Table & Recommended Attention Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Early Warnings Feed */}
        <div className="lg:col-span-2 bg-[#111a2e] border border-[#1e293b] rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Active Early Warnings ({warnings.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#142038] text-slate-400 uppercase text-[10px] border-b border-[#1e293b]">
                <tr>
                  <th className="px-3 py-2">WARNING ID</th>
                  <th className="px-3 py-2">SECTOR // ZONE</th>
                  <th className="px-3 py-2">LEVEL</th>
                  <th className="px-3 py-2">FORECAST RISK</th>
                  <th className="px-3 py-2">DEVIATION</th>
                  <th className="px-3 py-2">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {warnings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No active early warnings.
                    </td>
                  </tr>
                ) : (
                  warnings.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2 font-bold text-white">{w.warning_id}</td>
                      <td className="px-3 py-2">
                        <span className="text-sky-400 font-bold">{w.camera_id}</span>
                        {w.zone_name && <span className="text-slate-500 text-[10px] block">{w.zone_name}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            w.warning_level === 'HIGH'
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                              : w.warning_level === 'ELEVATED'
                              ? 'bg-orange-950 text-orange-300 border-orange-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {w.warning_level}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-amber-400">
                        {w.forecast_risk_score} / 100
                      </td>
                      <td className="px-3 py-2 text-white font-bold">
                        +{w.deviation_percent.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleOpenWarning(w)}
                          className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          REVIEW
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommended Attention Cards */}
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl p-5 space-y-4 font-mono text-xs">
          <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
            <Cctv className="w-4 h-4 text-cyan-400" />
            Smart Monitoring Attention Priority
          </span>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {recommendations.map((r, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCamera(r.camera_id)}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  selectedCamera === r.camera_id
                    ? 'bg-[#15233c] border-cyan-500 text-white'
                    : 'bg-[#090d16] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{r.camera_id}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      r.priority === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                        : r.priority === 'HIGH'
                        ? 'bg-orange-950 text-orange-300 border-orange-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {r.priority} PRIORITY
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{r.reason}</div>
              </div>
            ))}
          </div>

          {/* Model Telemetry */}
          {modelHealth && (
            <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 space-y-1 pt-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Model Version:</span>
                <span className="text-cyan-400 font-bold">v{modelHealth.model_version}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Error Metrics:</span>
                <span className="text-slate-300">MAE {modelHealth.mae_score} • RMSE {modelHealth.rmse_score}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EarlyWarningDetailModal
        isOpen={warningModalOpen}
        onClose={() => setWarningModalOpen(false)}
        warning={selectedWarning}
        onUpdated={loadData}
      />

      <HotspotsMapModal
        isOpen={hotspotsModalOpen}
        onClose={() => setHotspotsModalOpen(false)}
        hotspots={hotspots}
      />

      <BaselineShiftModal
        isOpen={shiftsModalOpen}
        onClose={() => setShiftsModalOpen(false)}
        onUpdated={loadData}
      />
    </div>
  );
};
