import React, { useState, useEffect } from 'react';
import { PersonWatchlist, FaceEvent, FaceAnalyticsSummary } from '../types/face';
import { faceService } from '../services/faceService';
import { incidentService } from '../services/incidentService';
import { alertSoundService } from '../services/alertSoundService';
import { useAuth } from '../context/AuthContext';
import { PersonWatchlistModal } from '../components/face/PersonWatchlistModal';
import { DispatchSitrepModal } from '../components/dispatches/DispatchSitrepModal';
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
  Send,
  UserX,
  CheckCircle2
} from 'lucide-react';

export const FaceIntelligencePage: React.FC = () => {
  const { user } = useAuth();
  const userBop = user?.scope_id || '';

  const [events, setEvents] = useState<FaceEvent[]>([]);
  const [persons, setPersons] = useState<PersonWatchlist[]>([]);
  const [summary, setSummary] = useState<FaceAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected Suspect Candidate for Active Intercept Focus
  const [selectedEvent, setSelectedEvent] = useState<FaceEvent | null>(null);
  const [interceptSuccessNotice, setInterceptSuccessNotice] = useState<string | null>(null);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<'events' | 'database'>('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState<PersonWatchlist | null>(null);

  // SITREP Dispatch Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState('FLASH_CRITICAL');

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

      // Auto-focus latest potential match if available and not yet set
      if (!selectedEvent && eventsData.length > 0) {
        const potential = eventsData.find(e => e.match_status === 'WATCHLIST_POTENTIAL_MATCH');
        if (potential) setSelectedEvent(potential);
        else setSelectedEvent(eventsData[0]);
      }
    } catch (e) {
      console.error('Failed to load face intelligence data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEvent = async (eventId: string, status: 'VERIFIED' | 'DISMISSED') => {
    try {
      await faceService.verifyMatch(eventId, status, `Commander marked as ${status}`);
      loadData();
    } catch (e) {
      console.error('Failed to verify match', e);
    }
  };

  // 1-Click Sentry Intercept & Detain Action: Mobilizes Sentries & Logs Incident
  const handleOrderIntercept = async (evt: FaceEvent) => {
    try {
      alertSoundService.playAlarm('CRITICAL');
      alertSoundService.speakVoiceAlert(`Biometric match alert. Commander ordered immediate sentry interception for ${evt.matched_person_name || 'suspect'}.`);

      // Create official security incident in backend
      await incidentService.createIncident({
        title: `🛑 SENTRY INTERCEPT: Watchlist Subject ${evt.matched_person_name || evt.matched_person_id || 'UNKNOWN'}`,
        description: `Ground commander initiated sentry interception at ${userBop || 'Checkpost'}. Subject matched with ${Math.round((evt.similarity_score || 0.85) * 100)}% biometric similarity on camera ${evt.camera_id}.`,
        priority: 'CRITICAL',
        incident_type: 'SECURITY',
        camera_id: evt.camera_id,
        bop_site: userBop || 'BOP-WAGAH',
        risk_score: Math.round((evt.similarity_score || 0.9) * 100)
      });

      // Verify the event in DB
      await faceService.verifyMatch(evt.event_id, 'VERIFIED', 'Commander initiated sentry detention protocol.');

      setInterceptSuccessNotice(`Armed Sentry Squad Mobilized! Intercept incident logged for ${evt.matched_person_name || 'Subject'}.`);
      setTimeout(() => setInterceptSuccessNotice(null), 6000);
      loadData();
    } catch (e) {
      console.error('Failed to execute sentry intercept', e);
    }
  };

  const handleDispatchFaceAlert = (evt?: FaceEvent) => {
    const target = evt || selectedEvent;
    const name = target?.matched_person_name || target?.matched_person_id || 'SUSPECT CANDIDATE';
    const similarity = Math.round((target?.similarity_score || 0.85) * 100);
    const postName = userBop || 'CHECKPOST SENTRY GATE';

    setDispatchTitle(`🚨 BIOMETRIC WATCHLIST HIT: ${name} (${postName})`);
    setDispatchSummary(
      `Biometric surveillance matched subject '${name}' at ${postName} pedestrian gate. Similarity confidence: ${similarity}%. Camera: ${target?.camera_id || 'GATE-CAM'}. Commander issued sentry containment orders.`
    );
    setDispatchPriority('FLASH_CRITICAL');
    setDispatchModalOpen(true);
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#1c132b] via-[#0f172a] to-[#0d131f] border border-[#3b1940] rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30">
              PEDESTRIAN & BIOMETRIC GATE
            </span>
            <span className="text-slate-400 font-mono text-xs">
              • {userBop || 'CHECKPOST SECTOR'} • SENTRY TURNSTILE SCREENING
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Pedestrian Watchlist Screening & Biometric Gate
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Real-time biometric facial recognition at checkpost pedestrian gates and sentry turnstiles. Screen passing individuals against national wanted watchlists, order sentry intercepts, and transmit high-priority alerts to Delhi Central HQ.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => handleDispatchFaceAlert()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-600/20 cursor-pointer"
            title="Transmit biometric watchlist hit directly to Delhi Central HQ"
          >
            <Send className="w-3.5 h-3.5" />
            DISPATCH ALERT TO HQ
          </button>

          <button
            onClick={() => {
              setPersonToEdit(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-purple-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            REGISTER IDENTITY
          </button>
        </div>
      </div>

      {/* Intercept Success Banner */}
      {interceptSuccessNotice && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-emerald-300 font-mono text-xs shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold">{interceptSuccessNotice}</span>
          </div>
          <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/40">
            INCIDENT CREATED
          </span>
        </div>
      )}

      {/* Prominent Wanted Subject Intercept Console (If Watchlist Candidate Selected) */}
      {selectedEvent && (
        <div className={`rounded-2xl p-5 border shadow-2xl transition-all ${
          selectedEvent.match_status === 'WATCHLIST_POTENTIAL_MATCH'
            ? 'bg-gradient-to-r from-[#2b1016] via-[#1a0f1d] to-[#0f172a] border-rose-500/60'
            : 'bg-[#111a2e] border-slate-700'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Subject Profile & Visuals */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-slate-900 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shrink-0 overflow-hidden shadow-lg">
                <Fingerprint className="w-8 h-8 text-rose-400" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase">GATE SCREENING TARGET:</span>
                  <h2 className="text-lg font-black text-white tracking-wide">
                    {selectedEvent.matched_person_name || 'UNMATCHED SUBJECT'}
                  </h2>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                    selectedEvent.match_status === 'WATCHLIST_POTENTIAL_MATCH'
                      ? 'bg-rose-950/90 text-rose-300 border-rose-500/60 animate-pulse'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {selectedEvent.match_status === 'WATCHLIST_POTENTIAL_MATCH' ? '⚠️ WATCHLIST MATCH' : selectedEvent.match_status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                  <span>Person ID: <strong className="text-sky-300">{selectedEvent.matched_person_id || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Similarity: <strong className="text-rose-400 font-bold">{Math.round((selectedEvent.similarity_score || 0) * 100)}%</strong></span>
                  <span>•</span>
                  <span>Camera: <strong className="text-slate-200">{selectedEvent.camera_id}</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-amber-300">{selectedEvent.verification_status}</strong></span>
                </div>
              </div>
            </div>

            {/* Tactical Ground Commands */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => handleOrderIntercept(selectedEvent)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold tracking-wider transition shadow-lg shadow-rose-600/30 cursor-pointer"
                title="Mobilize checkpost sentries immediately to detain this individual"
              >
                <UserX className="w-4 h-4" />
                <span>ORDER SENTRY INTERCEPT & DETAIN</span>
              </button>

              <button
                onClick={() => handleVerifyEvent(selectedEvent.event_id, 'VERIFIED')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                title="Mark identity as verified"
              >
                <UserCheck className="w-4 h-4" />
                <span>CONFIRM MATCH</span>
              </button>

              <button
                onClick={() => handleVerifyEvent(selectedEvent.event_id, 'DISMISSED')}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-mono font-bold border border-slate-700 transition cursor-pointer"
                title="Dismiss as false positive"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">TOTAL SCANNED</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {summary?.total_faces ?? events.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Fingerprint className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-rose-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 font-bold">WATCHLIST HITS</span>
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
            <span className="text-[11px] font-mono text-emerald-400 font-bold">AUTHORIZED POST STAFF</span>
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
            <span className="text-[11px] font-mono text-slate-400 font-bold">UNCLASSIFIED</span>
            <div className="text-2xl font-mono font-black text-slate-300">
              {summary?.unknown_faces ?? 0}
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
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              activeTab === 'events'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'bg-[#111a2e] text-slate-400 hover:text-white border border-[#1e293b]'
            }`}
          >
            PEDESTRIAN RECOGNITION LOG ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
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
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
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
                  <th className="px-4 py-3">SENTRY CAMERA</th>
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
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`hover:bg-slate-800/40 transition cursor-pointer ${
                        selectedEvent?.id === evt.id ? 'bg-purple-950/30' : ''
                      }`}
                    >
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
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOrderIntercept(evt)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Order sentry intercept"
                          >
                            <UserX className="w-3 h-3" />
                            Intercept
                          </button>
                          <button
                            onClick={() => handleDispatchFaceAlert(evt)}
                            className="p-1 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded transition border border-transparent hover:border-purple-500/30 cursor-pointer"
                            title="Dispatch alert to Delhi HQ"
                          >
                            <Send className="w-3.5 h-3.5" />
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
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          {p.photo_ref ? (
                            <img src={p.photo_ref} alt={p.display_name} className="w-8 h-8 rounded-lg object-cover border border-purple-500/40 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                              <Fingerprint className="w-4 h-4" />
                            </div>
                          )}
                          <span>{p.display_name}</span>
                        </div>
                      </td>

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
                            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition cursor-pointer"
                            title="Edit Identity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePerson(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
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

      {/* Identity Registration Modal */}
      <PersonWatchlistModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        personToEdit={personToEdit}
        onSuccess={loadData}
      />

      {/* SITREP Face Watchlist Hit Dispatch Modal */}
      <DispatchSitrepModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={() => setDispatchModalOpen(false)}
        initialTitle={dispatchTitle}
        initialSummary={dispatchSummary}
        initialPriority={dispatchPriority}
      />
    </div>
  );
};
