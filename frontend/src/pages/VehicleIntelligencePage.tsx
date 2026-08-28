import React, { useState, useEffect } from 'react';
import { VehicleWatchlist, ANPREvent, ANPRSummary } from '../types/anpr';
import { anprService } from '../services/anprService';
import { VehicleWatchlistModal } from '../components/anpr/VehicleWatchlistModal';
import {
  Car,
  ShieldAlert,
  CheckCircle2,
  Eye,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2
} from 'lucide-react';

export const VehicleIntelligencePage: React.FC = () => {
  const [events, setEvents] = useState<ANPREvent[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWatchlist[]>([]);
  const [summary, setSummary] = useState<ANPRSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchPlate, setSearchPlate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'events' | 'database'>('events');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<VehicleWatchlist | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedStatus, searchPlate]);

  const loadData = async () => {
    try {
      const [eventsData, summaryData, vehiclesData] = await Promise.all([
        anprService.getEvents({
          match_status: selectedStatus || undefined,
          plate: searchPlate || undefined,
          limit: 100
        }),
        anprService.getSummary(),
        anprService.getVehicles({
          status: selectedStatus || undefined,
          search: searchPlate || undefined
        })
      ]);
      setEvents(eventsData);
      setSummary(summaryData);
      setVehicles(vehiclesData);
    } catch (e) {
      console.error('Failed to load ANPR intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (window.confirm('Are you sure you want to remove this vehicle from the database?')) {
      try {
        await anprService.deleteVehicle(id);
        loadData();
      } catch (e) {
        console.error('Failed to delete vehicle', e);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1c1a13] via-[#0f172a] to-[#0d131f] border border-[#3b3419] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
              OPTICAL VEHICLE INTELLIGENCE & ANPR
            </span>
            <span className="text-slate-400 font-mono text-xs">• AUTOMATIC NUMBER PLATE RECOGNITION</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Automated License Plate Recognition & Vehicle Watchlist
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Multi-frame temporal OCR consensus engine. Automated plate normalization, quality filtering, and real-time matching against border security vehicle watchlists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setVehicleToEdit(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-amber-600/20"
          >
            <Plus className="w-4 h-4" />
            REGISTER VEHICLE
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 font-bold">TOTAL READS</span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {summary?.total_reads ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">WATCHLIST MATCHES</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {summary?.watchlist_matches ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">AUTHORIZED FLEET</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {summary?.authorized_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-slate-700 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 font-bold">UNVERIFIED PLATES</span>
            <div className="text-2xl font-mono font-black text-slate-300">
              {summary?.unknown_count ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Eye className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Subtabs & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'events'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            LIVE ANPR EVENT LOG ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'database'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            VEHICLE WATCHLIST REGISTRY ({vehicles.length})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search plate (e.g. UP32AB1234)..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
          >
            <option value="">All Statuses</option>
            <option value="WATCHLIST">⚠️ Watchlist</option>
            <option value="AUTHORIZED">✅ Authorized</option>
            <option value="MONITOR">👁️ Monitor</option>
            <option value="UNKNOWN">❓ Unknown</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh ANPR Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Table */}
      {activeTab === 'events' ? (
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
                <tr>
                  <th className="px-4 py-3">PLATE NUMBER</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">CAMERA & TARGET</th>
                  <th className="px-4 py-3">CONFIDENCE</th>
                  <th className="px-4 py-3">OBSERVATIONS</th>
                  <th className="px-4 py-3">TIME</th>
                  <th className="px-4 py-3">OWNER / NOTES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No ANPR recognition events found matching criteria.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <span className="font-bold text-white text-sm bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                          {evt.normalized_plate}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evt.match_status === 'WATCHLIST_MATCH' || evt.match_status === 'WATCHLIST'
                              ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                              : evt.match_status === 'AUTHORIZED'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                              : evt.match_status === 'MONITOR'
                              ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {evt.match_status === 'WATCHLIST_MATCH' || evt.match_status === 'WATCHLIST'
                            ? '⚠️ WATCHLIST MATCH'
                            : evt.match_status === 'AUTHORIZED'
                            ? '✅ AUTHORIZED'
                            : evt.match_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-400 font-bold">{evt.camera_id}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 uppercase">#{evt.track_id} ({evt.vehicle_type})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-400 font-bold">{Math.round(evt.confidence * 100)}%</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {evt.observations_count} frames consensus
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                        {evt.matched_owner ? (
                          <span className="text-slate-200 font-semibold">{evt.matched_owner}</span>
                        ) : evt.watchlist_notes ? (
                          <span>{evt.watchlist_notes}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#111a2e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#142038] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
                <tr>
                  <th className="px-4 py-3">PLATE NUMBER</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">TYPE</th>
                  <th className="px-4 py-3">CATEGORY</th>
                  <th className="px-4 py-3">OWNER / ORGANIZATION</th>
                  <th className="px-4 py-3">NOTES</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No vehicles registered in database.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <span className="font-bold text-white bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                          {v.normalized_plate_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            v.status === 'WATCHLIST'
                              ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                              : v.status === 'AUTHORIZED'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                              : v.status === 'MONITOR'
                              ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 uppercase text-slate-300">{v.vehicle_type}</td>
                      <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{v.watchlist_category}</td>
                      <td className="px-4 py-3 text-slate-300 font-semibold">{v.owner_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{v.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setVehicleToEdit(v);
                              setModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                            title="Edit Vehicle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                            title="Delete Vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <VehicleWatchlistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        vehicleToEdit={vehicleToEdit}
        onSuccess={loadData}
      />
    </div>
  );
};
