export interface BOPDispatch {
  id: number;
  dispatch_id: string;
  bop_id: string;
  site_id: string;
  officer_username: string;
  title: string;
  summary: string;
  priority: 'ROUTINE' | 'IMPORTANT' | 'URGENT' | 'FLASH';
  status: 'SENT_TO_HQ' | 'ACKNOWLEDGED_BY_HQ' | 'ACTIONED';
  detected_persons_count: number;
  vehicles_scanned_count: number;
  alerts_count: number;
  evidence_ids: string;
  hq_notes?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
  evidence_items?: any[];
}

export interface BOPDispatchCreateInput {
  title: string;
  summary: string;
  bop_id?: string;
  priority?: string;
  detected_persons_count?: number;
  vehicles_scanned_count?: number;
  alerts_count?: number;
  evidence_ids?: string[];
}
