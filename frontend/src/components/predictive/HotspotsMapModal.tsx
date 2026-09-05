import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { HotspotZone } from '../../types/predictive';
import { MapPin, Layers } from 'lucide-react';
import { TacticalLeafletMap } from '../common/TacticalLeafletMap';


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

          <div className="rounded-xl overflow-hidden border border-slate-800/80">
            <TacticalLeafletMap
              cameras={hotspots.map(h => ({
                camera_id: h.zone_id,
                camera_name: `${h.name} (${h.hotspot_level})`,
                latitude: h.latitude,
                longitude: h.longitude,
                status: h.hotspot_level === 'HIGH' ? 'OFFLINE' : 'ONLINE',
                bop_site: `Risk ${h.risk_score}`,
                sector: 'Hotspot Zone'
              })) as any}
              center={[
                hotspots.length > 0 ? hotspots[0].latitude : 31.6245,
                hotspots.length > 0 ? hotspots[0].longitude : 74.8725
              ]}
              height="320px"
              zoom={13}
            />
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
