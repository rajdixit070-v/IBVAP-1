import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { BehaviourRule } from '../../types/behaviour';
import { behaviourService } from '../../services/behaviourService';
import { Save } from 'lucide-react';

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
  const [dwell, setDwell] = useState(30);
  const [speed, setSpeed] = useState(4.0);
  const [riskWeight, setRiskWeight] = useState(25);
  const [cooldown, setCooldown] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRules();
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
    setSelectedRule(rule);
    setDwell(rule.dwell_threshold_sec);
    setSpeed(rule.speed_threshold_ms);
    setRiskWeight(rule.base_risk_weight);
    setCooldown(rule.cooldown_sec);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    setSaving(true);
    setError(null);
    try {
      await behaviourService.updateBehaviourRule(selectedRule.rule_id, {
        dwell_threshold_sec: dwell,
        speed_threshold_ms: speed,
        base_risk_weight: riskWeight,
        cooldown_sec: cooldown,
        changed_by: 'operator'
      });
      await loadRules();
      onUpdated();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Behaviour Intelligence Rules & Thresholds"
      subtitle="Configure sensitivity thresholds, kinetic parameters, risk weights, and cooldown limits"
      maxWidth="3xl"
    >
      <div className="space-y-6 font-mono text-xs">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rules List Sidebar */}
          <div className="space-y-2 border-r border-slate-800 pr-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              CONFIGURED RULES ({rules.length})
            </span>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rules.map((r) => {
                const isSelected = selectedRule?.rule_id === r.rule_id;
                return (
                  <div
                    key={r.id}
                    onClick={() => selectRule(r)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#15233c] border-sky-500 text-white'
                        : 'bg-[#090d16] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{r.name}</div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                      <span>{r.event_type}</span>
                      <span className="text-sky-400">v{r.rule_version}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Form */}
          {selectedRule ? (
            <form onSubmit={handleUpdate} className="md:col-span-2 space-y-4 p-4 bg-[#090d16] border border-[#1e293b] rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedRule.name}</h4>
                  <p className="text-[10px] text-slate-400">{selectedRule.description}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                  VERSION {selectedRule.rule_version}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Dwell Threshold (seconds)</label>
                  <input
                    type="number"
                    min={5}
                    value={dwell}
                    onChange={(e) => setDwell(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Speed Threshold (m/s)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Base Risk Weight (points)</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={riskWeight}
                    onChange={(e) => setRiskWeight(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Alert Cooldown (seconds)</label>
                  <input
                    type="number"
                    min={10}
                    value={cooldown}
                    onChange={(e) => setCooldown(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#111a2e] border border-[#1e293b] rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-lg disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'SAVING...' : 'SAVE RULE (INCREMENT VERSION)'}
                </button>
              </div>
            </form>
          ) : (
            <div className="md:col-span-2 text-center text-slate-500 p-12">
              Select a behaviour rule to modify parameters.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
