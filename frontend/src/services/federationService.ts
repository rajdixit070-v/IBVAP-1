import api from './api';
import {
  Site,
  BOP,
  SiteOverview,
  BOPOverview,
  SiteHealthMatrixRow,
  BOPHealthMatrixRow,
  GlobalOverview,
  UserScope,
  EffectiveConfig,
  GlobalSearchResult,
  FederatedMapData,
  MultiSiteReport
} from '../types/federation';

export const federationService = {
  // Global Federation Overview & Matrices
  getGlobalOverview: async (): Promise<GlobalOverview> => {
    const res = await api.get<GlobalOverview>('/federation/global/overview');
    return res.data;
  },

  getSiteHealthMatrix: async (): Promise<SiteHealthMatrixRow[]> => {
    const res = await api.get<SiteHealthMatrixRow[]>('/federation/sites/matrix');
    return res.data;
  },

  getBOPHealthMatrix: async (siteId?: string): Promise<BOPHealthMatrixRow[]> => {
    const url = siteId ? `/federation/bops/matrix?site_id=${encodeURIComponent(siteId)}` : '/federation/bops/matrix';
    const res = await api.get<BOPHealthMatrixRow[]>(url);
    return res.data;
  },

  getFederatedMapData: async (siteId?: string): Promise<FederatedMapData> => {
    const url = siteId ? `/federation/map?site_id=${encodeURIComponent(siteId)}` : '/federation/map';
    const res = await api.get<FederatedMapData>(url);
    return res.data;
  },

  globalSearch: async (query: string): Promise<{ query: string; total_matches: number; results: GlobalSearchResult[] }> => {
    const res = await api.get(`/federation/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  // Site CRUD
  listSites: async (): Promise<Site[]> => {
    const res = await api.get<Site[]>('/sites');
    return res.data;
  },

  createSite: async (data: Partial<Site>): Promise<Site> => {
    const res = await api.post<Site>('/sites', data);
    return res.data;
  },

  getSite: async (siteId: string): Promise<Site> => {
    const res = await api.get<Site>(`/sites/${encodeURIComponent(siteId)}`);
    return res.data;
  },

  getSiteOverview: async (siteId: string): Promise<SiteOverview> => {
    const res = await api.get<SiteOverview>(`/sites/${encodeURIComponent(siteId)}/overview`);
    return res.data;
  },

  updateSite: async (siteId: string, data: Partial<Site>): Promise<Site> => {
    const res = await api.put<Site>(`/sites/${encodeURIComponent(siteId)}`, data);
    return res.data;
  },

  deactivateSite: async (siteId: string): Promise<void> => {
    await api.delete(`/sites/${encodeURIComponent(siteId)}`);
  },

  // BOP CRUD
  listBOPs: async (siteId?: string): Promise<BOP[]> => {
    const url = siteId ? `/bops?site_id=${encodeURIComponent(siteId)}` : '/bops';
    const res = await api.get<BOP[]>(url);
    return res.data;
  },

  createBOP: async (data: Partial<BOP>): Promise<BOP> => {
    const res = await api.post<BOP>('/bops', data);
    return res.data;
  },

  getBOPOverview: async (bopId: string): Promise<BOPOverview> => {
    const res = await api.get<BOPOverview>(`/bops/${encodeURIComponent(bopId)}/overview`);
    return res.data;
  },

  getBOPCameras: async (bopId: string): Promise<any[]> => {
    const res = await api.get<any[]>(`/bops/${encodeURIComponent(bopId)}/cameras`);
    return res.data;
  },

  updateBOP: async (bopId: string, data: Partial<BOP>): Promise<BOP> => {
    const res = await api.put<BOP>(`/bops/${encodeURIComponent(bopId)}`, data);
    return res.data;
  },

  deactivateBOP: async (bopId: string): Promise<void> => {
    await api.delete(`/bops/${encodeURIComponent(bopId)}`);
  },

  // User Scopes
  listUserScopes: async (): Promise<UserScope[]> => {
    const res = await api.get<UserScope[]>('/federation/user-scopes');
    return res.data;
  },

  assignUserScope: async (data: {
    username: string;
    scope_type: 'GLOBAL' | 'REGION' | 'SITE' | 'BOP';
    scope_id: string;
    role: string;
  }): Promise<UserScope> => {
    const res = await api.post<UserScope>('/federation/user-scopes', data);
    return res.data;
  },

  revokeUserScope: async (scopeId: number): Promise<void> => {
    await api.delete(`/federation/user-scopes/${scopeId}`);
  },

  // Configuration Inheritance
  getEffectiveConfig: async (params: {
    key: string;
    siteId?: string;
    bopId?: string;
    zoneId?: string;
    cameraId?: string;
  }): Promise<EffectiveConfig> => {
    let url = `/federation/config/effective?key=${encodeURIComponent(params.key)}`;
    if (params.siteId) url += `&site_id=${encodeURIComponent(params.siteId)}`;
    if (params.bopId) url += `&bop_id=${encodeURIComponent(params.bopId)}`;
    if (params.zoneId) url += `&zone_id=${encodeURIComponent(params.zoneId)}`;
    if (params.cameraId) url += `&camera_id=${encodeURIComponent(params.cameraId)}`;
    const res = await api.get<EffectiveConfig>(url);
    return res.data;
  },

  setConfigOverride: async (data: {
    scope_level: string;
    scope_id: string;
    config_key: string;
    config_value_json: string;
    reason?: string;
  }): Promise<void> => {
    await api.post('/federation/config/override', data);
  },

  // Multi-Site Reports
  getMultiSiteReport: async (scope: string = 'ALL', scopeId?: string): Promise<MultiSiteReport> => {
    let url = `/federation/reports?scope=${encodeURIComponent(scope)}`;
    if (scopeId) url += `&scope_id=${encodeURIComponent(scopeId)}`;
    const res = await api.get<MultiSiteReport>(url);
    return res.data;
  }
};
