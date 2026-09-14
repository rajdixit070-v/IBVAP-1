import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Check, Plus, ChevronDown, X } from 'lucide-react';
import { CheckpostItem, getSectorBadgeColor, getAllCheckposts } from '../../constants/checkposts';

export interface CheckpostSearchSelectProps {
  value: string; // e.g. 'BOP-WAGAH'
  onChange: (post: { id: string; name: string; type: string; sector?: string; state?: string; latitude?: number; longitude?: number }) => void;
  availableCheckposts?: CheckpostItem[];
  disabled?: boolean;
  placeholder?: string;
}

const SECTOR_PILLS = [
  'ALL',
  'Punjab',
  'Rajasthan',
  'Gujarat',
  'Jammu',
  'Ladakh',
  'Eastern'
];

export const CheckpostSearchSelect: React.FC<CheckpostSearchSelectProps> = ({
  value,
  onChange,
  availableCheckposts,
  disabled = false,
  placeholder = 'Search or type checkpost (e.g. Wagah, RS Pura, Tanot)...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedSectorPill, setSelectedSectorPill] = useState('ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge custom + comprehensive checkposts with any dynamically provided ones
  const checkpostsList = useMemo(() => {
    const map = new Map<string, CheckpostItem>();
    getAllCheckposts().forEach(cp => map.set(cp.id.toUpperCase(), cp));
    if (availableCheckposts) {
      availableCheckposts.forEach(cp => {
        const existing = map.get(cp.id.toUpperCase());
        if (existing) {
          map.set(cp.id.toUpperCase(), { ...existing, ...cp });
        } else {
          map.set(cp.id.toUpperCase(), cp);
        }
      });
    }
    return Array.from(map.values());
  }, [availableCheckposts]);

  // Current selected item
  const selectedItem = useMemo(() => {
    return checkpostsList.find(c => c.id.toUpperCase() === (value || '').toUpperCase()) || null;
  }, [checkpostsList, value]);

  // Auto-commit query if user typed and closed without clicking
  const commitQuery = (qToCommit: string) => {
    const q = qToCommit.trim();
    if (!q) return;

    // Check exact or best match in list
    const found = checkpostsList.find(
      c => c.name.toLowerCase() === q.toLowerCase() ||
           c.id.toLowerCase() === q.toLowerCase() ||
           c.code.toLowerCase() === q.toLowerCase()
    );
    if (found) {
      handleSelect(found);
    } else {
      // Auto-commit as custom checkpost
      const cleanName = q;
      const cleanId = cleanName.toUpperCase().startsWith('BOP-')
        ? cleanName.toUpperCase().replace(/\s+/g, '-')
        : `BOP-${cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

      onChange({
        id: cleanId,
        name: cleanName,
        type: 'BOP',
        sector: selectedSectorPill !== 'ALL' ? selectedSectorPill : undefined
      });
      setQuery('');
    }
  };

  // Close dropdown on outside click with auto-commit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (query.trim()) {
          commitQuery(query);
        }
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, checkpostsList]);

  // Filter checkposts based on query and sector pill
  const filteredList = useMemo(() => {
    return checkpostsList.filter(cp => {
      // Sector filter
      if (selectedSectorPill !== 'ALL') {
        if (!cp.sector.toLowerCase().includes(selectedSectorPill.toLowerCase())) {
          return false;
        }
      }
      // Search query filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const match =
          cp.name.toLowerCase().includes(q) ||
          cp.id.toLowerCase().includes(q) ||
          cp.code.toLowerCase().includes(q) ||
          cp.sector.toLowerCase().includes(q) ||
          cp.state.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [checkpostsList, query, selectedSectorPill]);

  // Check if query is a custom typed checkpost
  const isCustomCandidate = useMemo(() => {
    if (!query.trim()) return false;
    const q = query.trim().toLowerCase();
    const exactMatch = checkpostsList.some(
      c => c.name.toLowerCase() === q || c.id.toLowerCase() === q || c.code.toLowerCase() === q
    );
    return !exactMatch;
  }, [query, checkpostsList]);

  const handleSelect = (cp: CheckpostItem) => {
    onChange({
      id: cp.id,
      name: cp.name,
      type: cp.type || 'BOP',
      sector: cp.sector,
      state: cp.state,
      latitude: cp.latitude,
      longitude: cp.longitude
    });
    setQuery('');
    setIsOpen(false);
  };

  const handleSelectCustom = () => {
    if (!query.trim()) return;
    commitQuery(query);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs font-mono">
      {/* Search & Selection Input Field */}
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-[#090d16] border rounded-xl transition-all ${
          isOpen ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-[#1e293b] hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={selectedItem ? `${selectedItem.name} (${selectedItem.id})` : placeholder}
          value={isOpen ? query : (selectedItem ? `${selectedItem.name} (${selectedItem.id})` : value || '')}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!isOpen) {
              setIsOpen(true);
              setQuery('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (query.trim()) {
                commitQuery(query);
                setIsOpen(false);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none font-mono"
        />

        {query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-500 hover:text-slate-300 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(!isOpen);
          }}
          className="p-1 text-slate-500 hover:text-slate-300 rounded"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#0b101b] border border-slate-700 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col">
          {/* Quick Sector Filters */}
          <div className="p-2 border-b border-slate-800 bg-[#090d16] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-slate-500 font-bold shrink-0 uppercase px-1">Sectors:</span>
            {SECTOR_PILLS.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedSectorPill(pill)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedSectorPill === pill
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Results Summary & Custom Entry Alert */}
          <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {filteredList.length} checkpost{filteredList.length !== 1 ? 's' : ''} available
            </span>
            {selectedSectorPill !== 'ALL' && (
              <span className="text-emerald-400 font-bold">Filtered: {selectedSectorPill}</span>
            )}
          </div>

          {/* Items List */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-800/40">
            {/* Custom Option If Typed Something New */}
            {isCustomCandidate && (
              <button
                type="button"
                onClick={handleSelectCustom}
                className="w-full text-left p-2.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 flex items-center justify-between gap-2 transition cursor-pointer my-1"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-500/20 text-emerald-300">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-[11px]">Use Custom Checkpost: &quot;{query}&quot;</div>
                    <div className="text-[10px] text-emerald-400/80">
                      Auto-generate ID: BOP-{query.toUpperCase().replace(/[^A-Z0-9]/g, '-')}
                    </div>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold">CLICK TO ASSIGN</span>
              </button>
            )}

            {filteredList.length === 0 && !isCustomCandidate ? (
              <div className="p-6 text-center text-slate-500">
                <MapPin className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-slate-400" />
                <div className="text-slate-400 font-bold">No checkposts found matching &quot;{query}&quot;</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Type any custom name above to create a new checkpost allocation.
                </div>
              </div>
            ) : (
              filteredList.map((cp) => {
                const isSelected = value && (value.toUpperCase() === cp.id.toUpperCase() || value.toUpperCase() === cp.name.toUpperCase());
                const sectorStyle = getSectorBadgeColor(cp.sector);
                return (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => handleSelect(cp)}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <div className="truncate">
                        <div className="font-bold text-white text-[11px] truncate flex items-center gap-1.5">
                          <span>{cp.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({cp.code})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="text-slate-500">{cp.id}</span>
                          <span>•</span>
                          <span>{cp.state}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${sectorStyle.bg} ${sectorStyle.text} ${sectorStyle.border}`}>
                        {cp.sector}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
