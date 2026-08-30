import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { HotspotZone } from '../../types/predictive';
import { MapPin, Layers } from 'lucide-react';

interface HotspotsMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotspots: HotspotZone[];
}

export const HotspotsMapModal: React.FC<HotspotsMapModalProps> = ({
  isOpen,
  onClose,
  hotspots
}) => {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotZone | null>(null);

  const minLat = hotspots.length > 0 ? Math.min(...hotspots.map(h => h.latitude)) - 0.005 : 32.72;
  const maxLat = hotspots.length > 0 ? Math.max(...hotspots.map(h => h.latitude)) + 0.005 : 32.74;
  const minLon = hotspots.length > 0 ? Math.min(...hotspots.map(h => h.longitude)) - 0.005 : 74.84;
  const maxLon = hotspots.length > 0 ? Math.max(...hotspots.map(h => h.longitude)) + 0.005 : 74.87;

  const latSpan = maxLat - minLat || 0.02;
  const lonSpan = maxLon - minLon || 0.03;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Spatial Security Hotspots Map & Density Analysis"
      subtitle="Geographic distribution of security events, behavioural anomalies, and activity spikes"
      maxWidth="4xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {/* Tactical Spatial Radar / Map Surface */}
        <div className="bg-[#0a0f1d] border border-[#1e293b] rounded-2xl p-4 relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>GEOSPATIAL TACTICAL DENSITY RADAR</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> HIGH
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" /> ELEVATED
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> WATCH
              </span>
            </div>
          </div>

          <div className="h-64 rounded-xl bg-[#070b14] border border-slate-800/80 relative overflow-hidden">
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />

            {/* Zero-Line Perimeter Reference Vector */}
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-rose-500/30 -translate-y-1/2 flex items-center justify-between px-3 text-[9px] text-rose-400/60">
              <span>ZERO-LINE BORDER PERIMETER REFERENCE</span>
              <span>PATROL CORRIDOR</span>
            </div>

            {/* Hotspot Geospatial Pins */}
            {hotspots.map((h, idx) => {
              const posX = Math.max(8, Math.min(92, ((h.longitude - minLon) / lonSpan) * 100));
              const posY = Math.max(12, Math.min(88, 100 - ((h.latitude - minLat) / latSpan) * 100));
              const isHigh = h.hotspot_level === 'HIGH';
              const isElevated = h.hotspot_level === 'ELEVATED';
              const isSelected = selectedHotspot?.zone_id === h.zone_id;

              return (
                <div
                  key={h.zone_id || idx}
                  onClick={() => setSelectedHotspot(h)}
                  style={{ left: `${posX}%`, top: `${posY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {isHigh && (
                    <div className="w-12 h-12 rounded-full bg-rose-500/30 blur-sm animate-ping absolute -inset-3" />
                  )}
                  {isElevated && (
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 blur-sm animate-pulse absolute -inset-2" />
                  )}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isSelected
                        ? 'bg-sky-400 border-white text-slate-950 scale-125 shadow-lg shadow-sky-400/50'
                        : isHigh
                        ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                        : isElevated
                        ? 'bg-orange-600 border-orange-400 text-white'
                        : 'bg-amber-600 border-amber-400 text-white'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                  </div>

                  {/* Tooltip on hover */}
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-slate-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-90 group-hover:opacity-100 transition">
                    <span className="font-bold">{h.name}</span> ({h.current_activity} events, Risk: {h.risk_score})
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hotspots Detailed Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hotspots.map((h) => {
            const isSelected = selectedHotspot?.zone_id === h.zone_id;
            return (
              <div
                key={h.zone_id}
                onClick={() => setSelectedHotspot(h)}
                className={`p-4 rounded-xl border space-y-3 cursor-pointer transition ${
                  isSelected
                    ? 'border-sky-500 bg-sky-950/30 shadow-lg shadow-sky-950'
                    : h.hotspot_level === 'HIGH'
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                    : h.hotspot_level === 'ELEVATED'
                    ? 'bg-orange-950/20 border-orange-500/40 hover:border-orange-400'
                    : 'bg-[#090d16] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-white text-xs">{h.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      h.hotspot_level === 'HIGH'
                        ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                        : h.hotspot_level === 'ELEVATED'
                        ? 'bg-orange-950 text-orange-300 border-orange-500/50'
                        : 'bg-amber-950 text-amber-300 border-amber-500/50'
                    }`}
                  >
                    {h.hotspot_level} DENSITY
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-[#090d16] p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block">CURRENT</span>
                    <span className="text-sm font-bold text-white">{h.current_activity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">BASELINE</span>
                    <span className="text-sm font-bold text-slate-400">{h.baseline_activity.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">RISK SCORE</span>
                    <span className="text-sm font-bold text-amber-400">{h.risk_score}/100</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Contributing Activity:</span>
                  <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                    {h.contributing_factors.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Coordinates: {h.latitude.toFixed(4)}°N, {h.longitude.toFixed(4)}°E</span>
                  <span className="text-sky-400 font-bold">{h.camera_id}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-lg cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </Modal>
  );
};
