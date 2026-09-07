import React, { useState, useEffect } from 'react';
import {
  Globe,
  Building2,
  Shield,
  Cctv,
  AlertTriangle,
  Flame,
  HeartPulse,
  Search,
  Plus,
  Layers,
  MapPin,
  RefreshCw,
  FileText,
  Download,
  UserCheck,
  Trash2,
  Activity,
  Sliders,
  ArrowLeft
} from 'lucide-react';
import { federationService } from '../services/federationService';
import {
  GlobalOverview,
  Site,
  BOP,
  SiteOverview,
  BOPOverview,
  SiteHealthMatrixRow,
  BOPHealthMatrixRow,
  FederatedMapData,
  GlobalSearchResult,
  UserScope,
  MultiSiteReport
} from '../types/federation';
import { SiteModal } from '../components/federation/SiteModal';
import { BOPModal } from '../components/federation/BOPModal';
import { UserScopeModal } from '../components/federation/UserScopeModal';
import { TacticalLeafletMap } from '../components/common/TacticalLeafletMap';

interface MultiSiteCommandPageProps {
  onBackToDashboard?: () => void;
}

export const MultiSiteCommandPage: React.FC<MultiSiteCommandPageProps> = ({ onBackToDashboard }) => {

  const [activeSubTab, setActiveSubTab] = useState<'map' | 'directory' | 'bop-wall' | 'matrix' | 'search' | 'reports' | 'admin'>('map');
  const [overview, setOverview] = useState<GlobalOverview | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [bops, setBops] = useState<BOP[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedBopId, setSelectedBopId] = useState<string>('');
  
  // Drill-down data
  const [siteOverview, setSiteOverview] = useState<SiteOverview | null>(null);
  const [bopOverview, setBopOverview] = useState<BOPOverview | null>(null);
  const [bopCameras, setBopCameras] = useState<any[]>([]);

  // Matrices & Map
  const [siteMatrix, setSiteMatrix] = useState<SiteHealthMatrixRow[]>([]);
  const [bopMatrix, setBopMatrix] = useState<BOPHealthMatrixRow[]>([]);
  const [mapData, setMapData] = useState<FederatedMapData | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);

  // User Scopes & Reports
  const [userScopes, setUserScopes] = useState<UserScope[]>([]);
  const [report, setReport] = useState<MultiSiteReport | null>(null);

  // Modals
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isBopModalOpen, setIsBopModalOpen] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);
  const [bopToEdit, setBopToEdit] = useState<BOP | null>(null);

  // Load initial global data
  const loadGlobalData = async () => {
    try {
      const [ov, sList, bList, sMat, bMat, mData, scopes] = await Promise.all([
        federationService.getGlobalOverview(),
        federationService.listSites(),
        federationService.listBOPs(),
        federationService.getSiteHealthMatrix(),
        federationService.getBOPHealthMatrix(),
        federationService.getFederatedMapData(),
        federationService.listUserScopes().catch(() => [])
      ]);
      setOverview(ov);
      setSites(sList);
      setBops(bList);
      setSiteMatrix(sMat);
      setBopMatrix(bMat);
      setMapData(mData);
      setUserScopes(scopes);

      if (bList.length > 0 && !selectedBopId) {
        setSelectedBopId(bList[0].bop_id);
      }
    } catch (err) {
      console.error('Failed to load global federation data:', err);
    }
  };

  useEffect(() => {
    loadGlobalData();
  }, []);

  // Load Site drill-down when selectedSiteId changes
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== 'ALL') {
      federationService.getSiteOverview(selectedSiteId)
        .then(setSiteOverview)
        .catch(console.error);
    } else {
      setSiteOverview(null);
    }
  }, [selectedSiteId]);

  // Load BOP drill-down when selectedBopId changes
  useEffect(() => {
    if (selectedBopId) {
      Promise.all([
        federationService.getBOPOverview(selectedBopId),
        federationService.getBOPCameras(selectedBopId)
      ]).then(([ov, cams]) => {
        setBopOverview(ov);
        setBopCameras(cams);
      }).catch(console.error);
    }
  }, [selectedBopId]);

  // Load report when reports tab is opened
  useEffect(() => {
    if (activeSubTab === 'reports') {
      federationService.getMultiSiteReport(selectedSiteId === 'ALL' ? 'ALL' : 'SITE', selectedSiteId === 'ALL' ? undefined : selectedSiteId)
        .then(setReport)
        .catch(console.error);
    }
  }, [activeSubTab, selectedSiteId]);

  // Handle global search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    try {
      const res = await federationService.globalSearch(searchQuery.trim());
      setSearchResults(res.results);
      setActiveSubTab('search');
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleExportCSV = () => {
    if (!siteMatrix.length) return;
    const headers = 'Site ID,Site Name,Status,BOPs,Total Cameras,Online,Offline,Active Incidents,Risk Score,Health Score\n';
    const rows = siteMatrix.map(s => 
      `"${s.site_id}","${s.site_name}","${s.status}",${s.bops_count},${s.total_cameras},${s.online_cameras},${s.offline_cameras},${s.active_incidents},${s.current_risk},${s.health_score}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IBVAP_Federation_Report_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070b14] text-slate-100 p-6 space-y-6">
      {/* Top Header & Federation Scope Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1322] border border-[#1e293b] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Globe className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white uppercase">
                IBVAP Central Command Federation
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md">
                FEDERATION COMMAND
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Multi-BOP Centralized Command, Scoped RBAC, & Hierarchical Intelligence
            </p>
          </div>
        </div>

        {/* Action Controls & Scope Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative flex-1 lg:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sites, BOPs, cams..."
              className="w-full bg-[#111a2e] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </form>

          {/* Scope Selector */}
          <div className="flex items-center gap-2 bg-[#111a2e] border border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Scope:</span>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-sky-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0f172a] text-slate-200">Global (All Sites)</option>
              {sites.map(s => (
                <option key={s.site_id} value={s.site_id} className="bg-[#0f172a] text-slate-200">
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition border border-slate-700 cursor-pointer"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>DASHBOARD</span>
            </button>
          )}

          <button
            onClick={loadGlobalData}
            title="Refresh Metrics"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setSiteToEdit(null); setIsSiteModalOpen(true); }}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Provision Site
          </button>

          <button
            onClick={() => { setBopToEdit(null); setIsBopModalOpen(true); }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Provision BOP
          </button>
        </div>
      </div>

      {/* Top Federation Summary Metrics Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Sites</span>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{overview.total_sites}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-1">{overview.active_sites} Active Sites</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Border Outposts</span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{overview.total_bops}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Multi-BOP Hierarchy</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Cameras</span>
              <Cctv className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">{overview.total_cameras}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-1">
              {overview.online_cameras} Online • {overview.offline_cameras} Offline
            </div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Active Incidents</span>
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-400">{overview.active_incidents}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Tactical Playbooks</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Critical Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-400">{overview.critical_alerts}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">Requires Ack</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Fleet Health</span>
              <HeartPulse className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {overview.overall_health_score}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">{overview.overall_health_status}</div>
          </div>

          <div className="bg-[#0d1322] border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-mono uppercase">Warnings</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-400">
              {overview.forecast_warnings_count}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">{overview.high_risk_bops_count} High-Risk BOPs</div>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('map')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'map'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-4 h-4" /> Federated Map
        </button>

        <button
          onClick={() => setActiveSubTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'directory'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Building2 className="w-4 h-4" /> Site Directory & Hierarchy
        </button>

        <button
          onClick={() => setActiveSubTab('bop-wall')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'bop-wall'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Cctv className="w-4 h-4" /> BOP Grid & Camera Wall
        </button>

        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'matrix'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" /> Health & Risk Matrix
        </button>

        <button
          onClick={() => setActiveSubTab('search')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'search'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Search className="w-4 h-4" /> Global Search
        </button>

        <button
          onClick={() => setActiveSubTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'reports'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" /> Reports & Exports
        </button>

        <button
          onClick={() => setActiveSubTab('admin')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 transition whitespace-nowrap ${
            activeSubTab === 'admin'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-4 h-4" /> Administration & RBAC
        </button>
      </div>

      {/* SUBTAB 1: FEDERATED MAP */}
      {activeSubTab === 'map' && mapData && (
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Federated Tactical Geospatial Map
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Real-time node status and clustering across all border commands
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1 text-indigo-400">
                <Building2 className="w-3.5 h-3.5" /> {mapData.clusters_summary.total_sites} Sites
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Shield className="w-3.5 h-3.5" /> {mapData.clusters_summary.total_bops} BOPs
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <Cctv className="w-3.5 h-3.5" /> {mapData.clusters_summary.total_cameras} Cameras
              </span>
            </div>
          </div>

          {/* Interactive Tactical Geospatial Map */}
          <div className="relative bg-[#070b14] border border-slate-800 rounded-2xl p-6 overflow-hidden space-y-6">
            <TacticalLeafletMap
              cameras={mapData.cameras.map(c => ({
                camera_id: c.id,
                camera_name: c.name,
                status: c.status,
                latitude: c.latitude,
                longitude: c.longitude,
                bop_site: c.bop_name,
                sector: 'Frontier Sector'
              })) as any}
              sites={mapData.sites}
              bops={mapData.bops}
              center={[
                mapData.sites.length > 0 && mapData.sites[0].latitude ? mapData.sites[0].latitude : 31.6245,
                mapData.sites.length > 0 && mapData.sites[0].longitude ? mapData.sites[0].longitude : 74.8725
              ]}
              height="480px"
              zoom={12}
            />


            {/* Sites Layer */}
            {mapData.sites.length === 0 ? (
              <div className="relative z-10 py-8 text-center space-y-3 border-t border-slate-800/80">

                <Globe className="w-12 h-12 mx-auto text-indigo-400/60 animate-pulse" />
                <div className="text-sm font-mono font-bold text-slate-300">
                  NO FEDERATED SITES CONFIGURED
                </div>
                <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                  All synthetic demo sites have been purged. You can register genuine border command sites and BOPs to start multi-site federation.
                </p>
                <button
                  onClick={() => setIsSiteModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Register Tactical Site
                </button>
              </div>
            ) : (
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {mapData.sites.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedSiteId(s.id); setActiveSubTab('directory'); }}
                    className="bg-[#0f172a]/90 border border-indigo-500/40 p-4 rounded-xl shadow-lg hover:border-indigo-400 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400">
                        SITE: {s.code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {s.latitude.toFixed(3)}°N, {s.longitude.toFixed(3)}°E
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">{s.name}</div>
                    <div className="flex items-center justify-between text-xs font-mono mt-3 text-slate-400">
                      <span>Health: <strong className="text-emerald-400">{s.health_score}%</strong></span>
                      <span>Risk: <strong className="text-rose-400">{s.risk_score}/100</strong></span>
                      <span>Cams: <strong className="text-sky-400">{s.total_cameras}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BOPs & Cameras Cluster Layer */}
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4">
              {mapData.bops.map(b => (
                <div
                  key={b.id}
                  onClick={() => { setSelectedBopId(b.id); setActiveSubTab('bop-wall'); }}
                  className="bg-[#0b101d]/90 border border-slate-800 p-3 rounded-xl hover:border-emerald-500/50 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 truncate">{b.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      b.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Cameras: <strong className="text-white">{b.total_cameras}</strong> • Priority: {b.priority}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0d1322]/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-800 mt-6">
              <span>Projection: WGS84 Universal Transverse Mercator</span>
              <span>Map Clusters Active • Viewport Sync: Centralized</span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SITE DIRECTORY & HIERARCHY */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {sites.length === 0 ? (
            <div className="bg-[#0d1322] border border-slate-800 rounded-2xl py-16 px-4 text-center space-y-3">
              <Building2 className="w-12 h-12 mx-auto text-indigo-400/60" />
              <div className="text-sm font-mono font-bold text-slate-300">NO TACTICAL SITES CONFIGURED</div>
              <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                No sites are currently configured. Register your primary tactical command center or border outpost.
              </p>
              <button
                onClick={() => setIsSiteModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Register Tactical Site
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sites.map(s => {
                const isSelected = selectedSiteId === s.site_id;
                return (
                  <div
                    key={s.site_id}
                    onClick={() => setSelectedSiteId(s.site_id)}
                    className={`bg-[#0d1322] border rounded-2xl p-5 cursor-pointer transition shadow-lg ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold text-indigo-400">{s.site_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{s.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description || 'Tactical border command center.'}</p>
                    
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Region: {s.region_id}</span>
                      <span>TZ: {s.timezone}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Drill-down Site Telemetry */}
          {siteOverview && (
            <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    {siteOverview.name} ({siteOverview.code})
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Detailed Site Observability & Sub-BOPs</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                    Health: {siteOverview.system_health}% ({siteOverview.system_health_status})
                  </span>
                  <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/20">
                    Risk: {siteOverview.current_risk}/100 ({siteOverview.forecast_risk})
                  </span>
                </div>
              </div>

              {/* BOPs Under this Site */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Subordinate Border Outposts ({siteOverview.bops.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {siteOverview.bops.map(b => (
                    <div
                      key={b.bop_id}
                      onClick={() => { setSelectedBopId(b.bop_id); setActiveSubTab('bop-wall'); }}
                      className="bg-[#0b101d] border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-emerald-400">{b.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{b.code}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 mt-2">
                        <div>Cameras: <strong className="text-white">{b.total_cameras}</strong></div>
                        <div>Online: <strong className="text-emerald-400">{b.online_cameras}</strong></div>
                        <div>Health: <strong className="text-emerald-400">{b.health_score}%</strong></div>
                        <div>Risk: <strong className="text-rose-400">{b.current_risk}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: BOP GRID & CAMERA WALL */}
      {activeSubTab === 'bop-wall' && (
        <div className="space-y-6">
          {bops.length === 0 ? (
            <div className="bg-[#0d1322] border border-slate-800 rounded-2xl py-16 px-4 text-center space-y-3">
              <Shield className="w-12 h-12 mx-auto text-emerald-400/60" />
              <div className="text-sm font-mono font-bold text-slate-300">NO BORDER OUTPOSTS (BOPs) CONFIGURED</div>
              <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                No border outposts are currently configured under federation. Register a BOP outpost to view localized camera grids.
              </p>
              <button
                onClick={() => setIsBopModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Register Border Outpost
              </button>
            </div>
          ) : (
            <>
              {/* BOP Selector Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Border Outpost Surveillance Wall: {bopOverview?.name || selectedBopId}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {bopOverview ? `${bopOverview.total_cameras} Total Cameras • Status: ${bopOverview.status} • Priority: ${bopOverview.operational_priority}` : 'Select a BOP'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">Switch BOP:</span>
                  <select
                    value={selectedBopId}
                    onChange={(e) => setSelectedBopId(e.target.value)}
                    className="bg-[#111a2e] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none"
                  >
                    {bops.map(b => (
                      <option key={b.bop_id} value={b.bop_id}>
                        {b.name} ({b.code}) — {b.site_id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Camera Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bopCameras.map(c => (
                  <div key={c.camera_id} className="bg-[#0d1322] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-sky-400">{c.camera_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        c.status === 'ONLINE' || c.status === 'HEALTHY' ? 'bg-emerald-500/20 text-emerald-400' :
                        c.status === 'DEGRADED' ? 'bg-orange-500/20 text-orange-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white truncate">{c.camera_name}</h4>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        FPS: {c.fps?.toFixed(1)} / {c.expected_fps} • Priority: {c.priority}
                      </p>
                    </div>

                    <div className="p-2.5 bg-[#070b14] border border-slate-800 rounded-lg text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Event:</span>
                        <span className="text-amber-400 font-semibold truncate ml-2">{c.current_event}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 mt-1">
                        <span>Risk:</span>
                        <span className="text-rose-400 font-bold">{c.risk_score}/100</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB 4: HEALTH & RISK MATRIX */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-6">
          {/* Sites Health Matrix */}
          <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Site Observability & Risk Matrix
                </h3>
                <p className="text-xs text-slate-400 font-mono">Real-time database aggregated multi-site telemetry</p>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5" /> Export Matrix CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111a2e] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Site ID</th>
                    <th className="p-3">Site Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">BOPs</th>
                    <th className="p-3">Total Cams</th>
                    <th className="p-3">Online</th>
                    <th className="p-3">Offline</th>
                    <th className="p-3">Incidents</th>
                    <th className="p-3">Risk</th>
                    <th className="p-3">Health Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {siteMatrix.map(s => (
                    <tr key={s.site_id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-bold text-sky-400">{s.site_id}</td>
                      <td className="p-3 font-semibold text-white">{s.site_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3">{s.bops_count}</td>
                      <td className="p-3">{s.total_cameras}</td>
                      <td className="p-3 text-emerald-400">{s.online_cameras}</td>
                      <td className="p-3 text-rose-400">{s.offline_cameras}</td>
                      <td className="p-3 text-amber-400">{s.active_incidents}</td>
                      <td className="p-3 text-rose-400 font-bold">{s.current_risk}</td>
                      <td className="p-3 font-bold text-emerald-400">{s.health_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOPs Matrix */}
          <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Border Outposts (BOP) Telemetry Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111a2e] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">BOP ID</th>
                    <th className="p-3">BOP Name</th>
                    <th className="p-3">Parent Site</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Cameras</th>
                    <th className="p-3">Online</th>
                    <th className="p-3">Incidents</th>
                    <th className="p-3">Risk</th>
                    <th className="p-3">Health Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bopMatrix.map(b => (
                    <tr key={b.bop_id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-bold text-emerald-400">{b.bop_id}</td>
                      <td className="p-3 font-semibold text-white">{b.bop_name}</td>
                      <td className="p-3 text-indigo-400">{b.site_id}</td>
                      <td className="p-3">{b.status}</td>
                      <td className="p-3">{b.priority}</td>
                      <td className="p-3">{b.total_cameras}</td>
                      <td className="p-3 text-emerald-400">{b.online_cameras}</td>
                      <td className="p-3 text-amber-400">{b.active_incidents}</td>
                      <td className="p-3 text-rose-400 font-bold">{b.current_risk}</td>
                      <td className="p-3 font-bold text-emerald-400">{b.health_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: GLOBAL SEARCH */}
      {activeSubTab === 'search' && (
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cross-Site Global Search Results
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {searchResults.length} matches found across authorized federated entities
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="bg-[#0b101d] border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-mono font-bold">
                    {r.entity_type}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">{r.name_or_title}</h4>
                    <p className="text-[11px] font-mono text-slate-400">
                      ID: {r.entity_id} • Site: {r.site_id} {r.bop_name ? `• BOP: ${r.bop_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-slate-400">
                  {r.risk_or_severity && <div className="text-rose-400">{r.risk_or_severity}</div>}
                  {r.status && <div className="text-emerald-400">{r.status}</div>}
                </div>
              </div>
            ))}

            {searchResults.length === 0 && (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                No matching entities found. Try searching for "Alpha", "CAM", or "River".
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 6: REPORTS & EXPORTS */}
      {activeSubTab === 'reports' && report && (
        <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Federated Operational Summary Report</h3>
              <p className="text-xs text-slate-400 font-mono">Scope: {report.report_scope} • Generated: {report.generated_at}</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> Download CSV Export
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Monitored Sites</span>
              <div className="text-xl font-bold font-mono text-white mt-1">{report.summary.total_sites}</div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Monitored BOPs</span>
              <div className="text-xl font-bold font-mono text-white mt-1">{report.summary.total_bops}</div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Total Cameras</span>
              <div className="text-xl font-bold font-mono text-white mt-1">{report.summary.total_cameras}</div>
            </div>
            <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Total Incidents</span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">{report.summary.total_incidents}</div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: ADMINISTRATION & SCOPED RBAC */}
      {activeSubTab === 'admin' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#0d1322] border border-slate-800 p-5 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Scoped Access & RBAC Assignments
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Section 19: Assign users to Region, Site, or BOP scopes
              </p>
            </div>
            <button
              onClick={() => setIsScopeModalOpen(true)}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <UserCheck className="w-4 h-4" /> Assign User Scope
            </button>
          </div>

          <div className="bg-[#0d1322] border border-slate-800 p-6 rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111a2e] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Username</th>
                    <th className="p-3">Scope Level</th>
                    <th className="p-3">Scope ID</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Assigned By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {userScopes.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-bold text-white">{u.username}</td>
                      <td className="p-3 text-indigo-400">{u.scope_type}</td>
                      <td className="p-3 font-mono">{u.scope_id}</td>
                      <td className="p-3 font-bold text-sky-400">{u.role}</td>
                      <td className="p-3 text-slate-400">{u.assigned_by}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={async () => {
                            if (window.confirm(`Revoke scope from ${u.username}?`)) {
                              await federationService.revokeUserScope(u.id);
                              setUserScopes(prev => prev.filter(x => x.id !== u.id));
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SiteModal
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
        siteToEdit={siteToEdit}
        onSave={async (data) => {
          if (siteToEdit) {
            await federationService.updateSite(siteToEdit.site_id, data);
          } else {
            await federationService.createSite(data);
          }
          loadGlobalData();
        }}
      />

      <BOPModal
        isOpen={isBopModalOpen}
        onClose={() => setIsBopModalOpen(false)}
        bopToEdit={bopToEdit}
        sites={sites}
        defaultSiteId={selectedSiteId === 'ALL' ? undefined : selectedSiteId}
        onSave={async (data) => {
          if (bopToEdit) {
            await federationService.updateBOP(bopToEdit.bop_id, data);
          } else {
            await federationService.createBOP(data);
          }
          loadGlobalData();
        }}
      />

      <UserScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        sites={sites}
        bops={bops}
        onSave={async (data) => {
          await federationService.assignUserScope(data);
          const scopes = await federationService.listUserScopes();
          setUserScopes(scopes);
        }}
      />
    </div>
  );
};
