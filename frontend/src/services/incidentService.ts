import api from './api';
import {
  Incident,
  IncidentAnalyticsSummary,
  IncidentPlaybook,
  IncidentReview,
  Alert,
  Notification,
  Evidence,
  IncidentCreate
} from '../types/incident';

export const incidentService = {
  // Alerts
  async getAlerts(params?: { status?: string; priority?: string; limit?: number }): Promise<Alert[]> {
    const response = await api.get<Alert[]>('/alerts', { params });
    return response.data;
  },

  async acknowledgeAlert(alertId: string, assignedTo?: string): Promise<Alert> {
    const response = await api.post<Alert>(`/alerts/${alertId}/acknowledge`, {
      assigned_to: assignedTo
    });
    return response.data;
  },

  // Notifications
  async getNotifications(params?: { is_read?: boolean; limit?: number } | boolean): Promise<Notification[]> {
    const query = typeof params === 'boolean' ? { is_read: params } : params;
    const response = await api.get<Notification[]>('/notifications', { params: query });
    return response.data;
  },

  async markAllNotificationsRead(): Promise<any> {
    const response = await api.post('/notifications/read-all');
    return response.data;
  },

  // Incidents
  async getIncidents(params?: {
    status?: string;
    priority?: string;
    incident_type?: string;
    camera_id?: string;
    bop_site?: string;
    assigned_to?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }): Promise<Incident[]> {
    const response = await api.get<Incident[]>('/incidents', { params });
    return response.data;
  },

  async getIncident(incidentId: string): Promise<Incident> {
    const response = await api.get<Incident>(`/incidents/${incidentId}`);
    return response.data;
  },

  async getIncidentDetail(incidentId: string): Promise<Incident> {
    return this.getIncident(incidentId);
  },

  async getIncidentEvidence(incidentId: string): Promise<Evidence[]> {
    const response = await api.get<Evidence[]>(`/evidence/incident/${incidentId}`);
    return response.data;
  },

  async createIncident(data: IncidentCreate): Promise<Incident> {
    const response = await api.post<Incident>('/incidents', data);
    return response.data;
  },

  async triageIncident(incidentId: string, data: {
    priority?: string;
    playbook_id?: string;
    notes?: string;
    actor_username?: string;
    version?: number;
  }): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/triage`, data);
    return response.data;
  },

  async assignIncident(
    incidentId: string,
    data: {
      assigned_to: string;
      assigned_team?: string;
      assigned_unit?: string;
      notes?: string;
      actor_username?: string;
      version?: number;
    } | string,
    unitParam?: string
  ): Promise<Incident> {
    let payload;
    if (typeof data === 'string') {
      payload = { assigned_to: data, assigned_unit: unitParam, assigned_team: unitParam };
    } else {
      payload = data;
    }
    const response = await api.post<Incident>(`/incidents/${incidentId}/assign`, payload);
    return response.data;
  },

  async updateChecklistStep(incidentId: string, data: {
    step_id: number;
    is_completed: boolean;
    notes?: string;
    actor_username?: string;
  }): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/checklist/step`, data);
    return response.data;
  },

  async escalateIncident(incidentId: string, data: {
    reason: string;
    target_level?: number;
    notes?: string;
    actor_username?: string;
    version?: number;
  } | string): Promise<Incident> {
    const payload = typeof data === 'string' ? { reason: data } : data;
    const response = await api.post<Incident>(`/incidents/${incidentId}/escalate`, payload);
    return response.data;
  },

  async respondIncident(incidentId: string, data: {
    notes?: string;
    actor_username?: string;
    version?: number;
  }): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/respond`, data);
    return response.data;
  },

  async containIncident(incidentId: string, data: {
    notes?: string;
    actor_username?: string;
    version?: number;
  }): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/contain`, data);
    return response.data;
  },

  async resolveIncident(incidentId: string, data: {
    resolution_category?: string;
    resolution_notes: string;
    actor_username?: string;
    version?: number;
  } | string): Promise<Incident> {
    const payload = typeof data === 'string'
      ? { resolution_category: 'Resolved', resolution_notes: data }
      : { resolution_category: data.resolution_category || 'Resolved', resolution_notes: data.resolution_notes };
    const response = await api.post<Incident>(`/incidents/${incidentId}/resolve`, payload);
    return response.data;
  },

  async markFalseAlarm(incidentId: string, reason: string, notes?: string): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/resolve`, {
      resolution_category: 'False Alarm',
      resolution_notes: `[False Alarm Reason: ${reason}] ${notes || ''}`
    });
    return response.data;
  },

  async closeIncident(incidentId: string, data?: {
    notes?: string;
    actor_username?: string;
    version?: number;
  }): Promise<Incident> {
    const response = await api.post<Incident>(`/incidents/${incidentId}/close`, data);
    return response.data;
  },

  async getIncidentReport(incidentId: string): Promise<any> {
    const response = await api.get(`/incidents/${incidentId}/report`);
    return response.data;
  },

  async recordReview(incidentId: string, data: {
    outcome_category: string;
    root_cause?: string;
    preventative_actions?: string;
    calibration_recommended: boolean;
    operator_username?: string;
  }): Promise<IncidentReview> {
    const response = await api.post<IncidentReview>(`/incidents/${incidentId}/review`, data);
    return response.data;
  },

  async linkIncidents(data: {
    parent_id: string;
    child_id: string;
    relationship_type: string;
  }) {
    const response = await api.post('/incidents/relationships', data);
    return response.data;
  },

  async getPlaybooks(): Promise<IncidentPlaybook[]> {
    const response = await api.get<IncidentPlaybook[]>('/incidents/playbooks');
    return response.data;
  },

  async getAnalyticsSummary(): Promise<IncidentAnalyticsSummary> {
    const response = await api.get<IncidentAnalyticsSummary>('/incidents/analytics/summary');
    return response.data;
  },

  async evaluateEscalations(): Promise<any> {
    const response = await api.post('/incidents/evaluate-escalations');
    return response.data;
  }
};
