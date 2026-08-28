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
  Play
} from 'lucide-react';
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

export const EnterpriseSecurityPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'threats' | 'edge-keys' | 'blocklist' | 'posture' | 'audit' | 'policy'
  >('threats');

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
      const [ov, ths, eks, ips, logs] = await Promise.all([
        securityService.getOverview().catch(() => null),
        securityService.listThreats({ limit: 50 }).catch(() => []),
        securityService.listEdgeKeys().catch(() => []),
        securityService.listBlockedIPs().catch(() => []),
        securityService.listAuditLogs({ limit: 50 }).catch(() => [])
      ]);
      setOverview(ov);
      setThreats(ths);
      setEdgeKeys(eks);
      setBlockedIPs(ips);
      setAuditLogs(logs);
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
    if (!newBlockIP.trim() || !newBlockReason.trim()) return;
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
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerCorrelation}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            Run Correlation
          </button>
          <a
            href={securityService.exportReportUrl('csv')}
            download
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Posture Report
          </a>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Executive Posture Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="bg-[#0e1626] border border-slate-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Posture Score</div>
          <div className="text-xl font-bold text-cyan-400 mt-1">
            {overview?.posture_score ?? 88} / 100
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
            Status: {overview?.overall_status ?? 'STRONG'}
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

            <div className="text-xs font-mono text-slate-400">
              Showing {filteredThreats.length} Recorded Threats
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
        <div className="max-w-xl bg-[#0e1626] border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" /> Live Password Complexity & Policy Validator
          </h3>
          <p className="text-xs text-slate-400">
            Simulate password strength rules (minimum 8 chars, uppercase, lowercase, numbers, special characters).
          </p>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Enter Password to Validate:</label>
            <input
              type="text"
              placeholder="Type a candidate password..."
              value={testPassword}
              onChange={(e) => handleTestPassword(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono"
            />
          </div>

          {policyResult && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Compliance Status:</span>
                <span
                  className={`font-mono font-bold ${
                    policyResult.is_valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {policyResult.is_valid ? 'COMPLIANT' : 'NON-COMPLIANT'} (Score: {policyResult.score}/100)
                </span>
              </div>

              {policyResult.errors.length > 0 && (
                <div className="space-y-1 text-xs text-rose-400">
                  {policyResult.errors.map((err, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span>•</span>
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
