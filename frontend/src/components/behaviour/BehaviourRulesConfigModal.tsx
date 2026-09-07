import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { BehaviourRule } from '../../types/behaviour';
import { behaviourService } from '../../services/behaviourService';
import { Save, Plus, ToggleLeft, ToggleRight, Sliders, CheckCircle2, Trash2, Play, Sparkles } from 'lucide-react';

interface BehaviourRulesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const RULE_TEMPLATES = [
  {
    name: 'Perimeter Fence Loitering (Dwell Anomaly)',
    eventType: 'POTENTIAL_PERIMETER_PROBING_PATTERN',
    description: 'Triggers elevated alert when targets linger within 15 meters of perimeter wire.',
    dwell: 20,
    speed: 1.5,
    riskWeight: 25,
    cooldown: 60
  },
  {
    name: 'Sudden Sprint & Running (Acceleration Burst)',
    eventType: 'SUDDEN_SPEED_CHANGE',
    description: 'Detects rapid acceleration bursts (> 4.0 m/s) indicating rushed breach or evasion.',
    dwell: 5,
    speed: 4.2,
    riskWeight: 30,
    cooldown: 45
  },
  {
    name: 'Perimeter Probing (Repeated Approach & Retreat)',
    eventType: 'REPEATED_APPROACH',
    description: 'Detects reconnaissance patterns where a subject approaches the fence and backs off multiple times.',
    dwell: 15,
    speed: 2.0,
    riskWeight: 35,
    cooldown: 90
  },
  {
    name: 'Kinetic Zig-Zag (Rapid Direction Changes)',
    eventType: 'RAPID_DIRECTION_CHANGE',
    description: 'Identifies non-linear evasive trajectories avoiding sensor tripwire zones.',
    dwell: 10,
    speed: 3.0,
    riskWeight: 20,
    cooldown: 60
  },
  {
    name: 'Restricted Night Window Curfew (22:00 - 05:00)',
    eventType: 'AFTER_HOURS_ACTIVITY',
    description: 'Automatic critical alert on any human movement during restricted zero-line nocturnal hours.',
    dwell: 10,
    speed: 1.0,
    riskWeight: 40,
    cooldown: 120
  }
];

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

  // Simulation Tester State
  const [testDwell, setTestDwell] = useState(25);
  const [testSpeed, setTestSpeed] = useState(4.5);
  const [testIsNight, setTestIsNight] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRules();
      setIsCreatingNew(false);
      setError(null);
      setSuccessMsg(null);
      setTestResult(null);
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
    setTestResult(null);
  };

  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedRule(null);
    setRuleId('');
    setName('');
    setDescription('');
    setEventType('POTENTIAL_PERIMETER_PROBING_PATTERN');
    setDwell(20);
    setSpeed(3.0);
    setRiskWeight(25);
    setCooldown(60);
    setIsEnabled(true);
    setError(null);
    setSuccessMsg(null);
    setTestResult(null);
  };

  const handleApplyTemplate = (tmpl: typeof RULE_TEMPLATES[0]) => {
    const rndSuffix = Math.floor(100 + Math.random() * 900);
    setRuleId(`RULE-${tmpl.eventType.substring(0, 10)}-${rndSuffix}`.toUpperCase());
    setName(tmpl.name);
    setDescription(tmpl.description);
    setEventType(tmpl.eventType);
    setDwell(tmpl.dwell);
    setSpeed(tmpl.speed);
    setRiskWeight(tmpl.riskWeight);
    setCooldown(tmpl.cooldown);
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

  const handleDeleteRule = async (targetRuleId: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete rule '${targetRuleId}'?`)) return;
    setSaving(true);
    try {
      await behaviourService.deleteBehaviourRule(targetRuleId);
      setSuccessMsg(`Rule '${targetRuleId}' deleted successfully.`);
      setSelectedRule(null);
      await loadRules();
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setEvaluating(true);
      const res = await behaviourService.testRuleEvaluation({
        rule_id: ruleId || selectedRule?.rule_id || 'RULE-PREVIEW',
        dwell_sec: testDwell,
        speed_ms: testSpeed,
        stop_count: 2,
        direction_changes: 3,
        is_night: testIsNight
      });
      setTestResult(res);
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setEvaluating(false);
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
      <div className="space-y-6 font-mono text-xs p-2">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
                <Plus className="w-3 h-3" /> + NEW RULE
              </button>
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
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
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            r.is_enabled
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-900 text-slate-500'
                          }`}
                        >
                          {r.is_enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRule(r.rule_id);
                          }}
                          className="p-1 hover:bg-red-900/60 text-slate-500 hover:text-red-300 rounded transition"
                          title="Delete this rule"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
          <div className="md:col-span-8 space-y-4">
            {/* Template Selector when Creating */}
            {isCreatingNew && (
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-purple-300 uppercase flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Quick Rule Templates:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {RULE_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="p-2 bg-slate-900 hover:bg-purple-900/30 border border-slate-800 hover:border-purple-500/50 rounded-lg text-left transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px] text-white truncate">{tmpl.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{tmpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 p-5 bg-[#090d16] border border-[#1e293b] rounded-2xl shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    {isCreatingNew ? 'Define New Behaviour Rule' : name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isCreatingNew ? 'Configure sensitivity thresholds and automated trigger logic' : description}
                  </p>
                </div>

                {!isCreatingNew && selectedRule && (
                  <div className="flex items-center gap-2">
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
                      <span>{isEnabled ? 'ENABLED' : 'DISABLED'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(selectedRule.rule_id)}
                      className="p-2 bg-red-950/50 hover:bg-red-900/80 text-red-300 border border-red-800/80 rounded-lg text-xs transition cursor-pointer"
                      title="Delete this rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Rule ID (Unique Identifier) *</label>
                  <input
                    type="text"
                    required
                    disabled={!isCreatingNew}
                    value={ruleId}
                    onChange={(e) => setRuleId(e.target.value.toUpperCase())}
                    placeholder="e.g. RULE-LOITERING-01"
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Rule Designation Name *</label>
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
                  <label className="block text-[11px] text-slate-300 mb-1">Event Type Trigger *</label>
                  <select
                    value={eventType}
                    disabled={!isCreatingNew}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full bg-[#111a2e] border border-[#22324d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                  >
                    <option value="POTENTIAL_PERIMETER_PROBING_PATTERN">Perimeter Probing Pattern</option>
                    <option value="SUDDEN_SPEED_CHANGE">Sudden Speed Change / Sprint</option>
                    <option value="REPEATED_APPROACH">Repeated Boundary Approach & Retreat</option>
                    <option value="RAPID_DIRECTION_CHANGE">Rapid Direction Change / Zig-Zag</option>
                    <option value="FENCE_EDGE_MOVEMENT">Fence-Edge Parallel Movement</option>
                    <option value="AFTER_HOURS_ACTIVITY">Restricted Night Window Curfew</option>
                    <option value="VEHICLE_DWELL_ANOMALY">Vehicle Dwell & Stationary Loiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Description / Tactical Rationale</label>
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
                    min={3}
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
                  <span className="text-[9px] text-slate-500 mt-1 block">Sprint burst trigger</span>
                </div>

                <div className="p-3 bg-[#111a2e] border border-slate-800 rounded-xl">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Risk Weight</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={riskWeight}
                    onChange={(e) => setRiskWeight(Number(e.target.value))}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Score increment (+25)</span>
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
                  <span className="text-[9px] text-slate-500 mt-1 block">Anti-flood interval</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-purple-900/30 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving Rule...' : isCreatingNew ? 'Create & Activate Rule' : 'Update Sensitivity Thresholds'}</span>
                </button>
              </div>
            </form>

            {/* Dry-Run Rule Evaluation Simulator */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  Dry-Run Rule Simulation Tester:
                </span>
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={evaluating}
                  className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 rounded text-[11px] font-bold transition cursor-pointer"
                >
                  {evaluating ? 'Simulating...' : 'Test Evaluate Rule'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block">Simulated Dwell (s):</label>
                  <input
                    type="number"
                    value={testDwell}
                    onChange={(e) => setTestDwell(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Simulated Speed (m/s):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testSpeed}
                    onChange={(e) => setTestSpeed(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Night Curfew Active:</label>
                  <button
                    type="button"
                    onClick={() => setTestIsNight(!testIsNight)}
                    className={`w-full mt-0.5 py-1 rounded text-xs font-mono font-bold border transition ${
                      testIsNight ? 'bg-amber-950 border-amber-600 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {testIsNight ? '🌙 YES (Night)' : '☀️ NO (Day)'}
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className={testResult.triggered ? 'text-rose-400' : 'text-emerald-400'}>
                      {testResult.triggered ? '🚨 TRIGGERED: ANOMALY DETECTED' : '✅ NOT TRIGGERED: NOMINAL TRAJECTORY'}
                    </span>
                    <span className="text-purple-300 font-mono">Calculated Risk: {testResult.risk_score} / 100</span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    {testResult.factors.map((f: string, i: number) => (
                      <div key={i} className="text-amber-300 font-mono">• {f}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
