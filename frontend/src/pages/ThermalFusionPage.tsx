import React, { useState, useEffect } from 'react';
import {
  Flame,
  Sun,
  Moon,
  Sliders,
  RefreshCw,
  Eye,
  Thermometer,
  AlertOctagon,
  Camera
} from 'lucide-react';
import { thermalService, CameraPair, ThermalFusionResult } from '../services/thermalService';
import { CreatePairModal } from '../components/thermal/CreatePairModal';
import { Plus } from 'lucide-react';

export const ThermalFusionPage: React.FC = () => {
  const [pairs, setPairs] = useState<CameraPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<CameraPair | null>(null);
  const [results, setResults] = useState<ThermalFusionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [fusionMode, setFusionMode] = useState<'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY'>('FUSED');
  const [lightingCondition, setLightingCondition] = useState<string>('NIGHT');
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [executing, setExecuting] = useState<boolean>(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [pList, rList] = await Promise.all([
        thermalService.getCameraPairs(),
        thermalService.getFusionResults()
      ]);
      setPairs(pList);
      setResults(rList);
      if (pList.length > 0 && !selectedPair) {
        setSelectedPair(pList[0]);
        setFusionMode(pList[0].fusion_mode);
      }
    } catch (err) {
      console.error('Error fetching thermal fusion pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExecuteFusion = async () => {
    if (!selectedPair) return;
    try {
      setExecuting(true);
      const res = await thermalService.executeFusion({
        pair_id: selectedPair.pair_id,
        lighting_condition: lightingCondition,
        rgb_detections: [
          { class: 'person', confidence: lightingCondition === 'NIGHT' ? 0.35 : 0.88, bbox: [0.25, 0.30, 0.15, 0.35] }
        ],
        thermal_detections: [
          { class: 'person', confidence: 0.96, bbox: [0.26, 0.31, 0.14, 0.34], temp_c: 37.4 },
          { class: 'concealed_weapon', confidence: 0.82, bbox: [0.32, 0.42, 0.05, 0.08], temp_c: 18.2 }
        ]
      });
      setResults(prev => [res, ...prev]);
    } catch (err) {
      console.error('Failed to execute thermal fusion:', err);
    } finally {
      setExecuting(false);
    }
  };

  const handleModeChange = async (mode: 'FUSED' | 'RGB_ONLY' | 'THERMAL_ONLY') => {
    setFusionMode(mode);
    if (selectedPair) {
      try {
        const updated = await thermalService.updateCameraPair(selectedPair.pair_id, { fusion_mode: mode });
        setSelectedPair(updated);
      } catch (err) {
        console.error('Failed to update pair mode:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Thermal + RGB Sensor Alignment & Fusion</h1>
            <p className="text-slate-400 text-sm">Spatial homography matrix correlation, temperature anomaly mapping & low-light boost</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-lg shadow-amber-900/30 text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Camera Pair
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-sm transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExecuteFusion}
            disabled={executing || !selectedPair}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-lg shadow-amber-900/30 text-sm transition"
          >
            <Eye className="w-4 h-4" />
            {executing ? 'Aligning Frames...' : 'Trigger Synchronized Fusion'}
          </button>
        </div>
      </div>

      {/* Main Dual Feed + Calibration Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Dual Feed and Overlay Simulator */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <select
                    value={selectedPair?.pair_id || ''}
                    onChange={e => {
                      const p = pairs.find(x => x.pair_id === e.target.value);
                      if (p) {
                        setSelectedPair(p);
                        setFusionMode(p.fusion_mode);
                      }
                    }}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm font-bold text-white"
                  >
                    {pairs.map(p => (
                      <option key={p.pair_id} value={p.pair_id}>
                        {p.pair_id} ({p.rgb_camera_id} ↔ {p.thermal_camera_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  RGB: {selectedPair?.rgb_camera_id || 'None'} ↔ Thermal: {selectedPair?.thermal_camera_id || 'None'}
                </div>

              </div>

              {/* Mode Switcher */}
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['FUSED', 'RGB_ONLY', 'THERMAL_ONLY'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition ${
                      fusionMode === m ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Canvas Display Box */}
            <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {/* Synthetic Visual Representation */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 opacity-90" />
              
              {/* Simulated target box with thermal heat contour */}
              <div className="relative z-10 border-2 border-dashed border-amber-400/80 bg-amber-500/10 p-4 rounded-lg flex flex-col items-center">
                <Thermometer className="w-8 h-8 text-amber-400 animate-bounce" />
                <span className="text-xs font-bold text-amber-300 mt-1">THERMAL TARGET IDENTIFIED</span>
                <span className="text-[11px] font-mono text-emerald-400">Temp: 37.4°C (Core Human Temp)</span>
                <span className="text-[10px] text-red-400 font-bold mt-1 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                  Heat Anomaly: Cold Contraband Object Detected (18.2°C)
                </span>
              </div>

              {/* Status Overlay HUD */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 space-y-0.5">
                <div>MODE: <span className="text-amber-400 font-bold">{fusionMode}</span></div>
                <div>ENV LIGHTING: <span className="text-cyan-400">{lightingCondition}</span></div>
                <div>SYNC JITTER: <span className="text-emerald-400">&lt; 12ms</span></div>
              </div>

              <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
                OVERLAP: <span className="text-emerald-400 font-bold">{Math.round((selectedPair?.overlap_ratio || 0.88) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Calibration Controls & Heat Anomalies */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              Homography Alignment
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Environment Lighting Condition</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLightingCondition('DAY')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
                      lightingCondition === 'DAY'
                        ? 'bg-amber-600/20 text-amber-300 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Sun className="w-4 h-4" /> Day (RGB Bias)
                  </button>
                  <button
                    onClick={() => setLightingCondition('NIGHT')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
                      lightingCondition === 'NIGHT'
                        ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Moon className="w-4 h-4" /> Night (Thermal Boost)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Spatial Scale Transform</span>
                  <span className="font-mono text-amber-400">{scaleFactor.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.01"
                  value={scaleFactor}
                  onChange={e => setScaleFactor(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-950"
                />
              </div>
            </div>

            {/* Heat Anomalies & Evidence Feed */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-red-400" />
                Detected Anomalies & Evidence
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {results.map(res => (
                  <div key={res.result_id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-mono">
                      <span className="text-cyan-400">{res.result_id}</span>
                      <span className="text-emerald-400 font-bold">{Math.round(res.fused_confidence * 100)}% Conf</span>
                    </div>
                    <div className="text-slate-400 flex items-center justify-between text-[11px]">
                      <span>RGB: {Math.round(res.rgb_confidence * 100)}% | Thermal: {Math.round(res.thermal_confidence * 100)}%</span>
                      {res.has_heat_anomaly && (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Heat Anomaly
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreatePairModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};



