import api from './api';

export interface DemoScenario {
  id: string;
  name: string;
  steps_count: number;
  description: string;
}

export interface DemoStatus {
  demo_active: boolean;
  current_scenario: string | null;
  current_step: number;
  step_history: Array<{
    scenario: string;
    step: number;
    timestamp: string;
    action: string;
    title: string;
    details: Record<string, any>;
    status: string;
  }>;
  artifacts: Record<string, string>;
  demo_mode_enabled?: boolean;
}

export const demoService = {
  getStatus: async (): Promise<DemoStatus> => {
    const res = await api.get<DemoStatus>('/demo/status');
    return res.data;
  },

  listScenarios: async (): Promise<DemoScenario[]> => {
    const res = await api.get<DemoScenario[]>('/demo/scenarios');
    return res.data;
  },

  runScenario: async (data: { scenario_id: string; step_index?: number; auto_run_all?: boolean }) => {
    const res = await api.post('/demo/run-scenario', data);
    return res.data;
  },

  resetDemo: async () => {
    const res = await api.post('/demo/reset');
    return res.data;
  }
};
