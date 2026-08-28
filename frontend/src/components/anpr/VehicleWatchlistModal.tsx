import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  VehicleWatchlist,
  VehicleWatchlistCreate,
  VehicleWatchlistUpdate,
  VehicleStatus,
  WatchlistCategory
} from '../../types/anpr';
import { anprService } from '../../services/anprService';
import { Save } from 'lucide-react';

interface VehicleWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleToEdit?: VehicleWatchlist | null;
  onSuccess: () => void;
}

export const VehicleWatchlistModal: React.FC<VehicleWatchlistModalProps> = ({
  isOpen,
  onClose,
  vehicleToEdit,
  onSuccess
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState<VehicleStatus>('WATCHLIST');
  const [category, setCategory] = useState<WatchlistCategory>('GENERAL');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleToEdit) {
      setPlateNumber(vehicleToEdit.plate_number);
      setVehicleType(vehicleToEdit.vehicle_type);
      setOwnerName(vehicleToEdit.owner_name || '');
      setStatus(vehicleToEdit.status);
      setCategory(vehicleToEdit.watchlist_category);
      setNotes(vehicleToEdit.notes || '');
    } else {
      setPlateNumber('');
      setVehicleType('car');
      setOwnerName('');
      setStatus('WATCHLIST');
      setCategory('GENERAL');
      setNotes('');
    }
  }, [vehicleToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      setError('Please enter a license plate number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (vehicleToEdit) {
        const updateData: VehicleWatchlistUpdate = {
          plate_number: plateNumber,
          vehicle_type: vehicleType,
          owner_name: ownerName || undefined,
          status,
          watchlist_category: category,
          notes: notes || undefined
        };
        await anprService.updateVehicle(vehicleToEdit.id, updateData);
      } else {
        const createData: VehicleWatchlistCreate = {
          plate_number: plateNumber,
          vehicle_type: vehicleType,
          owner_name: ownerName || undefined,
          status,
          watchlist_category: category,
          notes: notes || undefined
        };
        await anprService.createVehicle(createData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save vehicle record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vehicleToEdit ? `Edit Vehicle // ${vehicleToEdit.normalized_plate_number}` : 'Register Vehicle in Watchlist / Registry'}
      subtitle="Configure target classification, security status, and surveillance notes"
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
              Plate Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. UP32AB1234"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white uppercase placeholder-slate-500 font-mono font-bold focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="car">🚗 Passenger Car</option>
              <option value="suv">🚙 SUV / 4x4</option>
              <option value="truck">🚚 Heavy Truck / Logistics</option>
              <option value="bus">🚌 Transport Bus</option>
              <option value="motorcycle">🏍️ Motorcycle</option>
              <option value="van">🚐 Van / Minibus</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Security Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VehicleStatus)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
            >
              <option value="AUTHORIZED">✅ AUTHORIZED (Permitted Transit)</option>
              <option value="WATCHLIST">⚠️ WATCHLIST (Potential Threat)</option>
              <option value="MONITOR">👁️ MONITOR (Active Observation)</option>
              <option value="BLOCKED">🛑 BLOCKED (Deny Entry)</option>
              <option value="UNKNOWN">❓ UNKNOWN (Unverified)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Watchlist Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as WatchlistCategory)}
              className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="GENERAL">GENERAL</option>
              <option value="SUSPICIOUS_MOVEMENT">SUSPICIOUS MOVEMENT</option>
              <option value="RESTRICTED_THREAT">RESTRICTED THREAT</option>
              <option value="PATROL">BORDER PATROL FLEET</option>
              <option value="VIP">VIP ESCORT</option>
              <option value="ESCORTED">ESCORTED LOGISTICS</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Owner / Organization (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Border Security Wing or Logistics Vendor"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full px-3 py-2 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Operational Notes</label>
          <textarea
            rows={2}
            placeholder="Context, reason for flag, or escort protocol..."
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
            {loading ? 'SAVING...' : 'SAVE VEHICLE RECORD'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
