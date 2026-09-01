import api from './api';
import {
  SecurityThreatEvent,
  EdgeNodeKey,
  EdgeNodeKeyIssuedSecret,
  BlockedIP,
  SecurityPostureOverview,
  SecurityAuditLog,
  PasswordValidationResult
} from '../types/security';

export const securityService = {
  // Overview
  getOverview: async (): Promise<SecurityPostureOverview> => {
    const res = await api.get<SecurityPostureOverview>('/security/overview');
    return res.data;
  },

  // Threats
  listThreats: async (params?: { severity?: string; event_type?: string; status?: string; limit?: number }): Promise<SecurityThreatEvent[]> => {
    const res = await api.get<SecurityThreatEvent[]>('/security/threats', { params });
    return res.data;
  },

  resolveThreat: async (threatId: string, resolution_notes: string, status: string = 'RESOLVED'): Promise<SecurityThreatEvent> => {
    const res = await api.post<SecurityThreatEvent>(`/security/threats/${threatId}/resolve`, { status, resolution_notes });
    return res.data;
  },

  triggerCorrelation: async (): Promise<{ message: string; detected_patterns: any[] }> => {
    const res = await api.post('/security/threats/correlate');
    return res.data;
  },

  // Edge Keys
  listEdgeKeys: async (): Promise<EdgeNodeKey[]> => {
    const res = await api.get<EdgeNodeKey[]>('/security/edge-keys');
    return res.data;
  },

  issueEdgeKey: async (data: { node_id: string; site_id?: string; bop_id?: string; expires_in_days?: number }): Promise<EdgeNodeKeyIssuedSecret> => {
    const res = await api.post<EdgeNodeKeyIssuedSecret>('/security/edge-keys', data);
    return res.data;
  },

  revokeEdgeKey: async (node_id: string, reason: string): Promise<{ message: string; status: string }> => {
    const res = await api.post(`/security/edge-keys/${node_id}/revoke`, { reason });
    return res.data;
  },

  // IP Blocklist
  listBlockedIPs: async (): Promise<BlockedIP[]> => {
    const res = await api.get<BlockedIP[]>('/security/ip-blocklist');
    return res.data;
  },

  blockIP: async (data: { ip_address: string; reason: string; duration_hours?: number }): Promise<BlockedIP> => {
    const res = await api.post<BlockedIP>('/security/ip-blocklist', data);
    return res.data;
  },

  unblockIP: async (ip_address: string): Promise<{ message: string }> => {
    const res = await api.delete(`/security/ip-blocklist/${ip_address}`);
    return res.data;
  },

  // Account Management
  unlockAccount: async (username: string): Promise<{ message: string }> => {
    const res = await api.post(`/security/accounts/${username}/unlock`);
    return res.data;
  },

  // Password Policy
  validatePassword: async (password: string): Promise<PasswordValidationResult> => {
    const res = await api.post<PasswordValidationResult>('/auth/validate-password-policy', null, {
      params: { password }
    });
    return res.data;
  },

  // Audit Logs
  listAuditLogs: async (params?: { action_type?: string; limit?: number }): Promise<SecurityAuditLog[]> => {
    const res = await api.get<SecurityAuditLog[]>('/security/audit-logs', { params });
    return res.data;
  },

  // Threat Deletion
  deleteThreat: async (threatId: string): Promise<any> => {
    const res = await api.delete(`/security/threats/${threatId}`);
    return res.data;
  },

  clearAllThreats: async (): Promise<any> => {
    const res = await api.delete('/security/threats/clear-all');
    return res.data;
  },

  // Master Purge Data (1-Click Purge All Logged Data)
  purgeSystemData: async (options?: {
    purge_evidence?: boolean;
    purge_events?: boolean;
    purge_alerts?: boolean;
    purge_incidents?: boolean;
    purge_notifications?: boolean;
  }): Promise<any> => {
    const res = await api.post('/security/purge-system-data', null, { params: options });
    return res.data;
  },

  // Export
  exportReportUrl: (format: 'json' | 'csv' = 'csv'): string => {
    return `/api/v1/security/export-report?format=${format}`;
  }
};
