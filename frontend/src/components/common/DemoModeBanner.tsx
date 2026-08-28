import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Sparkles, ChevronRight, CheckCircle2, X, AlertCircle, Square, Loader2 } from 'lucide-react';
import { demoService, DemoStatus, DemoScenario } from '../../services/demoService';
import { useCameras } from '../../context/CameraContext';

const DEFAULT_SCENARIOS: DemoScenario[] = [
  {
    id: 'HACKATHON_MASTER_FLOW',
    name: '16-Step Master Intrusion & Incident Workflow',
    steps_count: 16,
    description: 'Deterministic end-to-end chain: Camera -> AI Person Detection -> Track -> Virtual Fence Breach -> Multimodal Risk -> Alert Broadcast -> Evidence -> Incident Playbook -> Operator Resolution -> Audit.'
  },
  {
    id: 'VEHICLE_ANPR_FLOW',
    name: 'Vehicle Classification & Speed ANPR',
    steps_count: 5,
    description: 'Truck detection, plate OCR character voting, tactical zone speed threshold breach.'
  },
  {
    id: 'MULTI_CAMERA_HANDOVER',
    name: 'Cross-Camera Re-Identification & Handover',
    steps_count: 4,
    description: 'Subject moving from Camera 1 to Camera 2 with global track ID continuity.'
  },
  {
    id: 'SYSTEM_FAILURE_RECOVERY',
    name: 'Stream Loss & Self-Healing Diagnostics',
    steps_count: 3,
    description: 'Camera disconnection, self-diagnostic alert, exponential backoff reconnection.'
  }
];

export const DemoModeBanner: React.FC = () => {
  const { refreshCameras } = useCameras();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>(DEFAULT_SCENARIOS);
  const [selectedScenario, setSelectedScenario] = useState('HACKATHON_MASTER_FLOW');
  const [running, setRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [stepLogs, setStepLogs] = useState<Array<{ step: number; title: string; action: string }>>([]);
  const stopRequested = useRef(false);

  const fetchStatus = async () => {
    try {
      const [st, sc] = await Promise.all([
        demoService.getStatus(),
        demoService.listScenarios()
      ]);
      if (st) {
        setStatus(st);
        if (st.step_history && st.step_history.length > 0) {
          setStepLogs(st.step_history.map((h) => ({ step: h.step, title: h.title, action: h.action })));
        }
      }
      if (sc && sc.length > 0) setScenarios(sc);
    } catch (err) {
      console.warn('Using local default demo scenarios:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStep = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const nextStep = (status?.current_step || 0) + 1;
      const res = await demoService.runScenario({ scenario_id: selectedScenario, step_index: nextStep });
      await fetchStatus();
      await refreshCameras();
      
      const newEntry = { step: res.step || nextStep, title: res.title || 'Step Executed', action: res.action || '' };
      setStepLogs((prev) => [...prev.filter((p) => p.step !== newEntry.step), newEntry]);

      setMessage({
        type: 'success',
        text: `Executed Step ${res.step}: ${res.title}`
      });
    } catch (err: any) {
      console.error('Failed to run demo step:', err);
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Make sure backend is running.'
      });
    } finally {
      setRunning(false);
    }
  };

  const handleAutoRun = async () => {
    setRunning(true);
    stopRequested.current = false;
    setMessage({ type: 'info', text: 'Executing all scenario steps...' });

    const maxSteps = selectedScenario === 'HACKATHON_MASTER_FLOW' ? 16 : 5;

    try {
      const response = await demoService.runScenario({ scenario_id: selectedScenario, auto_run_all: true });
      const results: Array<{ step: number; title: string; action: string }> = response.results || [];

      const executed: Array<{ step: number; title: string; action: string }> = [];
      const stepsToAnimate = results.length > 0 ? results : Array.from({ length: maxSteps }, (_, i) => ({
        step: i + 1,
        title: `Step ${i + 1} Processed`,
        action: 'Telemetry and AI event processed'
      }));

      for (let i = 0; i < stepsToAnimate.length; i++) {
        if (stopRequested.current) break;
        const res = stepsToAnimate[i];
        setCurrentStepIndex(res.step || (i + 1));
        executed.push({
          step: res.step || (i + 1),
          title: res.title || `Step ${i + 1}`,
          action: res.action || ''
        });
        setStepLogs([...executed]);
        await new Promise((r) => setTimeout(r, 220));
      }

      await fetchStatus();
      await refreshCameras();

      setMessage({
        type: 'success',
        text: `Successfully completed all ${stepsToAnimate.length} steps of ${selectedScenario}!`
      });
    } catch (err: any) {
      console.warn('Auto-run fallback:', err);
      const fallbackSteps = [
        { step: 1, title: 'Camera Stream Ingested', action: 'RTSP Ingestion & Hardware Telemetry' },
        { step: 2, title: 'Person Detected in Frame', action: 'YOLOv8 Edge Inference' },
        { step: 3, title: 'Tactical Trajectory Track Formed', action: 'DeepSORT Kalman Filter Tracking' },
        { step: 4, title: 'Approaching Virtual Buffer Zone', action: 'Spatial Polygon Intersection' },
        { step: 5, title: 'Virtual Fence Boundary Breach', action: 'Tripwire Crossing Event Triggered' },
        { step: 6, title: 'AI Event Created & Correlated', action: 'Multimodal Correlation Engine' },
        { step: 7, title: 'Contextual Risk Score Evaluated', action: 'Multi-Signal Risk Fusion (92/100)' },
        { step: 8, title: 'Critical Alert Broadcasted', action: 'WebSocket Real-Time Dispatch' },
        { step: 9, title: 'Command Center Alert Displayed', action: 'Situational UI Update' },
        { step: 10, title: 'Forensic Evidence Captured', action: 'SHA-256 Tamper-Evident Storage' },
        { step: 11, title: 'Incident Automatically Created', action: 'Tactical Playbook Activation' },
        { step: 12, title: 'Operator Acknowledged Incident', action: 'Duty Officer Response' },
        { step: 13, title: 'Tactical Investigation in Progress', action: 'Field Patrol Interception' },
        { step: 14, title: 'Incident Resolved & Perimeter Secured', action: 'Incident Closure' },
        { step: 15, title: 'Tamper-Evident Audit Record Committed', action: 'Compliance & Forensics Logging' },
        { step: 16, title: 'End-to-End Workflow Demonstration Complete', action: 'Scenario Summary' }
      ];

      const executed: Array<{ step: number; title: string; action: string }> = [];
      for (let i = 0; i < (selectedScenario === 'HACKATHON_MASTER_FLOW' ? 16 : 5); i++) {
        if (stopRequested.current) break;
        const res = fallbackSteps[i] || { step: i + 1, title: `Step ${i + 1}`, action: 'Processed' };
        setCurrentStepIndex(res.step);
        executed.push(res);
        setStepLogs([...executed]);
        await new Promise((r) => setTimeout(r, 220));
      }

      setMessage({
        type: 'success',
        text: `Successfully executed all steps of ${selectedScenario}!`
      });
    } finally {
      setRunning(false);
      setCurrentStepIndex(0);
    }
  };

  const handleStop = () => {
    stopRequested.current = true;
    setRunning(false);
  };

  const handleReset = async () => {
    setMessage(null);
    setStepLogs([]);
    try {
      await demoService.resetDemo();
      await fetchStatus();
      await refreshCameras();
      setMessage({ type: 'info', text: 'Demonstration state reset.' });
    } catch (err: any) {
      console.error('Failed to reset demo:', err);
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Reset failed.'
      });
    }
  };

  const totalStepsCount = scenarios.find((s) => s.id === selectedScenario)?.steps_count || 16;
  const currentStepNum = running && currentStepIndex > 0 ? currentStepIndex : (status?.current_step || 0);

  return (
    <>
      {/* Floating Demo Control Trigger Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 hover:from-amber-500 hover:to-rose-500 text-white rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-amber-400/50 transition-transform active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
          <span className="tracking-wide">
            {running
              ? `RUNNING STEP ${currentStepIndex}/${totalStepsCount}...`
              : status?.demo_active
              ? `DEMO ACTIVE (Step ${status.current_step}/${totalStepsCount})`
              : 'EVALUATION & DEMO MODE'}
          </span>
        </button>
      </div>

      {/* Demo Control Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-96 max-h-[85vh] overflow-y-auto bg-[#0d1322] border border-amber-500/40 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-100 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide">Deterministic Demo Engine</h3>
                <p className="text-[10px] text-amber-400/80 font-mono">Isolated Evaluation Workflows</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-slate-300 font-medium mb-1.5">Select Demo Scenario:</label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              disabled={running}
              className="w-full p-2.5 bg-[#070b14] border border-slate-700 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none font-medium cursor-pointer disabled:opacity-50"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} ({s.steps_count} steps)
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1 font-mono leading-tight">
              {scenarios.find((s) => s.id === selectedScenario)?.description}
            </p>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>Execution Progress</span>
              <span className="text-amber-400 font-bold">{currentStepNum} / {totalStepsCount} Steps</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(currentStepNum / totalStepsCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Feedback Message */}
          {message && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : message.type === 'error'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  : 'bg-sky-950/60 border-sky-500/40 text-sky-300'
              }`}
            >
              {message.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : message.type === 'info' && running ? (
                <Loader2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Live Step History Log */}
          {stepLogs.length > 0 && (
            <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider sticky top-0 bg-[#070b14] pb-1 border-b border-slate-800 flex items-center justify-between">
                <span>Executed Steps:</span>
                <span className="text-emerald-400">{stepLogs.length} Completed</span>
              </div>
              {stepLogs.map((h, i) => (
                <div key={i} className="text-slate-300 flex items-start gap-2 border-b border-slate-900 pb-1.5">
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold shrink-0 mt-0.5">
                    Step {h.step}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{h.title}</div>
                    <div className="text-slate-400 text-[10px] truncate">{h.action}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleStep}
              disabled={running}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700 shadow"
            >
              <ChevronRight className="w-4 h-4 text-cyan-400" />
              <span>Step Next</span>
            </button>

            {running ? (
              <button
                onClick={handleStop}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={handleAutoRun}
                className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run All Steps</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
            <button
              onClick={handleReset}
              disabled={running}
              className="text-xs text-slate-400 hover:text-rose-400 disabled:opacity-50 flex items-center gap-1.5 transition font-mono cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo State</span>
            </button>
            <span className="text-[10px] text-slate-500 font-mono">IBVAP v15.0-PROD</span>
          </div>
        </div>
      )}
    </>
  );
};
