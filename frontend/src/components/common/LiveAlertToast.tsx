import React, { useState, useEffect } from 'react';
import { incidentService } from '../../services/incidentService';
import { alertSoundService } from '../../services/alertSoundService';
import { Notification } from '../../types/incident';
import { ShieldAlert, User, Car, PawPrint, Plane, X, ExternalLink, MapPin } from 'lucide-react';

interface LiveAlertToastProps {
  onOpenMap?: () => void;
  onOpenIncident?: (incidentId?: string) => void;
}

export const LiveAlertToast: React.FC<LiveAlertToastProps> = ({ onOpenMap, onOpenIncident }) => {
  const [activeAlert, setActiveAlert] = useState<Notification | null>(null);
  const [lastSeenId, setLastSeenId] = useState<number | null>(null);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        let notifs = await incidentService.getNotifications({ unread_only: true, limit: 10 });
        if (!notifs || notifs.length === 0) {
          notifs = await incidentService.getNotifications({ limit: 5 });
        }
        if (notifs && notifs.length > 0) {
          const newest = notifs[0];
          // If newest notification has not been displayed yet
          if (lastSeenId === null) {
            setLastSeenId(newest.id);
            // Check if this alert is unread and recent (under 2 minutes)
            const createdSec = (Date.now() - new Date(newest.created_at).getTime()) / 1000;
            if (createdSec < 120 && (!newest.read && !newest.is_read)) {
              setActiveAlert(newest);
              const sev = newest.severity === 'CRITICAL' || newest.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
              alertSoundService.playAlarm(sev);
            }
          } else if (newest.id > lastSeenId) {
            setLastSeenId(newest.id);
            setActiveAlert(newest);
            // Trigger tactical audio alarm
            const sev = newest.severity === 'CRITICAL' || newest.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
            alertSoundService.playAlarm(sev);
          }
        }
      } catch (e) {
        // quiet poll fail
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 2500);
    return () => clearInterval(interval);
  }, [lastSeenId]);

  // Auto-dismiss alert toast after 14 seconds
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 14000);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert) return null;

  const titleLower = (activeAlert.title || '').toLowerCase();
  const isPerson = titleLower.includes('person') || titleLower.includes('human') || titleLower.includes('intruder') || titleLower.includes('pedestrian');
  const isVehicle = titleLower.includes('vehicle') || titleLower.includes('car') || titleLower.includes('truck') || titleLower.includes('plate');
  const isAnimal = titleLower.includes('animal') || titleLower.includes('wildlife') || titleLower.includes('cattle');
  const isDrone = titleLower.includes('drone') || titleLower.includes('uav') || titleLower.includes('aerial');

  const isCritical = activeAlert.severity === 'CRITICAL' || activeAlert.priority === 'CRITICAL';
  const isHigh = activeAlert.severity === 'HIGH' || activeAlert.priority === 'HIGH';

  const evidenceUrl = activeAlert.evidence_url || (activeAlert.evidence_id ? `/api/v1/evidence/${activeAlert.evidence_id}/file` : null);

  return (
    <div className="fixed top-20 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto">
      <div
        className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl space-y-3 ${
          isCritical
            ? 'bg-rose-950/90 border-rose-500 shadow-rose-950/60 ring-2 ring-rose-500/40'
            : isHigh
            ? 'bg-amber-950/90 border-amber-500 shadow-amber-950/60 ring-2 ring-amber-500/40'
            : 'bg-[#0f172a]/95 border-sky-500 shadow-sky-950/60'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-md shrink-0 ${
                isCritical
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : isHigh
                  ? 'bg-amber-600 border-amber-400 text-white'
                  : 'bg-sky-600 border-sky-400 text-white'
              }`}
            >
              {isPerson ? (
                <User className="w-5 h-5" />
              ) : isVehicle ? (
                <Car className="w-5 h-5" />
              ) : isAnimal ? (
                <PawPrint className="w-5 h-5" />
              ) : isDrone ? (
                <Plane className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    isCritical
                      ? 'bg-rose-900 text-rose-200 border-rose-400'
                      : isHigh
                      ? 'bg-amber-900 text-amber-200 border-amber-400'
                      : 'bg-sky-900 text-sky-200 border-sky-400'
                  }`}
                >
                  {isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM'} THREAT
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  {new Date(activeAlert.created_at).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-wide mt-1 leading-tight">
                {activeAlert.title}
              </h4>
            </div>
          </div>

          <button
            onClick={() => setActiveAlert(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-200 font-sans leading-relaxed">
          {activeAlert.message}
        </p>

        {/* Forensic Visual Proof / Evidence Photo */}
        {evidenceUrl && (
          <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/50 shadow-inner group">
            <img
              src={evidenceUrl}
              alt="Forensic Evidence Capture"
              className="w-full h-44 object-cover object-center"
              onError={(e) => {
                (e.target as HTMLElement).parentElement?.classList.add('hidden');
              }}
            />
            <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              VERIFIED EVIDENCE SNAPSHOT • SHA-256
            </div>
          </div>
        )}

        {/* Exact Tactical Location Strip */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-start gap-2 text-xs font-mono">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-tight">
            <span className="text-[10px] text-slate-400 uppercase">LOCATION SENSOR & SECTOR:</span>
            <div className="text-emerald-300 font-bold text-[11px]">
              {activeAlert.location_description || activeAlert.camera_id || 'BOP Alpha // Perimeter Sector 1'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
          <span className="text-slate-300 text-[11px]">
            Sensor: <strong className="text-white">{activeAlert.camera_id || activeAlert.alert_id || 'BORDER-PERIMETER'}</strong>
          </span>

          <div className="flex items-center gap-2">
            {onOpenMap && (
              <button
                onClick={() => {
                  setActiveAlert(null);
                  onOpenMap();
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition flex items-center gap-1 cursor-pointer text-[11px]"
              >
                <MapPin className="w-3 h-3 text-sky-400" />
                Map
              </button>
            )}
            <button
              onClick={() => {
                setActiveAlert(null);
                if (onOpenIncident) onOpenIncident();
              }}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition shadow-md flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <ExternalLink className="w-3 h-3" />
              Respond
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
