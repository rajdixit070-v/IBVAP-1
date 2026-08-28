import api from './api';
import {
  PersonWatchlist,
  PersonWatchlistCreate,
  PersonWatchlistUpdate,
  FaceEvent,
  FaceAnalyticsSummary,
  VerificationStatus
} from '../types/face';

export const faceService = {
  // Face Recognition Events
  async getEvents(params?: {
    camera_id?: string;
    match_status?: string;
    verification_status?: string;
    limit?: number;
  }): Promise<FaceEvent[]> {
    const response = await api.get<FaceEvent[]>('/face/events', { params });
    return response.data;
  },

  async getSummary(): Promise<FaceAnalyticsSummary> {
    const response = await api.get<FaceAnalyticsSummary>('/face/summary');
    return response.data;
  },

  async verifyMatch(eventId: string, status: VerificationStatus, notes?: string): Promise<FaceEvent> {
    const response = await api.put<FaceEvent>(`/face/events/${eventId}/verify`, {
      verification_status: status,
      verification_notes: notes
    });
    return response.data;
  },

  // Person Watchlist CRUD
  async getPersons(params?: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<PersonWatchlist[]> {
    const response = await api.get<PersonWatchlist[]>('/watchlist/persons/', { params });
    return response.data;
  },

  async createPerson(data: PersonWatchlistCreate): Promise<PersonWatchlist> {
    const response = await api.post<PersonWatchlist>('/watchlist/persons/', data);
    return response.data;
  },

  async updatePerson(id: number, data: PersonWatchlistUpdate): Promise<PersonWatchlist> {
    const response = await api.put<PersonWatchlist>(`/watchlist/persons/${id}`, data);
    return response.data;
  },

  async deletePerson(id: number): Promise<{ status: string; person_id: string }> {
    const response = await api.delete<{ status: string; person_id: string }>(`/watchlist/persons/${id}`);
    return response.data;
  }
};
