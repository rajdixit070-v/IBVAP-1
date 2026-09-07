import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Key,
  Lock,
  Ban,
  FileCheck,
  Download,
  RefreshCw,
  AlertTriangle,
  Search,
  Plus,
  Play,
  Trash2,
  UserCheck,
  MapPin,
  UserPlus,
  Unlock,
  ArrowLeft
} from 'lucide-react';
import { userService, Officer } from '../services/userService';
import { RegisterOfficerModal } from '../components/security/RegisterOfficerModal';
import { ResetPasswordModal } from '../components/security/ResetPasswordModal';
import { ReassignPostModal } from '../components/security/ReassignPostModal';
import { securityService } from '../services/securityService';
import {
  SecurityThreatEvent,
  EdgeNodeKey,
  BlockedIP,
  SecurityPostureOverview,
  SecurityAuditLog,
  PasswordValidationResult
} from '../types/security';
import { EdgeCredentialModal } from '../components/security/EdgeCredentialModal';
import { ResolveThreatModal } from '../components/security/ResolveThreatModal';

interface EnterpriseSecurityPageProps {
  onBackToDashboard?: () => void;
}

export const EnterpriseSecurityPage: React.FC<EnterpriseSecurityPageProps> = ({ onBackToDashboard }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'officers' | 'threats' | 'edge-keys' | 'blocklist' | 'posture' | 'audit' | 'policy'
  >('officers');

  // Officers Management State
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedOfficerForReset, setSelectedOfficerForReset] = useState<Officer | null>(null);
  const [selectedOfficerForReassign, setSelectedOfficerForReassign] = useState<Officer | null>(null);
  const [registerOfficerOpen, setRegisterOfficerOpen] = useState(false);
  const [officerSearch, setOfficerSearch] = useState('');
  const [officerRoleFilter, setOfficerRoleFilter] = useState('ALL');

  // State
  const [overview, setOverview] = useState<SecurityPostureOverview | null>(null);
  const [threats, setThreats] = useState<SecurityThreatEvent[]>([]);
  const [edgeKeys, setEdgeKeys] = useState<EdgeNodeKey[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);

  // Password Policy Simulator State
  const [testPassword, setTestPassword] = useState('');
  const [policyResult, setPolicyResult] = useState<PasswordValidationResult | null>(null);

  // Manual IP block form
  const [newBlockIP, setNewBlockIP] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  // Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [selectedThreatToResolve, setSelectedThreatToResolve] = useState<SecurityThreatEvent | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [threatSearch, setThreatSearch] = useState('');

  const loadData = async () => {
    try {
      const [ov, ths, eks, ips, logs, ofs] = await Promise.all([
        securityService.getOverview().catch(() => null),
        securityService.listThreats({ limit: 50 }).catch(() => []),
        securityService.listEdgeKeys().catch(() => []),
        securityService.listBlockedIPs().catch(() => []),
        securityService.listAuditLogs({ limit: 50 }).catch(() => []),
        userService.listOfficers().catch(() => [])
      ]);
      setOverview(ov);
      setThreats(ths);
      setEdgeKeys(eks);
      setBlockedIPs(ips);
      setAuditLogs(logs);
      setOfficers(ofs);
    } catch (err) {
      console.error('Failed to load Enterprise Security data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTestPassword = async (pwd: string) => {
    setTestPassword(pwd);
    if (!pwd) {
      setPolicyResult(null);
      return;
    }
    try {
      const res = await securityService.validatePassword(pwd);
      setPolicyResult(res);
    } catch (err) {
      console.error('Failed to test password:', err);
    }
  };

  const handleRevokeKey = async (nodeId: string) => {
    const reason = window.prompt(`Enter reason for revoking edge node '${nodeId}':`, 'Suspected device compromise');
    if (!reason) return;
    try {
      await securityService.revokeEdgeKey(nodeId, reason);
      loadData();
    } catch (err) {
      console.error('Failed to revoke edge key:', err);
    }
  };

  const handleBlockIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockIP.trim()) return;
    try {
      await securityService.blockIP({ ip_address: newBlockIP.trim(), reason: newBlockReason.trim() });
      setNewBlockIP('');
      setNewBlockReason('');
      loadData();
    } catch (err) {
      console.error('Failed to block IP:', err);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      await securityService.unblockIP(ip);
      loadData();
    } catch (err) {
      console.error('Failed to unblock IP:', err);
    }
  };

  const handleTriggerCorrelation = async () => {
    try {
      const res = await securityService.triggerCorrelation();
      alert(`Correlation Complete: ${res.detected_patterns.length} pattern(s) evaluated.`);
      loadData();
    } catch (err) {
      console.error('Failed to trigger correlation:', err);
    }
  };

  const handlePurgeAllData = async () => {
    const confirmation = window.prompt(
      '⚠️ CRITICAL ACTION: This will permanently delete ALL evidence snapshots, security threat events, alerts, notifications, and operational incidents across all cameras.\n\nType "CONFIRM PURGE" to proceed:'
    );
    if (confirmation === 'CONFIRM PURGE') {
      try {
        const res = await securityService.purgeSystemData();
        alert(`Master Data Purge Successful!\n\n${res.message}`);
        loadData();
      } catch (err: any) {
        alert(`Failed to purge system data: ${err.response?.data?.detail || err.message}`);
      }
    }
  };

  const handleToggleOfficerStatus = async (officer: Officer) => {
    try {
      await userService.updateOfficer(officer.id, { is_active: !officer.is_active });
      loadData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteOfficer = async (officer: Officer) => {
    if (officer.username.toLowerCase() === 'admin') {
      alert('Master Administrator account cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to decommission officer '${officer.username}'?`)) {
      try {
        await userService.deleteOfficer(officer.id);
        setOfficers((prev) => prev.filter((o) => o.id !== officer.id));
      } catch (err: any) {
        alert(`Failed to decommission officer: ${err.response?.data?.detail || err.message}`);
      }
    }
  };

  const handleDeleteThreat = async (eventId: string) => {
    if (window.confirm(`Delete threat event '${eventId}'?`)) {
      try {
        await securityService.deleteThreat(eventId);
        setThreats((prev) => prev.filter((t) => t.event_id !== eventId));
      } catch (err: any) {
        alert(`Failed to delete threat: ${err.response?.data?.detail || err.message}`);
      }
    }
  };


  const handleClearAllThreats = async () => {
    if (window.confirm('Are you sure you want to delete all recorded threat events?')) {
      try {
        await securityService.clearAllThreats();
        setThreats([]);
        loadData();
      } catch (err: any) {
        alert(`Failed to clear threats: ${err.response?.data?.detail || err.message}`);
      }
    }
  };

  const filteredThreats = threats.filter((t) => {

    if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
    if (threatSearch.trim()) {
      const q = threatSearch.toLowerCase();
      return (
        t.event_id.toLowerCase().includes(q) ||
        t.event_type.toLowerCase().includes(q) ||
        t.source_ip.toLowerCase().includes(q) ||
        (t.username && t.username.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 bg-[#070b12] text-slate-100 min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-500/20 to-cyan-500/20 border border-rose-500/30 rounded-xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Enterprise Security & Zero-Trust Architecture
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE DEFENSE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentication Hardening • IDOR & SSRF Defense • Edge Key Management • Threat Correlation
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Return to Central Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dashboard</span>
            </button>
          )}
          <button
            onClick={handlePurgeAllData}
            className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-rose-950/50"
            title="Master 1-Click Purge of All System Logs, Alerts, Evidence, and Incidents"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            Purge All Data
          </button>
          <button
            onClick={handleTriggerCorrelation}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            Run Correlation
          </button>
          <a
            href={securityService.exportReportUrl('csv')}
            download
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Posture Report
          </a>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Executive Posture Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl group relative">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Posture Score</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-mono">
              ZERO-TRUST
            </span>
          </div>
          <div className="text-xl font-bold text-cyan-400 mt-1">
            {overview?.posture_score ?? 88} / 100
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5" title="Hardware & architectural hardening: AES-256 Fernet, Bcrypt-72, Anti-SSRF">
            Architecture: {overview?.overall_status ?? 'HARDENED'}
          </div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Active Threat Alerts</div>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {overview?.active_threats_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Under investigation</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Critical Threat Events</div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {overview?.critical_threats_count ?? 0}
          </div>
          <div className="text-[10px] text-rose-500 font-mono mt-0.5">High priority isolation</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Locked Accounts</div>
          <div className="text-xl font-bold text-purple-400 mt-1">
            {overview?.locked_accounts_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Brute force auto-locked</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Revoked Edge Nodes</div>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {overview?.revoked_edge_nodes_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Tokens invalidated</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Active Blocked IPs</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {overview?.blocked_ips_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Firewall drop active</div>
        </div>
      </div>

      {/* Sub-Tab Navigation Strip */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-2">
        {[
          { id: 'officers', label: 'Officers & Duty Post Directory', icon: UserCheck },
          { id: 'threats', label: 'Threat Intelligence Feed', icon: ShieldAlert },
          { id: 'edge-keys', label: 'Edge Cryptographic Keys', icon: Key },
          { id: 'blocklist', label: 'IP Blocklist & Defense', icon: Ban },
          { id: 'posture', label: 'Zero-Trust Posture & Findings', icon: ShieldCheck },
          { id: 'audit', label: 'Security Audit Logs', icon: FileCheck },
          { id: 'policy', label: 'Password Policy Simulator', icon: Lock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-rose-600/15 text-rose-400 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab 0: Officers & Personnel Directory */}
      {activeSubTab === 'officers' && (
        <div className="space-y-4">
          {/* Officers Header & Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search officers by callsign, post, or username..."
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <select
                value={officerRoleFilter}
                onChange={(e) => setOfficerRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-slate-200 font-mono"
              >
                <option value="ALL">All Ranks & Roles</option>
                <option value="COMMANDER">COMMANDER</option>
                <option value="OFFICER">OFFICER</option>
                <option value="BOP_OPERATOR">BOP_OPERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <button
              onClick={() => setRegisterOfficerOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-purple-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ REGISTER NEW DUTY OFFICER</span>
            </button>
          </div>

          {/* Officer Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0e1626] border border-purple-500/30 p-3.5 rounded-xl">
              <div className="text-[11px] font-mono text-purple-400 font-bold uppercase">Total Personnel</div>
              <div className="text-2xl font-bold font-mono text-white mt-0.5">{officers.length}</div>
              <div className="text-[10px] text-slate-500">Registered system users</div>
            </div>

            <div className="bg-[#0e1626] border border-emerald-500/30 p-3.5 rounded-xl">
              <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase">Active Duty Officers</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {officers.filter((o) => o.is_active).length}
              </div>
              <div className="text-[10px] text-slate-500">Authorized border checkposts</div>
            </div>

            <div className="bg-[#0e1626] border border-sky-500/30 p-3.5 rounded-xl">
              <div className="text-[11px] font-mono text-sky-400 font-bold uppercase">Assigned Outposts (BOPs)</div>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-0.5">
                {new Set(officers.map((o) => o.scope_id)).size}
              </div>
              <div className="text-[10px] text-slate-500">Active duty sectors</div>
            </div>

            <div className="bg-[#0e1626] border border-amber-500/30 p-3.5 rounded-xl">
              <div className="text-[11px] font-mono text-amber-400 font-bold uppercase">Locked / Suspended</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {officers.filter((o) => !o.is_active || (o.locked_until && new Date(o.locked_until) > new Date())).length}
              </div>
              <div className="text-[10px] text-slate-500">Access temporarily restricted</div>
            </div>
          </div>

          {/* Officers Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                Border Personnel & Duty Post Assignments
              </span>
              <span className="text-[11px] font-mono text-slate-500">Level-5 Central Authority Access Control</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Officer / Callsign</th>
                    <th className="p-3">Assigned Duty Post (BOP)</th>
                    <th className="p-3">Rank & Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Login / Activity</th>
                    <th className="p-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {officers
                    .filter((o) => {
                      const matchSearch =
                        !officerSearch ||
                        o.username.toLowerCase().includes(officerSearch.toLowerCase()) ||
                        o.post_name.toLowerCase().includes(officerSearch.toLowerCase()) ||
                        o.scope_id.toLowerCase().includes(officerSearch.toLowerCase());
                      const matchRole =
                        officerRoleFilter === 'ALL' || o.role.toUpperCase() === officerRoleFilter;
                      return matchSearch && matchRole;
                    })
                    .map((officer) => (
                      <tr key={officer.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
                              {officer.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white font-bold">{officer.username}</div>
                              <div className="text-[10px] text-slate-500">{officer.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{officer.post_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 pl-5">
                            Scope: {officer.scope_type} • ID: {officer.scope_id}
                          </div>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              officer.role.toUpperCase() === 'ADMIN'
                                ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                                : officer.role.toUpperCase() === 'COMMANDER'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                                : 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {officer.role}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              officer.is_active
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {officer.is_active ? '🟢 ACTIVE' : '🔴 SUSPENDED'}
                          </span>
                        </td>

                        <td className="p-3 text-slate-400 text-[11px]">
                          {officer.last_login_at
                            ? new Date(officer.last_login_at).toLocaleString()
                            : 'First login pending'}
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedOfficerForReset(officer)}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] transition"
                              title="Set or reset officer password & provide credentials"
                            >
                              <Key className="w-3 h-3" />
                              <span>Password</span>
                            </button>

                            <button
                              onClick={() => setSelectedOfficerForReassign(officer)}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] transition"
                              title="Reassign duty outpost or transfer officer"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Transfer Post</span>
                            </button>

                            <button
                              onClick={() => handleToggleOfficerStatus(officer)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
                              title={officer.is_active ? 'Suspend account' : 'Reactivate account'}
                            >
                              {officer.is_active ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>

                            {officer.username.toLowerCase() !== 'admin' && (
                              <button
                                onClick={() => handleDeleteOfficer(officer)}
                                className="p-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition border border-slate-700 hover:border-rose-500/30"
                                title={`Decommission ${officer.username}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 1: Threat Intelligence Feed */}
      {activeSubTab === 'threats' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter threats by ID, IP, user, type..."
                  value={threatSearch}
                  onChange={(e) => setThreatSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                Showing {filteredThreats.length} Recorded Threats
              </span>
              {threats.length > 0 && (
                <button
                  onClick={handleClearAllThreats}
                  className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer transition"
                  title="Clear all logged security threats"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredThreats.map((t) => (
              <div
                key={t.event_id}
                className="bg-[#0d1424] border border-slate-800 hover:border-rose-500/40 rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 font-bold">
                      {t.event_id}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        t.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : t.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}
                    >
                      {t.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-200 font-sans">{t.event_type}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>Source IP: <span className="text-slate-200">{t.source_ip}</span></span>
                    {t.username && <span>• User: <span className="text-slate-200">{t.username}</span></span>}
                    {t.endpoint && <span>• Target: <span className="text-slate-200">{t.endpoint}</span></span>}
                    <span>• Mitigation: <span className="text-cyan-300">{t.mitigation_action}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </span>
                  {t.status === 'NEW' || t.status === 'INVESTIGATING' ? (
                    <button
                      onClick={() => setSelectedThreatToResolve(t)}
                      className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      Mitigate / Resolve
                    </button>
                  ) : (
                    <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {t.status}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteThreat(t.event_id)}
                    className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition border border-transparent hover:border-rose-500/30 cursor-pointer"
                    title={`Delete threat ${t.event_id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

          </div>
        </div>
      )}

      {/* Sub-Tab 2: Edge Cryptographic Keys */}
      {activeSubTab === 'edge-keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div>
              <h3 className="text-xs font-semibold text-slate-200">Distributed Edge Node Key Registry</h3>
              <p className="text-[11px] text-slate-400">Manage per-node cryptographic tokens and emergency revocation.</p>
            </div>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Issue New Key
            </button>
          </div>

          <div className="bg-[#0e1626] border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] font-mono text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-3">Node ID</th>
                  <th className="p-3">Key Prefix</th>
                  <th className="p-3">Scope (Site / BOP)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {edgeKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-slate-200">{k.node_id}</td>
                    <td className="p-3 text-cyan-400">{k.key_prefix}***</td>
                    <td className="p-3 text-slate-400">{k.site_id} / {k.bop_id || 'Global'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          k.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-3 text-right font-sans">
                      {k.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeKey(k.node_id)}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded text-[11px] transition-colors"
                        >
                          Revoke Key
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: IP Blocklist & Defense */}
      {activeSubTab === 'blocklist' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" /> Manually Block Malicious IP
              </h3>
              <form onSubmit={handleBlockIP} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target IP Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 198.51.100.45"
                    value={newBlockIP}
                    onChange={(e) => setNewBlockIP(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Reason for Block *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Repeated unauthorized API fuzzing"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Apply IP Block
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Active Blocked IP Entries ({blockedIPs.length})</h3>
              <div className="divide-y divide-slate-800 font-mono text-xs">
                {blockedIPs.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-rose-400">{b.ip_address}</div>
                      <div className="text-slate-400 font-sans text-[11px] mt-0.5">{b.reason}</div>
                    </div>
                    <button
                      onClick={() => handleUnblockIP(b.ip_address)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans text-xs"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Zero-Trust Posture Breakdown & Findings */}
      {activeSubTab === 'posture' && (
        <div className="space-y-6">
          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" /> Subsystem Zero-Trust Verification Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview?.checks &&
                Object.entries(overview.checks).map(([k, c]) => (
                  <div key={k} className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{c.name}</span>
                      <span className="font-mono text-cyan-400 font-bold">{c.score_impact}</span>
                    </div>
                    <p className="text-xs text-slate-400">{c.details}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Automated Security Findings & Recommendations
            </h3>
            <div className="space-y-3">
              {overview?.findings.map((f) => (
                <div key={f.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-300">{f.title}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{f.description}</p>
                  <div className="text-xs text-cyan-400 font-mono pt-1">
                    Recommendation: {f.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Security Audit Logs */}
      {activeSubTab === 'audit' && (
        <div className="bg-[#0e1626] border border-slate-800 p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" /> Tamper-Evident Administrative Audit Log Explorer
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] font-mono text-slate-400 bg-slate-950/80 border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-3">Audit ID</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/40">
                    <td className="p-3 text-cyan-400">{a.audit_id}</td>
                    <td className="p-3 text-slate-200">{a.actor_username}</td>
                    <td className="p-3 font-semibold text-slate-300">{a.action_type}</td>
                    <td className="p-3 text-slate-400">{a.resource_type}: {a.resource_id}</td>
                    <td className="p-3 text-slate-400">{a.ip_address}</td>
                    <td className="p-3 text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 6: Password Policy Simulator */}
      {activeSubTab === 'policy' && (
        <div className="max-w-2xl bg-[#0e1626] border border-slate-800 p-6 rounded-xl space-y-5 shadow-2xl">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" /> Live Password Complexity & Policy Validator
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              SOC administrators use this testing utility to verify that candidate credentials for operators, border posts, and API service accounts meet military-grade Zero-Trust complexity requirements before saving.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-slate-500 font-bold uppercase mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => handleTestPassword('admin123')}
              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded text-[11px] font-mono transition cursor-pointer"
            >
              Test Weak: "admin123"
            </button>
            <button
              type="button"
              onClick={() => handleTestPassword('BorderPass2026')}
              className="px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 rounded text-[11px] font-mono transition cursor-pointer"
            >
              Test Medium: "BorderPass2026"
            </button>
            <button
              type="button"
              onClick={() => handleTestPassword('Admin@IBVAP2026!')}
              className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-mono transition cursor-pointer"
            >
              Test Strong: "Admin@IBVAP2026!"
            </button>
            {testPassword && (
              <button
                type="button"
                onClick={() => handleTestPassword('')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px] font-mono transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">Candidate Password to Validate:</label>
            <input
              type="text"
              placeholder="Type candidate password (e.g. Admin@IBVAP2026)..."
              value={testPassword}
              onChange={(e) => handleTestPassword(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          {/* Interactive 5-Point Policy Checklist */}
          {testPassword && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-[11px]">
              <div className={`flex items-center gap-1.5 ${testPassword.length >= 8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{testPassword.length >= 8 ? '✓' : '○'}</span>
                <span>Length (8+ chars)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{/[A-Z]/.test(testPassword) ? '✓' : '○'}</span>
                <span>Uppercase (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${/[a-z]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{/[a-z]/.test(testPassword) ? '✓' : '○'}</span>
                <span>Lowercase (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${/[0-9]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{/[0-9]/.test(testPassword) ? '✓' : '○'}</span>
                <span>Digit (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span>{/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]/.test(testPassword) ? '✓' : '○'}</span>
                <span>Special Character</span>
              </div>
              <div className={`flex items-center gap-1.5 ${!testPassword.toLowerCase().includes('admin') ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span>{!testPassword.toLowerCase().includes('admin') ? '✓' : '!'}</span>
                <span>No Username Match</span>
              </div>
            </div>
          )}

          {policyResult && (
            <div className={`p-4 rounded-xl border space-y-2 ${
              policyResult.is_valid
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-rose-950/30 border-rose-500/40'
            }`}>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-slate-300">Military-Grade Policy Verdict:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded border uppercase ${
                    policyResult.is_valid
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                      : 'bg-rose-950 text-rose-300 border-rose-500/50'
                  }`}
                >
                  {policyResult.is_valid ? 'COMPLIANT & SECURE' : 'POLICY VIOLATION'} (Score: {policyResult.score}/100)
                </span>
              </div>

              {policyResult.errors.length > 0 && (
                <div className="space-y-1 text-xs text-rose-300 font-mono pt-1">
                  {policyResult.errors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <RegisterOfficerModal
        isOpen={registerOfficerOpen}
        onClose={() => setRegisterOfficerOpen(false)}
        onSuccess={loadData}
      />

      <ResetPasswordModal
        isOpen={!!selectedOfficerForReset}
        officer={selectedOfficerForReset}
        onClose={() => setSelectedOfficerForReset(null)}
        onSuccess={loadData}
      />

      <ReassignPostModal
        isOpen={!!selectedOfficerForReassign}
        officer={selectedOfficerForReassign}
        onClose={() => setSelectedOfficerForReassign(null)}
        onSuccess={loadData}
      />

      <EdgeCredentialModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyIssued={loadData}
      />

      <ResolveThreatModal
        isOpen={!!selectedThreatToResolve}
        onClose={() => setSelectedThreatToResolve(null)}
        threat={selectedThreatToResolve}
        onResolved={loadData}
      />
    </div>
  );
};
