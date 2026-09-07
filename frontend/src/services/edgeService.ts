import api from './api';
import {
  EdgeNode,
  EdgeNodeCreate,
  EdgeNodeUpdate,
  EdgeRemoteConfig,
  EdgeSyncStats
} from '../types/edge';

export const edgeService = {
  // Edge Nodes CRUD
  async getNodes(params?: { status?: string; bop_site?: string }): Promise<EdgeNode[]> {
    const response = await api.get<EdgeNode[]>('/edge/nodes', { params });
    return response.data;
  },

  async getNode(nodeId: string): Promise<EdgeNode> {
    const response = await api.get<EdgeNode>(`/edge/nodes/${nodeId}`);
    return response.data;
  },

  async createNode(data: EdgeNodeCreate): Promise<EdgeNode> {
    const response = await api.post<EdgeNode>('/edge/nodes', data);
    return response.data;
  },

  async updateNode(nodeId: string, data: EdgeNodeUpdate): Promise<EdgeNode> {
    const response = await api.put<EdgeNode>(`/edge/nodes/${nodeId}`, data);
    return response.data;
  },

  async deleteNode(nodeId: string): Promise<{ status: string; node_id: string }> {
    const response = await api.delete<{ status: string; node_id: string }>(`/edge/nodes/${nodeId}`);
    return response.data;
  },

  // Remote Configuration
  async updateRemoteConfig(nodeId: string, config: EdgeRemoteConfig): Promise<EdgeNode> {
    const response = await api.put<EdgeNode>(`/edge/nodes/${nodeId}/config`, config);
    return response.data;
  },

  // Sync Telemetry
  async getSyncStats(): Promise<EdgeSyncStats> {
    const response = await api.get<EdgeSyncStats>('/edge/sync/stats');
    return response.data;
  },

  // Remote Management
  async reconnectNode(nodeId: string): Promise<any> {
    const response = await api.post(`/edge/nodes/${nodeId}/reconnect`);
    return response.data;
  },

  async getNodeCameras(nodeId: string): Promise<any[]> {
    const response = await api.get(`/edge/nodes/${nodeId}/cameras`);
    return response.data;
  },

  async issueOrRotateToken(nodeId: string): Promise<any> {
    const response = await api.post(`/edge/nodes/${nodeId}/token`);
    return response.data;
  },

  async flushAllSync(): Promise<{ status: string; message: string; flushed_count: number }> {
    const response = await api.post<{ status: string; message: string; flushed_count: number }>('/edge/sync/flush-all');
    return response.data;
  },

  async simulateEdgeEvent(nodeId: string): Promise<any> {
    const response = await api.post(`/edge/simulate-event/${nodeId}`);
    return response.data;
  }
};
