import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  FileCheck,
  RefreshCw,
  Search,
  UserCheck,
  MapPin,
  UserPlus,
  Unlock,
  Trash2,
  Shield,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { userService, Officer } from '../services/userService';
import { RegisterOfficerModal } from '../components/security/RegisterOfficerModal';
import { ResetPasswordModal } from '../components/security/ResetPasswordModal';
import { ReassignPostModal } from '../components/security/ReassignPostModal';
import { securityService } from '../services/securityService';
import { SecurityAuditLog } from '../types/security';
import { federationService } from '../services/federationService';
import { BOP } from '../types/federation';
import { getAllCheckposts } from '../constants/checkposts';

interface EnterpriseSecurityPageProps {}

export const EnterpriseSecurityPage: React.FC<EnterpriseSecurityPageProps> = () => {
  // 2 Pure Operational Tabs for Delhi HQ Admin:
  // 1. 'officers' -> Checkpost Heads & Officers Directory
  // 2. 'audit'    -> Officer Duty & Administrative Audit Trail (Immutable)
  const [activeSubTab, setActiveSubTab] = useState<'officers' | 'audit'>('officers');

  // Officers Management State
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [bops, setBops] = useState<BOP[]>([]);
  const [selectedOfficerForReset, setSelectedOfficerForReset] = useState<Officer | null>(null);
  const [selectedOfficerForReassign, setSelectedOfficerForReassign] = useState<Officer | null>(null);
  const [registerOfficerOpen, setRegisterOfficerOpen] = useState(false);

  // Filters & Search
  const [officerSearch, setOfficerSearch] = useState('');
  const [officerRoleFilter, setOfficerRoleFilter] = useState('ALL');
  const [selectedPostFilter, setSelectedPostFilter] = useState('ALL');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  const loadData = async () => {
    try {
      const [ofs, logs, bList] = await Promise.all([
        userService.listOfficers().catch(() => []),
        securityService.listAuditLogs({ limit: 100 }).catch(() => []),
        federationService.listBOPs().catch(() => [])
      ]);
      setOfficers(ofs);
      setAuditLogs(logs);

      // Merge comprehensive and custom checkpost catalog with backend BOPs
      const bopMap = new Map<string, BOP>();
      getAllCheckposts().forEach(cp => {
        bopMap.set(cp.id, {
          id: 0,
          bop_id: cp.id,
          site_id: 'SITE-BORDER',
          name: cp.name,
          code: cp.code,
          description: `${cp.sector} (${cp.state})`,
          location: `${cp.sector}, ${cp.state}`,
          status: 'ACTIVE',
          operational_priority: 'NORMAL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });
      bList.forEach(b => bopMap.set(b.bop_id, b));
      setBops(Array.from(bopMap.values()));
    } catch (err) {
      console.error('Failed to load Officer Governance data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

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
      alert('Master Administrator account cannot be decommissioned.');
      return;
    }
    if (window.confirm(`Are you sure you want to decommission checkpost personnel '${officer.username}'?`)) {
      try {
        await userService.deleteOfficer(officer.id);
        setOfficers((prev) => prev.filter((o) => o.id !== officer.id));
      } catch (err: any) {
        alert(`Failed to decommission officer: ${err.response?.data?.detail || err.message}`);
      }
    }
  };

  // Filtered Officers List
  const filteredOfficers = useMemo(() => {
    return officers.filter((o) => {
      // Role Filter
      if (officerRoleFilter !== 'ALL' && o.role.toUpperCase() !== officerRoleFilter) {
        return false;
      }
      // Post Filter
      if (selectedPostFilter !== 'ALL' && o.scope_id !== selectedPostFilter) {
        return false;
      }
      // Search Filter
      if (officerSearch.trim()) {
        const q = officerSearch.toLowerCase();
        const match =
          o.username.toLowerCase().includes(q) ||
          o.post_name.toLowerCase().includes(q) ||
          o.scope_id.toLowerCase().includes(q) ||
          (o.full_name && o.full_name.toLowerCase().includes(q)) ||
          o.email.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [officers, officerRoleFilter, selectedPostFilter, officerSearch]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch.trim()) return auditLogs;
    const q = auditSearch.toLowerCase();
    return auditLogs.filter(
      (a) =>
        a.audit_id.toLowerCase().includes(q) ||
        a.actor_username.toLowerCase().includes(q) ||
        a.action_type.toLowerCase().includes(q) ||
        (a.resource_id && a.resource_id.toLowerCase().includes(q))
    );
  }, [auditLogs, auditSearch]);

  // Export Commanders Directory CSV
  const handleExportOfficersCSV = () => {
    if (!officers.length) return;
    const headers = 'Commander Callsign,Full Name & Rank,Assigned Checkpost,Scope Type,Scope ID,Role,Status,Last Login\n';
    const rows = officers.map(o =>
      `"${o.username}","${o.full_name || o.username}","${o.post_name}","${o.scope_type}","${o.scope_id}","${o.role}","${o.is_active ? 'ACTIVE' : 'SUSPENDED'}","${o.last_login_at ? new Date(o.last_login_at).toLocaleString() : 'PENDING FIRST LOGIN'}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IBVAP_Checkpost_Commanders_Directory_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  // Metrics computation
  const totalPersonnel = officers.length;
  const totalCommanders = officers.filter(o => o.role.toUpperCase() === 'COMMANDER').length;
  const assignedBOPsCount = new Set(officers.map(o => o.scope_id)).size;
  const activeOfficersCount = officers.filter(o => o.is_active).length;
  const lockedCount = officers.filter(o => !o.is_active).length;

  return (
    <div className="p-6 space-y-6 bg-[#070b12] text-slate-100 min-h-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-xl text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                  Checkpost Heads (Commanders) Governance
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  DELHI HQ DEFENSE GOVERNANCE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Appoint Checkpost Heads (Commanders) • Allocate Border Checkposts • Issue Credentials & Monitor Audit Trail
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportOfficersCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            title="Download Officers Directory in CSV format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>EXPORT DIRECTORY</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-700"
            title="Refresh Officer Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Executive Personnel Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl shadow-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Total Registered</span>
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {totalPersonnel}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Personnel & Admin</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl shadow-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Checkpost Commanders</span>
            <Shield className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {totalCommanders}
          </div>
          <div className="text-[10px] text-amber-500/80 font-mono mt-0.5">BOP In-Charge Personnel</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl shadow-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Assigned Checkposts</span>
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {assignedBOPsCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Manned border outposts</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl shadow-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Active on Duty</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {activeOfficersCount}
          </div>
          <div className="text-[10px] text-emerald-500/80 font-mono mt-0.5">Operational accounts</div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl shadow-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Suspended / Inactive</span>
            <Lock className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">
            {lockedCount}
          </div>
          <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">Access restricted</div>
        </div>
      </div>

      {/* 2 Clean Operational Sub-Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 pb-2">
        <button
          onClick={() => setActiveSubTab('officers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'officers'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-md font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>1. CHECKPOST COMMANDERS & HEADS DIRECTORY ({filteredOfficers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-md font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>2. COMMANDER DUTY & AUDIT TRAIL ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: OFFICERS & PERSONNEL DIRECTORY */}
      {activeSubTab === 'officers' && (
        <div className="space-y-4">
          {/* Officers Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search Box */}
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search commanders by callsign, name, or checkpost..."
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {/* Role Filter */}
              <select
                value={officerRoleFilter}
                onChange={(e) => setOfficerRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 font-mono cursor-pointer"
              >
                <option value="ALL">All Roles (Commanders & Admin)</option>
                <option value="COMMANDER">COMMANDER (Checkpost Heads)</option>
                <option value="ADMIN">ADMIN (Central HQ)</option>
              </select>

              {/* Checkpost / BOP Filter */}
              <select
                value={selectedPostFilter}
                onChange={(e) => setSelectedPostFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 font-mono cursor-pointer"
              >
                <option value="ALL">All Assigned Checkposts</option>
                {bops.map(b => (
                  <option key={b.bop_id} value={b.bop_id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setRegisterOfficerOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-purple-600/25 cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ APPOINT COMMANDER / ADMIN</span>
            </button>
          </div>

          {/* Officers Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                Border Checkpost In-Charge & Commanders Directory
              </span>
              <span className="text-[11px] font-mono text-slate-500">Authorized Checkpost Heads Roster</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Commander / Callsign</th>
                    <th className="p-3">Assigned Duty Post (Checkpost)</th>
                    <th className="p-3">Border Sector</th>
                    <th className="p-3">Operational Rank</th>
                    <th className="p-3">Duty Status</th>
                    <th className="p-3">Last Login / Activity</th>
                    <th className="p-3 text-right">HQ Command Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOfficers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No checkpost commanders match the current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOfficers.map((officer) => (
                      <tr key={officer.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
                              {officer.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white font-bold">{officer.username}</div>
                              <div className="text-[10px] text-slate-500">{officer.full_name || officer.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{officer.post_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 pl-5">
                            Post ID: <span className="text-slate-400 font-semibold">{officer.scope_id}</span> ({officer.scope_type})
                          </div>
                        </td>

                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold whitespace-nowrap">
                            {officer.sector || (officer.role === 'ADMIN' ? 'All Border Sectors (National HQ)' : 'Punjab Sector')}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              officer.role.toUpperCase() === 'ADMIN'
                                ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                                : officer.role.toUpperCase() === 'COMMANDER'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                : 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                            }`}
                          >
                            {officer.role.toUpperCase() === 'COMMANDER' ? 'COMMANDER (Checkpost Head)' : officer.role}
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
                            {officer.is_active ? '🟢 ACTIVE DUTY' : '🔴 SUSPENDED'}
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
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] transition cursor-pointer"
                              title="Set or reset officer password & provide credentials handover slip"
                            >
                              <Key className="w-3 h-3" />
                              <span>Password</span>
                            </button>

                            <button
                              onClick={() => setSelectedOfficerForReassign(officer)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] transition cursor-pointer"
                              title="Transfer officer to a different checkpost / outpost"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Transfer Post</span>
                            </button>

                            <button
                              onClick={() => handleToggleOfficerStatus(officer)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700 cursor-pointer"
                              title={officer.is_active ? 'Suspend account access' : 'Reactivate account access'}
                            >
                              {officer.is_active ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>

                            {officer.username.toLowerCase() !== 'admin' && (
                              <button
                                onClick={() => handleDeleteOfficer(officer)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition border border-slate-700 hover:border-rose-500/30 cursor-pointer"
                                title={`Decommission ${officer.username}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OFFICER DUTY & AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit trail by actor, action, or checkpost..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Immutable Legal Defense Audit Records (Tamper-Evident)</span>
            </div>
          </div>

          <div className="bg-[#0e1626] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Audit ID</th>
                  <th className="p-3">Officer / Actor</th>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Target Checkpost / Resource</th>
                  <th className="p-3">Terminal IP</th>
                  <th className="p-3">Timestamp (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-900/40">
                      <td className="p-3 text-cyan-400 font-bold">{a.audit_id}</td>
                      <td className="p-3 text-slate-200 font-bold">{a.actor_username}</td>
                      <td className="p-3 font-semibold text-amber-300">{a.action_type}</td>
                      <td className="p-3 text-slate-300">{a.resource_type}: <strong className="text-white">{a.resource_id}</strong></td>
                      <td className="p-3 text-slate-400">{a.ip_address}</td>
                      <td className="p-3 text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
    </div>
  );
};
