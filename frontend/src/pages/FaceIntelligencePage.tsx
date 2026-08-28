import React, { useState, useEffect } from 'react';
import { PersonWatchlist, FaceEvent, FaceAnalyticsSummary } from '../types/face';
import { faceService } from '../services/faceService';
import { PersonWatchlistModal } from '../components/face/PersonWatchlistModal';
import {
  UserCheck,
  ShieldAlert,
  Eye,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Fingerprint,
  AlertCircle
} from 'lucide-react';

export const FaceIntelligencePage: React.FC = () => {
  const [events, setEvents] = useState<FaceEvent[]>([]);
  const [persons, setPersons] = useState<PersonWatchlist[]>([]);
  const [summary, setSummary] = useState<FaceAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<'events' | 'database'>('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState<PersonWatchlist | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedStatus, searchQuery]);

  const loadData = async () => {
    try {
      const [eventsData, summaryData, personsData] = await Promise.all([
        faceService.getEvents({
          match_status: selectedStatus || undefined,
          limit: 100
        }),
        faceService.getSummary(),
        faceService.getPersons({
          category: selectedStatus || undefined,
          search: searchQuery || undefined
        })
      ]);
      setEvents(eventsData);
      setSummary(summaryData);
      setPersons(personsData);
    } catch (e) {
      console.error('Failed to load face intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEvent = async (eventId: string, status: 'VERIFIED' | 'DISMISSED') => {
    try {
      await faceService.verifyMatch(eventId, status, `Operator marked as ${status}`);
      loadData();
    } catch (e) {
      console.error('Failed to verify match', e);
    }
  };

  const handleDeletePerson = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this identity record?')) {
      try {
        await faceService.deletePerson(id);
        loadData();
      } catch (e) {
        console.error('Failed to delete person', e);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c132b] via-[#0f172a] to-[#0d131f] border border-[#3b1940] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30">
              BIOMETRIC IDENTITY & WATCHLIST MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs">• 128-D EMBEDDINGS & HUMAN VERIFICATION</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Facial Quality Gate & Watchlist Intelligence
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Multi-frame best-sample face quality evaluator. Compares 128-d L2 normalized embeddings with authorized personnel and watchlist databases. Human verification is strictly required for identity matches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setPersonToEdit(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" />
            REGISTER IDENTITY
          </button>
        </div>
      </div>

      {/* Summary Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">TOTAL FACES</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {summary?.total_faces ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Fingerprint className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">POTENTIAL MATCHES</span>
            <div className="text-2xl font-mono font-black text-rose-400">
              {summary?.potential_matches ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">AUTHORIZED PERSONNEL</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {summary?.authorized_faces ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-slate-700 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 font-bold">UNKNOWN / UNCLASSIFIED</span>
            <div className="text-2xl font-mono font-black text-slate-300">
              {summary?.unknown_faces ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Eye className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Legal & Ethical Disclaimer Notice */}
      <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong>Operational Safeguard:</strong> Biometric facial recognition matches are flagged as potential candidates. Positive human operator verification is required before initiating field response or access denial.
        </p>
      </div>

      {/* Navigation Subtabs & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'events'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            FACIAL RECOGNITION EVENTS ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'database'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            PERSONNEL & WATCHLIST DIRECTORY ({persons.length})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search identity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
          >
            <option value="">All Categories</option>
            <option value="WATCHLIST">⚠️ Watchlist</option>
            <option value="AUTHORIZED">✅ Authorized</option>
            <option value="MONITOR">👁️ Monitor</option>
            <option value="RESTRICTED">🛑 Restricted</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Face Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
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
                  <th className="px-4 py-3">MATCH STATUS</th>
                  <th className="px-4 py-3">CANDIDATE IDENTITY</th>
                  <th className="px-4 py-3">CAMERA & TARGET</th>
                  <th className="px-4 py-3">SIMILARITY</th>
                  <th className="px-4 py-3">QUALITY</th>
                  <th className="px-4 py-3">VERIFICATION</th>
                  <th className="px-4 py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No facial recognition events recorded.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evt.match_status === 'WATCHLIST_POTENTIAL_MATCH'
                              ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                              : evt.match_status === 'AUTHORIZED_MATCH'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                              : evt.match_status === 'MONITOR'
                              ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {evt.match_status === 'WATCHLIST_POTENTIAL_MATCH'
                            ? '⚠️ POTENTIAL MATCH'
                            : evt.match_status === 'AUTHORIZED_MATCH'
                            ? '✅ AUTHORIZED'
                            : evt.match_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {evt.matched_person_name ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-white text-xs">{evt.matched_person_name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{evt.matched_person_id}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Unmatched Subject</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sky-400 font-bold">{evt.camera_id}</span> • #{evt.track_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-purple-400 font-bold">{Math.round(evt.similarity_score * 100)}%</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {Math.round(evt.quality_score * 100)}% Quality
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evt.verification_status === 'VERIFIED'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                              : evt.verification_status === 'DISMISSED'
                              ? 'bg-slate-900 text-slate-400 border-slate-700'
                              : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {evt.verification_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {evt.verification_status === 'PENDING' && evt.match_status === 'WATCHLIST_POTENTIAL_MATCH' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleVerifyEvent(evt.event_id, 'VERIFIED')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerifyEvent(evt.event_id, 'DISMISSED')}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition"
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
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
                  <th className="px-4 py-3">PERSON ID</th>
                  <th className="px-4 py-3">FULL NAME / CALLSIGN</th>
                  <th className="px-4 py-3">CATEGORY</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">PROFILE NOTES</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {persons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No identities registered in database.
                    </td>
                  </tr>
                ) : (
                  persons.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <span className="font-bold text-white bg-slate-900 px-2 py-1 rounded border border-slate-700">
                          {p.person_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{p.display_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            p.category === 'WATCHLIST'
                              ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                              : p.category === 'AUTHORIZED'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{p.status}</td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{p.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setPersonToEdit(p);
                              setModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
                            title="Edit Identity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePerson(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                            title="Delete Identity"
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
      <PersonWatchlistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        personToEdit={personToEdit}
        onSuccess={loadData}
      />
    </div>
  );
};
