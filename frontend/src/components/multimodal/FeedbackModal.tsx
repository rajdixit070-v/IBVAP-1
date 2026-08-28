import React, { useState } from 'react';
import { X, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { multimodalService } from '../../services/multimodalService';
import { MultimodalSecurityEvent } from '../../types/multimodal';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: MultimodalSecurityEvent | null;
  onFeedbackSaved: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  event,
  onFeedbackSaved
}) => {
  const [label, setLabel] = useState<'VALID' | 'FALSE_POSITIVE' | 'UNCERTAIN'>('VALID');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await multimodalService.submitFeedback(event.event_id, label, reason);
      onFeedbackSaved();
      onClose();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-xl w-full max-w-md flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Human-in-the-Loop Feedback</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{event.event_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-300">
            Verify the accuracy of this AI detection to tune future model inferences:
          </div>

          {/* Feedback Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setLabel('VALID')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                label === 'VALID'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Valid Event
            </button>
            <button
              type="button"
              onClick={() => setLabel('FALSE_POSITIVE')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                label === 'FALSE_POSITIVE'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <XCircle className="w-5 h-5 text-rose-400" />
              False Positive
            </button>
            <button
              type="button"
              onClick={() => setLabel('UNCERTAIN')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                label === 'UNCERTAIN'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Uncertain
            </button>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Operational Notes / Reason:</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Authorized border patrol personnel in sector..."
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
