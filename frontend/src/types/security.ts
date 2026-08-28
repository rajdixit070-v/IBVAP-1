export interface SecurityThreatEvent {
  id: number;
  event_id: string;
  timestamp: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source_ip: string;
  user_agent: string;
  username?: string;
  target_resource?: string;
  endpoint?: string;
  details_json: string;
  mitigation_action: string;
  status: 'NEW' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'FALSE_POSITIVE';
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface EdgeNodeKey {
  id: number;
  node_id: string;
  key_prefix: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ROTATED';
  site_id: string;
  bop_id?: string;
  last_used_at?: string;
  expires_at?: string;
  created_by: string;
  created_at: string;
}

export interface EdgeNodeKeyIssuedSecret {
  node_id: string;
  api_key: string;
  key_prefix: string;
  expires_at?: string;
  message: string;
}

export interface BlockedIP {
  id: number;
  ip_address: string;
  reason: string;
  attack_count: number;
  is_active: boolean;
  blocked_until?: string;
  created_by: string;
  created_at: string;
}

export interface SecurityFinding {
  id: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  recommendation: string;
  status: string;
}

export interface SecurityPostureOverview {
  posture_score: number;
  overall_status: 'STRONG' | 'MODERATE' | 'CRITICAL';
  active_threats_count: number;
  critical_threats_count: number;
  locked_accounts_count: number;
  revoked_edge_nodes_count: number;
  blocked_ips_count: number;
  threats_by_type: Record<string, number>;
  threats_by_severity: Record<string, number>;
  findings: SecurityFinding[];
  checks: Record<string, { name: string; status: string; score_impact: string; details: string }>;
  timestamp: string;
}

export interface SecurityAuditLog {
  id: number;
  audit_id: string;
  actor_username: string;
  action_type: string;
  resource_type: string;
  resource_id?: string;
  old_value_json?: string;
  new_value_json?: string;
  ip_address: string;
  status: string;
  created_at: string;
}

export interface PasswordValidationResult {
  is_valid: boolean;
  errors: string[];
  score: number;
}
