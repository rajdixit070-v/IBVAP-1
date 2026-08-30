import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { EdgeNodeCreate, EdgeNode } from '../../types/edge';
import { edgeService } from '../../services/edgeService';
import {
  Server,
  Key,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Cpu,
  MapPin,
  AlertTriangle
} from 'lucide-react';

interface RegisterEdgeNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterEdgeNodeModal: React.FC<RegisterEdgeNodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<EdgeNodeCreate>({
    node_id: '',
    name: '',
    bop_site: '',
    location: '',
    software_version: '1.0.0',
    hardware_info: 'NVIDIA Jetson Orin NX / Linux ARM64',
    low_bandwidth_mode: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdNode, setCreatedNode] = useState<EdgeNode | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.node_id.trim() || !formData.name.trim() || !formData.bop_site.trim()) {
      setError('Node ID, Name, and Border Outpost Site are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await edgeService.createNode(formData);
      setCreatedNode(res);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register edge node appliance.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyKey = () => {
    if (createdNode?.api_key) {
      navigator.clipboard.writeText(createdNode.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleDownloadConfig = () => {
    if (!createdNode) return;
    const configData = createdNode.config_template || {
      node_id: createdNode.node_id,
      node_name: createdNode.name,
      bop_site: createdNode.bop_site,
      central_url: window.location.origin,
      api_key: createdNode.api_key || '',
      heartbeat_interval_sec: 10,
      sync_interval_sec: 5,
      sync_batch_size: 25,
      low_bandwidth_mode: createdNode.low_bandwidth_mode,
      cameras: []
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edge_config_${createdNode.node_id.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setCreatedNode(null);
    setFormData({
      node_id: '',
      name: '',
      bop_site: '',
      location: '',
      software_version: '1.0.0',
      hardware_info: 'NVIDIA Jetson Orin NX / Linux ARM64',
      low_bandwidth_mode: false
    });
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={createdNode ? "EDGE APPLIANCE REGISTERED SUCCESSFULLY" : "REGISTER REMOTE EDGE APPLIANCE"}
      maxWidth="2xl"
    >
      {createdNode ? (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>Node {createdNode.node_id} Provisioned & Credentials Generated</span>
            </div>
            <p className="text-slate-300">
              Your remote edge node is registered with Central IBVAP. Save the 256-bit API authentication token and download the pre-configured <code className="text-amber-400">edge_config.json</code> file below to deploy to the outpost machine.
            </p>
          </div>

          {/* Token Display */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Cryptographic Edge Authentication Token (256-bit)
            </label>
            <div className="flex items-center gap-2 bg-[#090d16] p-3 rounded-xl border border-amber-500/30">
              <input
                type="text"
                readOnly
                value={createdNode.api_key || 'Token locked'}
                className="bg-transparent font-mono text-xs text-amber-300 w-full focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyKey}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-mono transition border border-amber-500/40"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              ⚠️ Save this key securely. It authenticates edge heartbeats and store-and-forward batches.
            </span>
          </div>

          {/* Secure VPN Guidance */}
          <div className="p-3.5 bg-sky-950/30 border border-sky-500/30 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-sky-400 font-bold">
              <Lock className="w-4 h-4" />
              <span>Zero-Trust WireGuard / VPN Deployment Rules</span>
            </div>
            <ul className="list-disc pl-4 text-slate-300 space-y-1 text-[11px]">
              <li>Remote cameras must remain on the Outpost LAN (e.g. 192.168.1.x) and never exposed to the Internet.</li>
              <li>The Edge Agent connects back to Central IBVAP through a WireGuard or mTLS tunnel.</li>
              <li>If the tunnel disconnects, the Edge Agent continues local AI detection and buffers events locally.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDownloadConfig}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-mono font-bold transition shadow-lg"
            >
              <Download className="w-4 h-4" />
              Download edge_config.json
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition"
            >
              Done & Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                Edge Node ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. EDGE-BOP-NORTH-01"
                value={formData.node_id}
                onChange={(e) => setFormData({ ...formData, node_id: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Appliance Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Outpost Post-9 Edge Jetson"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Border Outpost (BOP Site) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BOP Alpha, Sector 4"
                value={formData.bop_site}
                onChange={(e) => setFormData({ ...formData, bop_site: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Physical Location / Tower</label>
              <input
                type="text"
                placeholder="e.g. North Watch Tower 3"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Hardware Specification
            </label>
            <input
              type="text"
              placeholder="e.g. NVIDIA Jetson Orin NX / Linux ARM64"
              value={formData.hardware_info || ''}
              onChange={(e) => setFormData({ ...formData, hardware_info: e.target.value })}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-slate-200 font-bold">Low Bandwidth Mode</div>
              <div className="text-[11px] text-slate-500">Limits sync to critical alarms and throttles full snapshot uploads over low-speed satellite links.</div>
            </div>
            <input
              type="checkbox"
              checked={formData.low_bandwidth_mode}
              onChange={(e) => setFormData({ ...formData, low_bandwidth_mode: e.target.checked })}
              className="w-4 h-4 accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition shadow-lg disabled:opacity-50"
            >
              <Server className="w-4 h-4" />
              {saving ? 'Provisioning...' : 'Provision Edge Node'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
