import api from './api';
import {
  BehaviourEvent,
  BehaviourRule,
  BehaviourRuleCreate,
  ActivityBaseline,
  BehaviourFeedback,
  ExplainableRiskResponse,
  BehaviourAnalyticsSummary
} from '../types/behaviour';

export const behaviourService = {
  // Events Feed
  async getBehaviourEvents(params?: {
    risk_level?: string;
    event_type?: string;
    camera_id?: string;
    global_track_id?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }): Promise<BehaviourEvent[]> {
    const response = await api.get<BehaviourEvent[]>('/behaviour/events', { params });
    return response.data;
  },

  async getBehaviourEvent(eventId: string): Promise<BehaviourEvent> {
    const response = await api.get<BehaviourEvent>(`/behaviour/events/${eventId}`);
    return response.data;
  },

  // Explainable Risk Assessment
  async getTrackRiskAssessment(trackId: string, params?: Record<string, any>): Promise<ExplainableRiskResponse> {
    const response = await api.get<ExplainableRiskResponse>(`/behaviour/assessments/${trackId}`, { params });
    return response.data;
  },

  // Rules Config
  async getBehaviourRules(): Promise<BehaviourRule[]> {
    const response = await api.get<BehaviourRule[]>('/behaviour/rules');
    return response.data;
  },

  async createBehaviourRule(data: BehaviourRuleCreate): Promise<BehaviourRule> {
    const response = await api.post<BehaviourRule>('/behaviour/rules', data);
    return response.data;
  },

  async updateBehaviourRule(ruleId: string, data: Partial<BehaviourRuleCreate> & { changed_by?: string }): Promise<BehaviourRule> {
    const response = await api.put<BehaviourRule>(`/behaviour/rules/${ruleId}`, data);
    return response.data;
  },

  // Baselines
  async getActivityBaselines(cameraId?: string): Promise<ActivityBaseline[]> {
    const response = await api.get<ActivityBaseline[]>('/behaviour/baselines', { params: { camera_id: cameraId } });
    return response.data;
  },

  // Operator Feedback
  async submitFeedback(data: {
    event_id: string;
    feedback_type: 'CORRECT_DETECTION' | 'FALSE_POSITIVE' | 'NEEDS_REVIEW';
    notes?: string;
    operator_username?: string;
  }): Promise<BehaviourFeedback> {
    const response = await api.post<BehaviourFeedback>('/behaviour/feedback', data);
    return response.data;
  },

  // Analytics
  async getAnalyticsSummary(): Promise<BehaviourAnalyticsSummary> {
    const response = await api.get<BehaviourAnalyticsSummary>('/behaviour/analytics/summary');
    return response.data;
  }
};
