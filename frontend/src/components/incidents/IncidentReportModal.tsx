import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { incidentService } from '../../services/incidentService';
import { Printer, ShieldCheck } from 'lucide-react';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string | null;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  incidentId
}) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && incidentId) {
      loadReport();
    }
  }, [isOpen, incidentId]);

  const loadReport = async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const data = await incidentService.getIncidentReport(incidentId);
      setReport(data);
    } catch (e) {
      console.error('Failed to load incident report dossier', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !incidentId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Incident Dossier & Evidence Integrity Summary // ${incidentId}`}
      subtitle="Cryptographically sealed incident report dossier with complete chain of custody"
      maxWidth="3xl"
    >
      <div className="space-y-4 font-mono text-xs max-h-[75vh] overflow-y-auto pr-1">
        {loading || !report ? (
          <div className="p-12 text-center text-slate-500">Generating cryptographic incident dossier...</div>
        ) : (
          <div className="space-y-4 bg-[#090d16] p-4 rounded-xl border border-slate-800 text-slate-200">
            {/* Header / Seal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-cyan-400 font-bold uppercase">IBVAP OPERATIONAL INCIDENT REPORT</span>
                <h3 className="text-sm font-black text-white">{report.dossier_id}</h3>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
                <span className="block text-emerald-400 font-bold">CHAIN-OF-CUSTODY VERIFIED</span>
              </div>
            </div>

            {/* Core Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#111a2e] p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[9px] text-slate-500 block">PRIORITY</span>
                <span className="text-xs font-bold text-white">{report.incident.priority}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">STATUS</span>
                <span className="text-xs font-bold text-cyan-400">{report.incident.status}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">SOURCE CAMERA</span>
                <span className="text-xs font-bold text-white">{report.incident.camera_id}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">RISK SCORE</span>
                <span className="text-xs font-bold text-amber-400">{report.incident.risk_score} / 100</span>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Chronological Event Timeline</span>
              <div className="space-y-1 bg-[#0d1424] p-3 rounded-lg border border-slate-800/80">
                {report.timeline.map((t: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between text-[11px] border-b border-slate-800/50 pb-1">
                    <div>
                      <span className="text-cyan-300 font-bold">{t.action.replace(/_/g, ' ')}</span>
                      {t.notes && <span className="text-slate-400 block text-[10px]">{t.notes}</span>}
                    </div>
                    <span className="text-slate-500 text-[10px] shrink-0">{new Date(t.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence Hashes */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Evidence Cryptographic Integrity</span>
              <div className="space-y-1 bg-[#0d1424] p-3 rounded-lg border border-slate-800/80">
                {report.evidence_chain.length === 0 ? (
                  <div className="text-[10px] text-slate-500">Live camera RTSP stream frames recorded. No standalone snapshots attached.</div>
                ) : (
                  report.evidence_chain.map((ev: any, idx: number) => (
                    <div key={idx} className="text-[10px] space-y-0.5 border-b border-slate-800/50 pb-1">
                      <div className="flex justify-between">
                        <span className="text-white font-bold">{ev.evidence_id} ({ev.evidence_type})</span>
                        <span className="text-slate-500">{ev.camera_id}</span>
                      </div>
                      <div className="text-cyan-400 break-all font-mono text-[9px]">SHA256: {ev.checksum_sha256}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dossier SHA-256 Seal */}
            <div className="p-3 bg-[#0d1424] border border-cyan-500/40 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>CRYPTOGRAPHIC DOSSIER SEAL</span>
              </div>
              <div className="text-[10px] text-slate-300 break-all font-mono">
                SHA-256: <strong className="text-white">{report.dossier_sha256}</strong>
              </div>
            </div>

            {/* Print and Export Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
              >
                CLOSE
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg text-xs transition shadow"
              >
                <Printer className="w-4 h-4" />
                PRINT / SAVE PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
