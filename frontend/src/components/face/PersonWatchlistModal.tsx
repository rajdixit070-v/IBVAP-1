import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  PersonWatchlist,
  PersonWatchlistCreate,
  PersonWatchlistUpdate,
  PersonCategory
} from '../../types/face';
import { faceService } from '../../services/faceService';
import { Save } from 'lucide-react';

interface PersonWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  personToEdit?: PersonWatchlist | null;
  onSuccess: () => void;
}

export const PersonWatchlistModal: React.FC<PersonWatchlistModalProps> = ({
  isOpen,
  onClose,
  personToEdit,
  onSuccess
}) => {
  const [personId, setPersonId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<PersonCategory>('WATCHLIST');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('ACTIVE');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personToEdit) {
      setPersonId(personToEdit.person_id);
      setDisplayName(personToEdit.display_name);
      setCategory(personToEdit.category);
      setStatus(personToEdit.status);
      setNotes(personToEdit.notes || '');
    } else {
      setPersonId('');
      setDisplayName('');
      setCategory('WATCHLIST');
      setStatus('ACTIVE');
      setNotes('');
    }
  }, [personToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please provide a person name / callsign.');
      return;
    }
    if (!personToEdit && !personId.trim()) {
      setError('Please provide a unique Person ID (e.g. PID-WL-101).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (personToEdit) {
        const updateData: PersonWatchlistUpdate = {
          display_name: displayName,
          category,
          status,
          notes: notes || undefined
        };
        await faceService.updatePerson(personToEdit.id, updateData);
      } else {
        const createData: PersonWatchlistCreate = {
          person_id: personId.toUpperCase(),
          display_name: displayName,
          category,
          status,
          notes: notes || undefined,
          embedding: new Array(128).fill(0.01)
        };
        await faceService.createPerson(createData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save identity record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={personToEdit ? `Edit Identity // ${personToEdit.person_id}` : 'Register Person / Watchlist Identity'}
      subtitle="Configure personnel clearance, watchlist categorization, and biometric reference profile"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Person ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!!personToEdit}
              placeholder="e.g. PID-WL-089"
              value={personId}
              onChange={(e) => setPersonId(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white uppercase placeholder-slate-500 font-mono font-bold focus:outline-none focus:border-sky-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name / Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Person of Interest #089"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Clearance / Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PersonCategory)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
            >
              <option value="AUTHORIZED">✅ AUTHORIZED PERSONNEL</option>
              <option value="WATCHLIST">⚠️ WATCHLIST (Potential Threat)</option>
              <option value="MONITOR">👁️ MONITOR (Surveillance)</option>
              <option value="RESTRICTED">🛑 RESTRICTED (Interdict)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Record Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED')}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Operational Profile / Notes</label>
          <textarea
            rows={2}
            placeholder="Security brief, clearance jurisdiction, or escort instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold tracking-wider transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'SAVING...' : 'SAVE IDENTITY RECORD'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
