export type VehicleStatus = 'AUTHORIZED' | 'WATCHLIST' | 'MONITOR' | 'BLOCKED' | 'UNKNOWN';

export type ANPRMatchStatus = 'AUTHORIZED' | 'WATCHLIST_MATCH' | 'WATCHLIST' | 'MONITOR' | 'BLOCKED' | 'UNKNOWN' | 'NO_MATCH';

export type WatchlistCategory = 'RESTRICTED_THREAT' | 'SUSPICIOUS_MOVEMENT' | 'ESCORTED' | 'VIP' | 'PATROL' | 'GENERAL';

export interface VehicleWatchlist {
  id: number;
  plate_number: string;
  normalized_plate_number: string;
  vehicle_type: string;
  owner_name?: string;
  status: VehicleStatus;
  watchlist_category: WatchlistCategory;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleWatchlistCreate {
  plate_number: string;
  vehicle_type: string;
  owner_name?: string;
  status: VehicleStatus;
  watchlist_category: WatchlistCategory;
  notes?: string;
}

export interface VehicleWatchlistUpdate {
  plate_number?: string;
  vehicle_type?: string;
  owner_name?: string;
  status?: VehicleStatus;
  watchlist_category?: WatchlistCategory;
  notes?: string;
}

export interface ANPREvent {
  id: number;
  event_id: string;
  camera_id: string;
  track_id: number;
  plate_number: string;
  normalized_plate: string;
  confidence: number;
  plate_confidence: number;
  observations_count: number;
  vehicle_type: string;
  match_status: ANPRMatchStatus;
  matched_owner?: string;
  watchlist_notes?: string;
  snapshot_url?: string;
  timestamp: string;
}

export interface ANPRSummary {
  total_reads: number;
  watchlist_matches: number;
  authorized_count: number;
  unknown_count: number;
  recent_events: ANPREvent[];
}
