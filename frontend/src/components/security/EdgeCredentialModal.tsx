import React, { useState } from 'react';
import { X, Key, Copy, Check } from 'lucide-react';
import { securityService } from '../../services/securityService';
import { EdgeNodeKeyIssuedSecret } from '../../types/security';

interface EdgeCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyIssued: () => void;
}

export const EdgeCredentialModal: React.FC<EdgeCredentialModalProps> = ({
  isOpen,
  onClose,
  onKeyIssued
}) => {
  const [nodeId, setNodeId] = useState('');
  const [siteId, setSiteId] = useState('SITE-BORDER-NORTH');
  const [bopId, setBopId] = useState('BOP-ALPHA');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<EdgeNodeKeyIssuedSecret | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId.trim()) return;
    setLoading(true);
    try {
      const res = await securityService.issueEdgeKey({
        node_id: nodeId.trim(),
        site_id: siteId,
        bop_id: bopId,
        expires_in_days: expiresInDays
      });
      setIssuedSecret(res);
      onKeyIssued();
    } catch (err) {
      console.error('Failed to issue edge key:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (issuedSecret) {
      navigator.clipboard.writeText(issuedSecret.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-xl w-full max-w-lg flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Issue Cryptographic Edge API Key</h3>
              <p className="text-xs text-slate-400">Per-node SHA-256 zero-trust authentication token</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIssuedSecret(null);
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {issuedSecret ? (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
              Edge node key generated successfully. Copy this key now. It will never be shown again.
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Generated API Key (Plaintext Secret):</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={issuedSecret.api_key}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center gap-1 text-xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div>Node Target: <span className="text-slate-200">{issuedSecret.node_id}</span></div>
              <div>Key Prefix: <span className="text-slate-200">{issuedSecret.key_prefix}***</span></div>
              {issuedSecret.expires_at && (
                <div>Expires: <span className="text-slate-200">{new Date(issuedSecret.expires_at).toLocaleDateString()}</span></div>
              )}
            </div>

            <button
              onClick={() => {
                setIssuedSecret(null);
                onClose();
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Done & Dismiss Secret
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Target Edge Node ID *</label>
              <input
                type="text"
                placeholder="e.g. EDGE-BOP-001"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                required
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Site Scope</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="SITE-BORDER-NORTH">SITE-BORDER-NORTH</option>
                  <option value="SITE-BORDER-SOUTH">SITE-BORDER-SOUTH</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">BOP Scope</label>
                <input
                  type="text"
                  value={bopId}
                  onChange={(e) => setBopId(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Key Validity Period</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
              >
                <option value={30}>30 Days (Strict Hygiene)</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>365 Days (1 Year)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !nodeId.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {loading ? 'Generating Key...' : 'Generate & Issue Key'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
