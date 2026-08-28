import React from 'react';
import { Modal } from '../common/Modal';
import { HotspotZone } from '../../types/predictive';
import { MapPin } from 'lucide-react';

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Spatial Security Hotspots Map & Density Analysis"
      subtitle="Geographic distribution of security events, behavioural anomalies, and activity spikes"
      maxWidth="3xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {/* Hotspots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hotspots.map((h) => (
            <div
              key={h.zone_id}
              className={`p-4 rounded-xl border space-y-3 ${
                h.hotspot_level === 'HIGH'
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : h.hotspot_level === 'ELEVATED'
                  ? 'bg-orange-950/20 border-orange-500/40'
                  : h.hotspot_level === 'WATCH'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-[#090d16] border-slate-800'
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
                      : h.hotspot_level === 'WATCH'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
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
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-lg"
          >
            CLOSE
          </button>
        </div>
      </div>
    </Modal>
  );
};
