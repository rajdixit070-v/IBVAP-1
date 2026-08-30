import api from './api';
import {
  VehicleWatchlist,
  VehicleWatchlistCreate,
  VehicleWatchlistUpdate,
  ANPREvent,
  ANPRSummary
} from '../types/anpr';

export const anprService = {
  // ANPR Events
  async getEvents(params?: {
    camera_id?: string;
    match_status?: string;
    plate?: string;
    limit?: number;
  }): Promise<ANPREvent[]> {
    const response = await api.get<ANPREvent[]>('/anpr/events', { params });
    return response.data;
  },

  async getSummary(): Promise<ANPRSummary> {
    const response = await api.get<ANPRSummary>('/anpr/summary');
    return response.data;
  },

  async getEventDetail(eventId: string): Promise<ANPREvent> {
    const response = await api.get<ANPREvent>(`/anpr/events/${eventId}`);
    return response.data;
  },

  async deleteEvent(eventId: string): Promise<any> {
    const response = await api.delete(`/anpr/events/${eventId}`);
    return response.data;
  },

  async clearAllEvents(): Promise<any> {
    const response = await api.delete('/anpr/events/clear-all');
    return response.data;
  },

  // Vehicle Watchlist CRUD
  async getVehicles(params?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<VehicleWatchlist[]> {
    const response = await api.get<VehicleWatchlist[]>('/vehicles/', { params });
    return response.data;
  },

  async createVehicle(data: VehicleWatchlistCreate): Promise<VehicleWatchlist> {
    const response = await api.post<VehicleWatchlist>('/vehicles/', data);
    return response.data;
  },

  async updateVehicle(id: number, data: VehicleWatchlistUpdate): Promise<VehicleWatchlist> {
    const response = await api.put<VehicleWatchlist>(`/vehicles/${id}`, data);
    return response.data;
  },

  async deleteVehicle(id: number): Promise<{ status: string; plate_number: string }> {
    const response = await api.delete<{ status: string; plate_number: string }>(`/vehicles/${id}`);
    return response.data;
  }
};
