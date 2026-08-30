import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { BehaviourRule } from '../../types/behaviour';
import { behaviourService } from '../../services/behaviourService';
import { Save, Plus, ToggleLeft, ToggleRight, Sliders, CheckCircle2 } from 'lucide-react';

interface BehaviourRulesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const BehaviourRulesConfigModal: React.FC<BehaviourRulesConfigModalProps> = ({
  isOpen,
  onClose,
  onUpdated
}) => {
  const [rules, setRules] = useState<BehaviourRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<BehaviourRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Edit / Form states
  const [ruleId, setRuleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('POTENTIAL_PERIMETER_PROBING_PATTERN');
  const [dwell, setDwell] = useState(30);
  const [speed, setSpeed] = useState(4.0);
  const [riskWeight, setRiskWeight] = useState(25);
  const [cooldown, setCooldown] = useState(60);
  const [isEnabled, setIsEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRules();
      setIsCreatingNew(false);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const loadRules = async () => {
    try {
      const data = await behaviourService.getBehaviourRules();
      setRules(data);
      if (data.length > 0 && !selectedRule) {
        selectRule(data[0]);
      }
    } catch (e) {
      console.error('Failed to load behaviour rules', e);
    }
  };

  const selectRule = (rule: BehaviourRule) => {
    setIsCreatingNew(false);
    setSelectedRule(rule);
    setRuleId(rule.rule_id);
    setName(rule.name);
    setDescription(rule.description || '');
    setEventType(rule.event_type);
    setDwell(rule.dwell_threshold_sec);
    setSpeed(rule.speed_threshold_ms);
    setRiskWeight(rule.base_risk_weight);
    setCooldown(rule.cooldown_sec);
    setIsEnabled(rule.is_enabled);
    setError(null);
    setSuccessMsg(null);
  };

  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedRule(null);
    const rndSuffix = Math.floor(1000 + Math.random() * 9000);
    setRuleId(`RULE-CUSTOM-${rndSuffix}`);
    setName('Perimeter Dwell & Loitering Rule');
    setDescription('Triggers automated threat scoring when tracks linger near border wire.');
    setEventType('POTENTIAL_PERIMETER_PROBING_PATTERN');
    setDwell(25);
    setSpeed(3.5);
    setRiskWeight(30);
    setCooldown(45);
    setIsEnabled(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleToggleActive = async () => {
    if (!selectedRule) return;
    setSaving(true);
    try {
      await behaviourService.updateBehaviourRule(selectedRule.rule_id, {
        is_enabled: !isEnabled,
        changed_by: 'operator'
      });
      setIsEnabled(!isEnabled);
      setSuccessMsg(`Rule '${selectedRule.name}' ${!isEnabled ? 'ENABLED' : 'DISABLED'}.`);
      await loadRules();
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isCreatingNew) {
        if (!ruleId.trim() || !name.trim()) {
          setError('Please provide Rule ID and Name.');
          setSaving(false);
          return;
        }
        await behaviourService.createBehaviourRule({
          rule_id: ruleId.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          event_type: eventType,
          dwell_threshold_sec: Number(dwell),
          speed_threshold_ms: Number(speed),
          base_risk_weight: Number(riskWeight),
          cooldown_sec: Number(cooldown),
          is_enabled: isEnabled
        });
        setSuccessMsg(`Rule '${name}' successfully registered and activated!`);
        setIsCreatingNew(false);
      } else if (selectedRule) {
        await behaviourService.updateBehaviourRule(selectedRule.rule_id, {
          name: name.trim(),
          description: description.trim(),
          dwell_threshold_sec: Number(dwell),
          speed_threshold_ms: Number(speed),
          base_risk_weight: Number(riskWeight),
          cooldown_sec: Number(cooldown),
          is_enabled: isEnabled,
          changed_by: 'operator'
        });
        setSuccessMsg(`Rule '${name}' updated with new sensitivity thresholds!`);
      }
      await loadRules();
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Behaviour Intelligence Rules & Thresholds Engine"
      subtitle="Configure sensitivity thresholds, kinetic parameters, risk weights, and automated intrusion rules"
      maxWidth="4xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Rules List Sidebar (4 cols) */}
          <div className="md:col-span-4 space-y-3 border-r border-slate-800 pr-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                CONFIGURED RULES ({rules.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreateNew}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-bold transition cursor-pointer"
              >
                <Plus className="w-3 h-3" /> ADD RULE
              </button>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {rules.map((r) => {
                const isSelected = !isCreatingNew && selectedRule?.rule_id === r.rule_id;
                return (
                  <div
                    key={r.rule_id}
                    onClick={() => selectRule(r)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 text-white shadow-md'
                        : 'bg-[#090d16] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate max-w-[170px]">{r.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          r.is_enabled
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-900 text-slate-500'
                        }`}
                      >
                        {r.is_enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                      <span className="truncate max-w-[140px]">{r.rule_id}</span>
                      <span className="text-purple-400 font-bold">Risk +{r.base_risk_weight}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Area (8 cols) */}
          <form onSubmit={handleSubmit} className="md:col-span-8 space-y-4 p-5 bg-[#090d16] border border-[#1e293b] rounded-2xl shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  {isCreatingNew ? 'Define New Behaviour Rule' : name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isCreatingNew ? 'Register a new behavioural detection constraint' : description}
                </p>
              </div>

              {!isCreatingNew && selectedRule && (
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                    isEnabled
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-300'
                  }`}
                  title={isEnabled ? 'Click to Disable Rule' : 'Click to Enable Rule'}
                >
                  {isEnabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                  <span>{isEnabled ? 'RULE ENABLED' : 'RULE DISABLED'}</span>
                </button>
              )}
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Rule ID (Unique Identifier)</label>
                <input
                  type="text"
                  required
                  disabled={!isCreatingNew}
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value.toUpperCase())}
                  placeholder="RULE-LOITERING-01"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Rule Designation Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Restricted Fence Loitering"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Event Type Trigger</label>
                <select
                  value={eventType}
                  disabled={!isCreatingNew}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                >
                  <option value="POTENTIAL_PERIMETER_PROBING_PATTERN">Perimeter Probing Pattern</option>
                  <option value="RAPID_DIRECTION_CHANGE">Rapid Direction Change / Zig-Zag</option>
                  <option value="VEHICLE_DWELL_ANOMALY">Vehicle Dwell & Stationary Loiter</option>
                  <option value="SUDDEN_ACCELERATION_SPRINT">Sudden Sprint / Speed Burst</option>
                  <option value="REPEATED_BOUNDARY_APPROACH">Repeated Boundary Approach</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operational trigger explanation"
                  className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Threshold Sliders / Numeric Inputs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-[#111a2e] border border-slate-800 rounded-xl">
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Dwell (Sec)</label>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={dwell}
                  onChange={(e) => setDwell(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Min linger duration</span>
              </div>

              <div className="p-3 bg-[#111a2e] border border-slate-800 rounded-xl">
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Speed (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={25.0}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Velocity trigger</span>
              </div>

              <div className="p-3 bg-[#111a2e] border border-slate-800 rounded-xl">
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Risk Weight</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={riskWeight}
                  onChange={(e) => setRiskWeight(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded px-2 py-1 text-xs text-amber-400 font-mono font-bold"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Score increment</span>
              </div>

              <div className="p-3 bg-[#111a2e] border border-slate-800 rounded-xl">
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Cooldown (Sec)</label>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Alert suppression</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold tracking-wider transition shadow-lg shadow-purple-600/30 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'SAVING...' : isCreatingNew ? 'CREATE RULE' : 'SAVE THRESHOLDS'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};
