import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { BaselineShift } from '../../types/predictive';
import { predictiveService } from '../../services/predictiveService';
import { Check, X } from 'lucide-react';

interface BaselineShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const BaselineShiftModal: React.FC<BaselineShiftModalProps> = ({
  isOpen,
  onClose,
  onUpdated
}) => {
  const [shifts, setShifts] = useState<BaselineShift[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadShifts();
    }
  }, [isOpen]);

  const loadShifts = async () => {
    try {
      const data = await predictiveService.getBaselineShifts();
      setShifts(data);
    } catch (e) {
      console.error('Failed to load baseline shifts', e);
    }
  };

  const handleAction = async (shiftId: string, approve: boolean) => {
    try {
      await predictiveService.approveBaselineShift(shiftId, approve, approve ? 'Approved baseline shift' : 'Rejected baseline shift');
      await loadShifts();
      onUpdated();
    } catch (e) {
      console.error('Failed to update baseline shift', e);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Baseline Shift Detection & Calibration Review"
      subtitle="Administrative review for sustained changes in normal camera and sector traffic patterns"
      maxWidth="3xl"
    >
      <div className="space-y-4 font-mono text-xs">
        {shifts.length === 0 ? (
          <div className="p-8 bg-[#090d16] border border-slate-800 rounded-xl text-center text-slate-500">
            No pending baseline shifts detected. Current statistical activity baselines are stable.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{s.shift_id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        s.status === 'REVIEW_REQUIRED'
                          ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                          : s.status === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                          : 'bg-rose-950 text-rose-300 border-rose-500/50'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Camera: <span className="text-sky-400 font-bold">{s.camera_id}</span> • Hour: {s.hour_of_day}:00
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Old Baseline: <span className="text-slate-400 font-bold">{s.old_baseline_value.toFixed(1)}</span> → New Observed: <span className="text-amber-400 font-bold">{s.new_observed_value.toFixed(1)}</span> ({s.deviation_percent > 0 ? '+' : ''}{s.deviation_percent}%)
                  </div>
                </div>

                {s.status === 'REVIEW_REQUIRED' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(s.shift_id, false)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-bold transition border border-rose-500/30"
                    >
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      REJECT
                    </button>
                    <button
                      onClick={() => handleAction(s.shift_id, true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      APPROVE SHIFT
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 text-right">
                    <span>Reviewed by {s.reviewed_by || 'admin'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
          >
            CLOSE
          </button>
        </div>
      </div>
    </Modal>
  );
};
