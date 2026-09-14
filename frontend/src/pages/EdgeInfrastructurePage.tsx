import React, { useState, useEffect } from 'react';
import { EdgeNode, EdgeSyncStats } from '../types/edge';
import { edgeService } from '../services/edgeService';
import { RemoteConfigModal } from '../components/edge/RemoteConfigModal';
import { RegisterEdgeNodeModal } from '../components/edge/RegisterEdgeNodeModal';
import { AssignedCamerasModal } from '../components/edge/AssignedCamerasModal';
import {
  Server,
  Activity,
  Sliders,
  RefreshCw,
  Clock,
  ShieldCheck,
  Layers,
  CheckCircle2,
  Plus,
  Trash2,
  Camera,
  Zap,
  FlaskConical
} from 'lucide-react';

interface EdgeInfrastructurePageProps {}

export const EdgeInfrastructurePage: React.FC<EdgeInfrastructurePageProps> = () => {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [stats, setStats] = useState<EdgeSyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<EdgeNode | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [camerasModalOpen, setCamerasModalOpen] = useState(false);
  const [nodeForCameras, setNodeForCameras] = useState<EdgeNode | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedStatus]);

  const loadData = async () => {
    try {
      const [nodesData, statsData] = await Promise.all([
        edgeService.getNodes({ status: selectedStatus || undefined }),
        edgeService.getSyncStats()
      ]);
      setNodes(nodesData);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load edge infrastructure data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfig = (node: EdgeNode) => {
    setSelectedNode(node);
    setConfigModalOpen(true);
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (window.confirm(`Are you sure you want to decommission and delete Edge Node ${nodeId}?`)) {
      try {
        await edgeService.deleteNode(nodeId);
        setNodes((prev) => prev.filter((n) => n.node_id !== nodeId));
      } catch (e) {
        console.error('Failed to delete edge node', e);
      }
    }
  };

  const handleReconnectNode = async (nodeId: string) => {
    try {
      const res = await edgeService.reconnectNode(nodeId);
      setStatusMsg({ type: 'success', text: `🔄 ${res.message || `Reconnected node ${nodeId}`}` });
      await loadData();
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to signal reconnect' });
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleFlushAll = async () => {
    try {
      setFlushing(true);
      const res = await edgeService.flushAllSync();
      setStatusMsg({ type: 'success', text: `⚡ ${res.message}` });
      await loadData();
      setTimeout(() => setStatusMsg(null), 6000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to flush edge queues.' });
      setTimeout(() => setStatusMsg(null), 5000);
    } finally {
      setFlushing(false);
    }
  };

  const handleSimulateOffline = async (nodeId: string) => {
    try {
      const res = await edgeService.simulateEdgeEvent(nodeId);
      setStatusMsg({ type: 'success', text: `🧪 ${res.message}` });
      await loadData();
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to buffer simulated event.' });
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleOpenCameras = (node: EdgeNode) => {
    setNodeForCameras(node);
    setCamerasModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#112338] via-[#0f172a] to-[#0d131f] border border-[#1e3a5f] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[11px] font-bold border border-sky-500/30">
              EDGE AI & STORE-AND-FORWARD MATRIX
            </span>
            <span className="text-slate-400 font-mono text-xs hidden sm:inline">• RESILIENT OFFLINE BORDER OUTPOSTS</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Edge Node Fleet & Store-and-Forward Gateway
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Local AI inference at remote border outposts (BOPs). Continues full intrusion detection, ANPR, and tracking during network outages with prioritized idempotent store-and-forward synchronization upon reconnection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFlushAll}
            disabled={flushing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-amber-600/20 disabled:opacity-50"
            title="Flush and ingest all pending store-and-forward events across all edge appliances"
          >
            <Zap className={`w-3.5 h-3.5 ${flushing ? 'animate-bounce text-yellow-200' : ''}`} />
            {flushing ? 'FLUSHING QUEUES...' : 'FLUSH & SYNC ALL QUEUES'}
          </button>

          <button
            onClick={() => setRegisterModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            REGISTER EDGE NODE
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            POLL TELEMETRY
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl font-mono text-xs flex items-center gap-2 border transition ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#111a2e] border border-sky-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-sky-400 font-bold">TOTAL EDGE NODES</span>
            <div className="text-2xl font-mono font-black text-sky-400">
              {nodes.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">ONLINE OUTPOSTS</span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {stats?.nodes_online ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 font-bold">PENDING SYNC QUEUE</span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {stats?.pending_sync ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 font-bold">SYNCHRONIZED EVENTS</span>
            <div className="text-2xl font-mono font-black text-purple-400">
              {stats?.total_synced ?? 0}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Edge Fleet Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Active Edge Appliances ({nodes.length})
          </h3>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-xs"
          >
            <option value="">All Node States</option>
            <option value="ONLINE">🟢 Online</option>
            <option value="DEGRADED">🟠 Degraded</option>
            <option value="OFFLINE">🔴 Offline</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nodes.map((node) => (
            <div
              key={node.node_id}
              className="bg-[#111a2e] border border-[#1e293b] hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-4 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{node.node_id}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        node.status === 'ONLINE'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                          : node.status === 'DEGRADED'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                          : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {node.status}
                    </span>
                    {node.low_bandwidth_mode && (
                      <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                        LOW BANDWIDTH
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {node.name} • <span className="text-slate-300">{node.bop_site}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenCameras(node)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition border border-slate-700"
                    title="View local cameras streaming through this edge node"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{node.active_cameras_count} Cams</span>
                  </button>

                  <button
                    onClick={() => handleSimulateOffline(node.node_id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 rounded-lg text-xs font-mono transition border border-amber-500/30"
                    title="Simulate offline intrusion event into local buffer for store-and-forward testing"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Event</span>
                  </button>

                  <button
                    onClick={() => handleReconnectNode(node.node_id)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition border border-slate-700"
                    title="Send reconnect signal and flush store-and-forward queue to Central Command"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  <button
                    onClick={() => handleOpenConfig(node)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition border border-slate-700"
                    title="Edit remote edge configuration"
                  >
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    <span>Config v{node.config_version}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteNode(node.node_id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-mono transition border border-slate-700 hover:border-rose-500/30"
                    title={`Decommission Edge Node ${node.node_id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hardware Telemetry Progress Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#090d16] p-3 rounded-xl border border-[#1e293b]">
                {/* CPU */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">CPU</span>
                    <span className="text-white font-bold">{Math.round(node.cpu_percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        node.cpu_percent > 80 ? 'bg-rose-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, node.cpu_percent)}%` }}
                    />
                  </div>
                </div>

                {/* RAM */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">RAM</span>
                    <span className="text-white font-bold">{Math.round(node.memory_percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        node.memory_percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, node.memory_percent)}%` }}
                    />
                  </div>
                </div>

                {/* Disk */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">DISK</span>
                    <span className="text-white font-bold">{Math.round(node.disk_percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        node.disk_percent > 85 ? 'bg-rose-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, node.disk_percent)}%` }}
                    />
                  </div>
                </div>

                {/* GPU */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">GPU</span>
                    <span className="text-white font-bold">{Math.round(node.gpu_percent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500"
                      style={{ width: `${Math.min(100, node.gpu_percent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Node Status Sub-row */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI: ACTIVE • {node.active_cameras_count}/{node.total_cameras_count} Cams</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Latency: {Math.round(node.latency_ms)}ms</span>
                  <span>•</span>
                  <span className="text-sky-300 font-bold">{node.sync_status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remote Configuration Modal */}
      <RemoteConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        node={selectedNode}
        onSuccess={loadData}
      />

      {/* Register New Edge Appliance Modal */}
      <RegisterEdgeNodeModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Assigned Local Cameras Modal */}
      <AssignedCamerasModal
        isOpen={camerasModalOpen}
        onClose={() => setCamerasModalOpen(false)}
        node={nodeForCameras}
      />
    </div>
  );
};
