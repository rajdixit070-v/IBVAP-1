import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Camera, CameraSummaryStats, CameraTestResponse } from '../types/camera';
import { cameraService } from '../services/cameraService';
import { HealthWebSocket } from '../services/websocket';

interface CameraContextType {
  cameras: Camera[];
  summary: CameraSummaryStats | null;
  loading: boolean;
  error: string | null;
  selectedBop: string;
  selectedStatus: string;
  searchQuery: string;
  setSelectedBop: (bop: string) => void;
  setSelectedStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  refreshCameras: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  testConnection: (cameraId: string) => Promise<CameraTestResponse>;
  deleteCamera: (cameraId: string) => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [summary, setSummary] = useState<CameraSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBop, setSelectedBop] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const refreshSummary = useCallback(async () => {
    try {
      const data = await cameraService.getOverviewSummary();
      setSummary(data);
    } catch (e: any) {
      console.error('Failed to load summary stats:', e);
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (selectedBop !== 'ALL') params.bop_site = selectedBop;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await cameraService.getCameras(params);
      setCameras(data);
      await refreshSummary();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch cameras');
    } finally {
      setLoading(false);
    }
  }, [selectedBop, selectedStatus, searchQuery, refreshSummary]);

  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  // Connect to Health telemetry WebSocket
  useEffect(() => {
    const healthWs = new HealthWebSocket((msg) => {
      if (msg.event === 'HEALTH_AUDIT' && Array.isArray(msg.cameras)) {
        setCameras((prev) => {
          const map = new Map(msg.cameras.map((c: any) => [c.camera_id, c]));
          return prev.map((cam) => {
            const update: any = map.get(cam.camera_id);
            if (update) {
              return {
                ...cam,
                status: update.status,
                fps: update.fps,
                resolution: update.resolution || cam.resolution,
                last_seen_at: update.last_seen_at || cam.last_seen_at
              };
            }
            return cam;
          });
        });
      }
    });

    return () => {
      healthWs.close();
    };
  }, []);

  const testConnection = async (cameraId: string): Promise<CameraTestResponse> => {
    return await cameraService.testSavedCamera(cameraId);
  };

  const deleteCamera = async (cameraId: string): Promise<void> => {
    await cameraService.deleteCamera(cameraId);
    await refreshCameras();
  };

  return (
    <CameraContext.Provider
      value={{
        cameras,
        summary,
        loading,
        error,
        selectedBop,
        selectedStatus,
        searchQuery,
        setSelectedBop,
        setSelectedStatus,
        setSearchQuery,
        refreshCameras,
        refreshSummary,
        testConnection,
        deleteCamera
      }}
    >
      {children}
    </CameraContext.Provider>
  );
};

export const useCameras = () => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error('useCameras must be used within a CameraProvider');
  }
  return context;
};
