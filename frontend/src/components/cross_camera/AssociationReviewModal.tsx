import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { TrackAssociation } from '../../types/crossCamera';
import { crossCameraService } from '../../services/crossCameraService';
import { Check, X, ArrowRight } from 'lucide-react';

interface AssociationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  association: TrackAssociation | null;
  onSuccess: () => void;
}

export const AssociationReviewModal: React.FC<AssociationReviewModalProps> = ({
  isOpen,
  onClose,
  association,
  onSuccess
}) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!association) return null;

  const handleReview = async (action: 'CONFIRM' | 'REJECT') => {
    setSubmitting(true);
    setError(null);
    try {
      await crossCameraService.reviewAssociation(
        association.association_id,
        action,
        notes || (action === 'CONFIRM' ? 'Confirmed by duty officer' : 'Rejected by duty officer'),
        'operator'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Human Association Review // ${association.association_id}`}
      subtitle="Audit and confirm or reject probable cross-camera movement link"
      maxWidth="lg"
    >
      <div className="space-y-4 font-mono text-xs">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Pairwise Comparison Box */}
        <div className="p-4 bg-[#090d16] border border-[#1e293b] rounded-xl flex items-center justify-between">
          <div className="text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">ORIGIN CAMERA</span>
            <span className="text-sm font-bold text-sky-400">{association.from_camera_id}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-5 h-5 text-sky-400" />
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              {Math.round(association.association_score * 100)}% CONFIDENCE
            </span>
          </div>

          <div className="text-center space-y-1">
            <span className="text-[10px] text-slate-500 block">DESTINATION CAMERA</span>
            <span className="text-sm font-bold text-sky-400">{association.to_camera_id}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Operator Verification Notes</label>
          <input
            type="text"
            placeholder="e.g. Visual clothing match confirmed across North-Gate corridor"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleReview('REJECT')}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            REJECT ASSOCIATION
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleReview('CONFIRM')}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            CONFIRM ASSOCIATION
          </button>
        </div>
      </div>
    </Modal>
  );
};
