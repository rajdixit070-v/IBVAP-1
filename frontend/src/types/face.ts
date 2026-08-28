export type FaceMatchStatus = 'AUTHORIZED_MATCH' | 'WATCHLIST_POTENTIAL_MATCH' | 'MONITOR' | 'UNKNOWN' | 'NO_MATCH' | 'LOW_QUALITY';

export type PersonCategory = 'AUTHORIZED' | 'WATCHLIST' | 'MONITOR' | 'RESTRICTED';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'DISMISSED';

export interface PersonWatchlist {
  id: number;
  person_id: string;
  display_name: string;
  category: PersonCategory;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  notes?: string;
  photo_ref?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PersonWatchlistCreate {
  person_id: string;
  display_name: string;
  category: PersonCategory;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  notes?: string;
  photo_ref?: string;
  embedding?: number[];
}

export interface PersonWatchlistUpdate {
  display_name?: string;
  category?: PersonCategory;
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  notes?: string;
  photo_ref?: string;
  embedding?: number[];
}

export interface FaceEvent {
  id: number;
  event_id: string;
  camera_id: string;
  track_id: number;
  match_status: FaceMatchStatus;
  matched_person_id?: string;
  matched_person_name?: string;
  matched_category?: string;
  similarity_score: number;
  quality_score: number;
  verification_status: VerificationStatus;
  verification_notes?: string;
  snapshot_url?: string;
  timestamp: string;
}

export interface FaceAnalyticsSummary {
  total_faces: number;
  potential_matches: number;
  authorized_faces: number;
  unknown_faces: number;
  recent_events: FaceEvent[];
}
