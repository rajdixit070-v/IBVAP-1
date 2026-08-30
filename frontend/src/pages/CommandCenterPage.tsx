import React, { useState, useEffect } from 'react';
import { Alert, Incident } from '../types/incident';
import { Camera } from '../types/camera';
import { useCameras } from '../context/CameraContext';
import { incidentService } from '../services/incidentService';
import { LiveVideoPlayer } from '../components/cameras/LiveVideoPlayer';
import { CreateIncidentModal } from '../components/incidents/CreateIncidentModal';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { SituationalMapModal } from '../components/incidents/SituationalMapModal';
import {
  ShieldAlert,
  Radio,
  MapPin,
  Flame,
  Plus,
  RefreshCw,
  BellRing,
  Trash2
} from 'lucide-react';

export const CommandCenterPage: React.FC = () => {
  const { cameras } = useCameras();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sourceAlertForIncident, setSourceAlertForIncident] = useState<Alert | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  useEffect(() => {
    loadSOCData();
    const interval = setInterval(loadSOCData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0]);
    }
  }, [cameras, selectedCamera]);

  const loadSOCData = async () => {
    try {
      const [alertsData, incidentsData] = await Promise.all([
        incidentService.getAlerts({ limit: 50 }),
        incidentService.getIncidents({ limit: 50 })
      ]);
      setAlerts(alertsData);
      setIncidents(incidentsData);
    } catch (e) {
      console.error('Failed to load SOC Command Center data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await incidentService.acknowledgeAlert(alertId, 'operator');
      loadSOCData();
    } catch (e) {
      console.error('Failed to acknowledge alert', e);
    }
  };

  const handleDeleteAlert = async (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    try {
      await incidentService.deleteAlert(alertId);
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
    } catch (e) {
      console.error('Failed to delete alert', e);
    }
  };

  const handleClearAllAlerts = async () => {
    try {
      await incidentService.clearAllAlerts();
      setAlerts([]);
    } catch (e) {
      console.error('Failed to clear all alerts', e);
    }
  };

  const handleOpenCreateIncident = (alert?: Alert) => {
    setSourceAlertForIncident(alert || null);
    setCreateModalOpen(true);
  };

  const handleOpenIncidentDetail = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setDetailModalOpen(true);
  };

  const activeIncidents = incidents.filter(
    (i: Incident) => i.status !== 'CLOSED' && i.status !== 'FALSE_ALARM'
  );
  const criticalAlerts = alerts.filter((a: Alert) => a.priority === 'CRITICAL' && a.status === 'NEW');

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c131d] via-[#0f172a] to-[#0d131f] border border-[#3b1928] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              SOC COMMAND CENTER & INCIDENT WORKFLOW
            </span>
            <span className="text-slate-400 font-mono text-xs">• DECISION-SUPPORT MATRIX</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Security Operations Center (SOC) Command Console
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Real-time alert deduplication, server-driven SLA escalation timers, controlled incident lifecycle state machines, and SHA-256 evidence integrity chains.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMapModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <MapPin className="w-4 h-4 text-sky-400" />
            SITUATIONAL MAP
          </button>
          <button
            onClick={() => handleOpenCreateIncident()}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            CREATE INCIDENT
          </button>
        </div>
      </div>

      {/* Critical Alert Flash Beacon (If any critical alerts are active) */}
      {criticalAlerts.length > 0 && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/80 rounded-2xl flex items-center justify-between shadow-xl shadow-rose-950/40 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/60 flex items-center justify-center text-rose-400">
              <BellRing className="w-5 h-5 text-rose-400 animate-bounce" />
            </div>
            <div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <span>{criticalAlerts[0].title}</span>
                <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-black">
                  CRITICAL SLA
                </span>
              </div>
              <p className="text-xs text-rose-300">
                Acknowledge immediately to prevent automatic escalation to Sector Command.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAcknowledgeAlert(criticalAlerts[0].alert_id)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold transition"
            >
              ACKNOWLEDGE
            </button>
            <button
              onClick={() => handleOpenCreateIncident(criticalAlerts[0])}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold transition border border-slate-700"
            >
              CREATE INCIDENT
            </button>
          </div>
        </div>
      )}

      {/* SOC Main 2-Column Split: Live Feed & Video Wall vs Active Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Video Inspector & Alerts Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Camera View */}
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white uppercase">
                  Primary Surveillance Feed // {selectedCamera?.camera_id || 'SELECT CAMERA'}
                </span>
              </div>

              {/* Camera Selector */}
              <select
                value={selectedCamera?.camera_id || ''}
                onChange={(e) => {
                  const c = cameras.find((cam: Camera) => cam.camera_id === e.target.value);
                  if (c) setSelectedCamera(c);
                }}
                className="px-3 py-1 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {cameras.map((c: Camera) => (
                  <option key={c.camera_id} value={c.camera_id}>
                    {c.camera_id} ({c.camera_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedCamera ? (
              <div className="rounded-xl overflow-hidden shadow-inner">
                <LiveVideoPlayer camera={selectedCamera} showControls={true} />
              </div>
            ) : null}
          </div>

          {/* Real-time Alerts Feed */}
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-sky-400" />
                Live Real-Time Alert Stream ({alerts.length})
              </h3>
              <div className="flex items-center gap-2">
                {alerts.length > 0 && (
                  <button
                    onClick={handleClearAllAlerts}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition border border-transparent hover:border-rose-500/30"
                    title="Delete all alerts from stream"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-[11px] font-mono text-slate-500">Auto-Deduplicated Stream</span>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-500">No active alerts recorded.</div>
              ) : (
                alerts.slice(0, 10).map((a: Alert) => (
                  <div
                    key={a.alert_id}
                    className="p-3 bg-[#090d16] border border-[#1e293b] hover:border-slate-700 rounded-xl flex items-center justify-between transition gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            a.priority === 'CRITICAL'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                              : a.priority === 'HIGH'
                              ? 'bg-orange-950/80 text-orange-300 border-orange-500/40'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {a.priority}
                        </span>
                        <span className="text-xs font-bold text-white">{a.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(a.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Camera: <span className="text-sky-400">{a.camera_id}</span> • Risk Score:{' '}
                        <span className="text-amber-400 font-bold">{a.risk_score}</span> • Status:{' '}
                        <span className="text-slate-300">{a.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.status === 'NEW' && (
                        <button
                          onClick={() => handleAcknowledgeAlert(a.alert_id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono font-bold transition border border-slate-700"
                        >
                          ACK
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenCreateIncident(a)}
                        className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded text-[10px] font-mono font-bold transition"
                      >
                        INCIDENT
                      </button>
                      <button
                        onClick={(e) => handleDeleteAlert(e, a.alert_id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition border border-transparent hover:border-rose-500/30"
                        title="Delete alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Active Managed Incidents Triage */}
        <div className="space-y-4">
          <div className="bg-[#111a2e] border border-[#1e293b] rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                Active Managed Incidents ({activeIncidents.length})
              </h3>
              <button
                onClick={loadSOCData}
                className="p-1 text-slate-400 hover:text-white transition"
                title="Refresh Incidents"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {activeIncidents.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-500">
                  No active incidents under investigation.
                </div>
              ) : (
                activeIncidents.map((inc: Incident) => (
                  <div
                    key={inc.incident_id}
                    onClick={() => handleOpenIncidentDetail(inc.incident_id)}
                    className="p-3.5 bg-[#090d16] border border-[#1e293b] hover:border-sky-500/50 rounded-xl space-y-2 cursor-pointer transition shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">
                        {inc.title}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          inc.status === 'ESCALATED' || inc.priority === 'CRITICAL'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>{inc.camera_id} • {inc.bop_site}</span>
                      <span className="text-amber-400 font-bold">{inc.risk_score}/100</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-1.5">
                      <span>{inc.assigned_to || 'Unassigned'}</span>
                      <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateIncidentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        sourceAlert={sourceAlertForIncident}
        onSuccess={loadSOCData}
      />

      <IncidentDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        incidentId={selectedIncidentId}
        onUpdated={loadSOCData}
      />

      <SituationalMapModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        incidents={activeIncidents}
        onSelectIncident={(i: Incident) => handleOpenIncidentDetail(i.incident_id)}
      />
    </div>
  );
};
