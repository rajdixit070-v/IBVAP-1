export type EdgeNodeStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING';

export type EdgeSyncStatus = 'SYNCHRONIZED' | 'DELAYED' | 'SYNCING' | 'OFFLINE';

export interface EdgeNode {
  id: number;
  node_id: string;
  name: string;
  bop_site: string;
  location?: string;
  status: EdgeNodeStatus;
  software_version: string;
  hardware_info?: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  gpu_percent: number;
  active_cameras_count: number;
  total_cameras_count: number;
  queued_events_count: number;
  sync_status: EdgeSyncStatus;
  config_version: number;
  low_bandwidth_mode: boolean;
  latency_ms: number;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

export interface EdgeNodeCreate {
  node_id: string;
  name: string;
  bop_site: string;
  location?: string;
  software_version?: string;
  hardware_info?: string;
  low_bandwidth_mode?: boolean;
}

export interface EdgeNodeUpdate {
  name?: string;
  bop_site?: string;
  location?: string;
  software_version?: string;
  hardware_info?: string;
  low_bandwidth_mode?: boolean;
  status?: EdgeNodeStatus;
}

export interface EdgeRemoteConfig {
  low_bandwidth_mode?: boolean;
  inference_fps?: number;
  sync_batch_size?: number;
  disk_warning_threshold?: number;
  disk_critical_threshold?: number;
}

export interface EdgeSyncStats {
  total_synced: number;
  pending_sync: number;
  failed_sync: number;
  avg_latency_ms: number;
  nodes_online: number;
  nodes_offline: number;
  nodes_degraded: number;
}
