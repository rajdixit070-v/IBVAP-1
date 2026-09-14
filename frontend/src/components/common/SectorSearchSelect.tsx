import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Globe, Check, Plus, ChevronDown, X, Sparkles, Shield } from 'lucide-react';

export interface SectorOption {
  id: string;
  name: string;
  description?: string;
  badgeColor?: string;
  isCustom?: boolean;
}

export interface SectorSearchSelectProps {
  value: string;
  onChange: (sector: string) => void;
  disabled?: boolean;
  placeholder?: string;
  availableSectors?: string[];
}

export const PREDEFINED_SECTORS: SectorOption[] = [
  {
    id: 'Punjab Frontier',
    name: 'Punjab Frontier',
    description: 'Indo-Pak Border • Wagah, Fazilka, Ferozepur, Attari, DBN',
    badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
  },
  {
    id: 'Rajasthan Frontier',
    name: 'Rajasthan Frontier',
    description: 'Thar Desert Sector • Jaisalmer, Longewala, Munabao, Tanot, Barmer',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  },
  {
    id: 'Jammu & Kashmir',
    name: 'Jammu & Kashmir',
    description: 'IB & Line of Control • RS Pura, Samba, Hiranagar, Uri, Poonch, Baramulla',
    badgeColor: 'border-rose-500/40 bg-rose-500/10 text-rose-300'
  },
  {
    id: 'Ladakh Sector',
    name: 'Ladakh Sector',
    description: 'High-Altitude LAC • DBO, Galwan, Pangong Tso, Nyoma, Chushul',
    badgeColor: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
  },
  {
    id: 'Gujarat / Kutch',
    name: 'Gujarat / Kutch',
    description: 'Creek & Salt Desert Sector • Harami Nala, Sir Creek, Khavda, Lakhpat',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  },
  {
    id: 'Eastern Frontier',
    name: 'Eastern Frontier',
    description: 'Indo-Bangladesh & Myanmar Borders • Petrapole, Dawki, Hili, Moreh, Tripura',
    badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300'
  },
  {
    id: 'All Frontiers (National HQ)',
    name: 'All Frontiers (National HQ)',
    description: 'Delhi Central Command • Apex National Operations Room',
    badgeColor: 'border-blue-500/40 bg-blue-500/10 text-blue-300'
  }
];

const QUICK_FRONTIER_CHIPS = [
  'Punjab Frontier',
  'Rajasthan Frontier',
  'Jammu & Kashmir',
  'Ladakh Sector',
  'Gujarat / Kutch',
  'Eastern Frontier',
  'All Frontiers (National HQ)'
];

export const SectorSearchSelect: React.FC<SectorSearchSelectProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search frontier or type custom zone (e.g. Baramulla, Sikkim)...',
  availableSectors = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep internal text state synchronized with external value updates (e.g. checkpost pre-fills)
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Combine predefined canonical sectors with any dynamically supplied sectors from DB
  const sectorList = useMemo(() => {
    const map = new Map<string, SectorOption>();
    PREDEFINED_SECTORS.forEach((s) => map.set(s.id.toLowerCase(), s));

    availableSectors.forEach((secStr) => {
      const clean = (secStr || '').trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), {
          id: clean,
          name: clean,
          description: 'Registered Frontier / Tactical Command Zone',
          badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
          isCustom: true
        });
      }
    });

    return Array.from(map.values());
  }, [availableSectors]);

  // Determine if current input matches a standard known frontier
  const isStandard = useMemo(() => {
    const trimmed = (inputValue || '').trim().toLowerCase();
    if (!trimmed) return false;
    return PREDEFINED_SECTORS.some(
      (s) => s.id.toLowerCase() === trimmed || s.name.toLowerCase() === trimmed
    );
  }, [inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered list based on search query
  const filteredList = useMemo(() => {
    const q = (inputValue || '').trim().toLowerCase();
    if (!q) return sectorList;
    return sectorList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [sectorList, inputValue]);

  // Check if current typed string is a custom candidate
  const isCustomCandidate = useMemo(() => {
    const q = (inputValue || '').trim().toLowerCase();
    if (!q) return false;
    return !sectorList.some(
      (s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q
    );
  }, [inputValue, sectorList]);

  // Handle direct typing in the input: updates both local display and parent state in real time!
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInputValue(nextVal);
    onChange(nextVal);
    if (!isOpen) setIsOpen(true);
  };

  // Handle selecting an existing sector
  const handleSelectSector = (sec: SectorOption) => {
    setInputValue(sec.name);
    onChange(sec.name);
    setIsOpen(false);
  };

  // Handle quick chip click
  const handleSelectChip = (chipName: string) => {
    setInputValue(chipName);
    onChange(chipName);
    setIsOpen(false);
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    onChange('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs font-mono">
      {/* Input Box with Dual-Mode (Search & Direct Custom Typing) */}
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-[#090d16] border rounded-xl transition-all ${
          isOpen
            ? 'border-cyan-500 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-950/30'
            : 'border-[#1e293b] hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <Globe className={`w-3.5 h-3.5 shrink-0 ${isStandard ? 'text-cyan-400' : inputValue ? 'text-amber-400' : 'text-slate-500'}`} />

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setIsOpen(false);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none font-mono text-xs"
        />

        {/* Dynamic Status Tag */}
        {inputValue.trim() && (
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 hidden sm:inline-block ${
              isStandard
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
            }`}
          >
            {isStandard ? 'STANDARD' : 'CUSTOM ZONE'}
          </span>
        )}

        {/* Clear Button */}
        {inputValue && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 text-slate-500 hover:text-slate-200 rounded transition"
            title="Clear sector text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown Toggle Chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(!isOpen);
          }}
          className="p-1 text-slate-500 hover:text-cyan-400 rounded transition"
          title="Toggle sectors list"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isOpen ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>
      </div>

      {/* Interactive Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#0b101b] border border-slate-700 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col">
          {/* Header with Search & Custom Instructions */}
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-1">
            <span className="flex items-center gap-1 font-bold text-slate-300">
              <Globe className="w-3 h-3 text-cyan-400" />
              SEARCH OR TYPE DIRECTLY
            </span>
            <span className="text-cyan-400 font-bold">
              {filteredList.length} OPTION{filteredList.length !== 1 ? 'S' : ''} FOUND
            </span>
          </div>

          {/* Quick Select Chips Bar */}
          <div className="p-2 bg-[#080d16] border-b border-slate-800/80 space-y-1">
            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              Quick Standard Frontiers:
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_FRONTIER_CHIPS.map((chip) => {
                const isChipSelected = inputValue.trim().toLowerCase() === chip.toLowerCase();
                const shortLabel = chip.replace(' Frontier', '').replace(' Sector', '');
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSelectChip(chip)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition border cursor-pointer ${
                      isChipSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                        : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List Content Area */}
          <div className="overflow-y-auto flex-1 p-1.5 divide-y divide-slate-800/40 space-y-1">
            {/* Custom Sector Action Banner if user is typing a custom name */}
            {isCustomCandidate && (
              <div
                onClick={() => setIsOpen(false)}
                className="w-full text-left p-2.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 flex items-center justify-between gap-2 transition cursor-pointer mb-1 shadow-md shadow-cyan-950/40"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-cyan-500/20 text-cyan-300">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>Use Custom Sector: &quot;{inputValue.trim()}&quot;</span>
                    </div>
                    <div className="text-[10px] text-cyan-400/80">
                      Officer will be registered under this custom tactical frontier zone
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-[10px] font-bold shrink-0 border border-cyan-500/40">
                  APPLY CUSTOM ↵
                </span>
              </div>
            )}

            {/* List of Matching Sectors */}
            {filteredList.length === 0 && !isCustomCandidate ? (
              <div className="p-6 text-center text-slate-500 space-y-1">
                <Globe className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
                <div className="text-slate-300 font-bold text-xs">
                  No standard frontier found for &quot;{inputValue}&quot;
                </div>
                <div className="text-[10px] text-slate-500">
                  You can keep &quot;{inputValue}&quot; as a custom frontier sector.
                </div>
              </div>
            ) : (
              filteredList.map((sec) => {
                const isSelected =
                  inputValue && inputValue.trim().toLowerCase() === sec.name.trim().toLowerCase();
                const badgeStyle = sec.badgeColor || 'border-slate-500/40 bg-slate-500/10 text-slate-300';

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelectSector(sec)}
                    className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Shield
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      />
                      <div className="truncate">
                        <div className="font-bold text-white text-[11px] truncate flex items-center gap-1.5">
                          <span>{sec.name}</span>
                          {sec.isCustom && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        {sec.description && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {sec.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${badgeStyle}`}>
                        {sec.name.split(' ')[0]}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div className="px-3 py-1.5 bg-[#060a12] border-t border-slate-800 text-[9px] text-slate-500 flex items-center justify-between">
            <span>💡 Admin can select from list or freely type any custom command zone</span>
            <span className="font-bold text-slate-400">ESC TO CLOSE</span>
          </div>
        </div>
      )}
    </div>
  );
};
