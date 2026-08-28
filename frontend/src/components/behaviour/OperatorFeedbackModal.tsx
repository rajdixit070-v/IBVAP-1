import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { BehaviourEvent } from '../../types/behaviour';
import { behaviourService } from '../../services/behaviourService';
import { Check, X, HelpCircle, Save } from 'lucide-react';

interface OperatorFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: BehaviourEvent | null;
  onSuccess: () => void;
}

export const OperatorFeedbackModal: React.FC<OperatorFeedbackModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess
}) => {
  const [feedbackType, setFeedbackType] = useState<'CORRECT_DETECTION' | 'FALSE_POSITIVE' | 'NEEDS_REVIEW'>('CORRECT_DETECTION');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await behaviourService.submitFeedback({
        event_id: event.event_id,
        feedback_type: feedbackType,
        notes: notes || 'Operator review feedback',
        operator_username: 'operator'
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Operator Review Feedback // ${event.event_id}`}
      subtitle="Audit behavioral anomaly detection accuracy for model performance tracking"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl space-y-1">
          <div className="text-white font-bold">{event.event_type.replace(/_/g, ' ')}</div>
          <div className="text-slate-400 text-[11px]">
            Camera: {event.camera_id} • Risk Score: {event.decayed_risk_score}/100
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-2">Detection Assessment</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFeedbackType('CORRECT_DETECTION')}
              className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                feedbackType === 'CORRECT_DETECTION'
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow'
                  : 'bg-[#090d16] border-slate-800 text-slate-400'
              }`}
            >
              <Check className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
              CORRECT
            </button>

            <button
              type="button"
              onClick={() => setFeedbackType('FALSE_POSITIVE')}
              className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                feedbackType === 'FALSE_POSITIVE'
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow'
                  : 'bg-[#090d16] border-slate-800 text-slate-400'
              }`}
            >
              <X className="w-4 h-4 mx-auto mb-1 text-rose-400" />
              FALSE ALARM
            </button>

            <button
              type="button"
              onClick={() => setFeedbackType('NEEDS_REVIEW')}
              className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                feedbackType === 'NEEDS_REVIEW'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow'
                  : 'bg-[#090d16] border-slate-800 text-slate-400'
              }`}
            >
              <HelpCircle className="w-4 h-4 mx-auto mb-1 text-amber-400" />
              UNCERTAIN
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Operator Notes / Rationale</label>
          <textarea
            rows={3}
            placeholder="e.g. Authorized border patrol vehicle performing scheduled inspection..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'SAVING...' : 'RECORD FEEDBACK'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
