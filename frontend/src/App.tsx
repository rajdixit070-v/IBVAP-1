import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CameraProvider, useCameras } from './context/CameraContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { SystemHealthCenterPage } from './pages/SystemHealthCenterPage';
import { PredictiveIntelligencePage } from './pages/PredictiveIntelligencePage';
import { BehaviourIntelligencePage } from './pages/BehaviourIntelligencePage';
import { MovementIntelligencePage } from './pages/MovementIntelligencePage';
import { IncidentsPage } from './pages/IncidentsPage';
import { CameraManagementPage } from './pages/CameraManagementPage';
import { LivePreviewPage } from './pages/LivePreviewPage';
import { AIPipelinePage } from './pages/AIPipelinePage';
import { PerimeterIntelligencePage } from './pages/PerimeterIntelligencePage';
import { VehicleIntelligencePage } from './pages/VehicleIntelligencePage';
import { FaceIntelligencePage } from './pages/FaceIntelligencePage';
import { SecurityEventsPage } from './pages/SecurityEventsPage';
import { MultiSiteCommandPage } from './pages/MultiSiteCommandPage';
import { MultimodalIntelligencePage } from './pages/MultimodalIntelligencePage';
import { EnterpriseSecurityPage } from './pages/EnterpriseSecurityPage';
import { ForensicEvidencePage } from './pages/ForensicEvidencePage';
import { CheckpostDispatchesPage } from './pages/CheckpostDispatchesPage';
import { SensorFusionPage } from './pages/SensorFusionPage';
import { ThermalFusionPage } from './pages/ThermalFusionPage';
import { PTZControlPage } from './pages/PTZControlPage';
import { DroneOperationsPage } from './pages/DroneOperationsPage';
import { GISIntelligencePage } from './pages/GISIntelligencePage';
import { CameraDetailsModal } from './components/cameras/CameraDetailsModal';
import { CameraModal } from './components/cameras/CameraModal';
import { SituationalMapModal } from './components/incidents/SituationalMapModal';
import { AIAssistantModal } from './components/multimodal/AIAssistantModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LiveAlertToast } from './components/common/LiveAlertToast';
import { Camera } from './types/camera';
import { Bot } from 'lucide-react';

const ADMIN_ONLY_TABS = ['security', 'health', 'predictive'];

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN' || user?.scope_type === 'GLOBAL';

  const getInitialTab = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!isSuperAdmin && ADMIN_ONLY_TABS.includes(hash)) {
      return 'dashboard';
    }
    return hash || 'dashboard';
  };
  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tab: string) => {
    if (!isSuperAdmin && ADMIN_ONLY_TABS.includes(tab)) {
      setActiveTabState('dashboard');
      if (window.location.hash !== '#dashboard') {
        window.location.hash = '#dashboard';
      }
      return;
    }
    setActiveTabState(tab);
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = `#${tab}`;
    }
  };

  useEffect(() => {
    if (user && !isSuperAdmin && ADMIN_ONLY_TABS.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [user, isSuperAdmin, activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
      if (!isSuperAdmin && ADMIN_ONLY_TABS.includes(hash)) {
        setActiveTabState('dashboard');
        return;
      }
      setActiveTabState(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);
  const [selectedCameraForInspection, setSelectedCameraForInspection] = useState<Camera | null>(null);
  const [selectedCameraForEdit, setSelectedCameraForEdit] = useState<Camera | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [globalMapOpen, setGlobalMapOpen] = useState(false);
  const [targetMapCamera, setTargetMapCamera] = useState<Camera | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));

  const { cameras, refreshCameras } = useCameras();

  const handleInspect = (cam: Camera) => {
    setSelectedCameraForInspection(cam);
  };

  const handleEdit = (cam: Camera) => {
    setSelectedCameraForEdit(cam);
    setCameraModalOpen(true);
  };

  const handleOpenMapWithTarget = (cameraOrId?: Camera | string) => {
    if (!cameraOrId) {
      setTargetMapCamera(null);
      setGlobalMapOpen(true);
      return;
    }
    if (typeof cameraOrId === 'string') {
      const found = cameras.find((c) => c.camera_id === cameraOrId);
      setTargetMapCamera(found || null);
    } else {
      setTargetMapCamera(cameraOrId);
    }
    setGlobalMapOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden">
      <Header
        activeTab={activeTab}
        onNavigateToDashboard={() => setActiveTab('dashboard')}
        onOpenMap={() => handleOpenMapWithTarget()}
        onOpenAssistant={() => setAssistantOpen(true)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />
      <LiveAlertToast
        onOpenMap={(camId) => handleOpenMapWithTarget(camId)}
        onOpenIncident={() => setActiveTab('incidents')}
      />
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 h-full overflow-y-auto min-h-0 bg-[#070b12]">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onNavigateToCameras={() => setActiveTab('cameras')}
              onNavigateToLive={() => setActiveTab('live')}
              onNavigateToSOC={() => setActiveTab('soc')}
              onNavigateToFederation={() => setActiveTab('federation')}
              onNavigateToEvidence={() => setActiveTab('evidence')}
              onNavigateToIncidents={() => setActiveTab('incidents')}
              onNavigateToSecurity={() => setActiveTab('security')}
              onNavigateToIntelligence={() => setActiveTab('intelligence')}
              onNavigateToEvents={() => setActiveTab('events')}
              onNavigateToANPR={() => setActiveTab('anpr')}
              onNavigateToFace={() => setActiveTab('face')}
              onNavigateToEdge={() => setActiveTab('health')}
              onNavigateToHealth={() => setActiveTab('health')}
              onNavigateToPredictive={() => setActiveTab('predictive')}
              onNavigateToDrones={() => setActiveTab('drone-operations')}
              onNavigateToGIS={() => setActiveTab('gis-intelligence')}
              onNavigateToPTZ={() => setActiveTab('ptz-control')}
              onNavigateToThermal={() => setActiveTab('thermal-fusion')}
              onNavigateToBehaviour={() => setActiveTab('behaviour')}
              onInspectCamera={handleInspect}
            />
          )}

          {activeTab === 'soc' && <CommandCenterPage />}
          {activeTab === 'health' && <SystemHealthCenterPage />}
          {activeTab === 'federation' && <MultiSiteCommandPage />}
          {activeTab === 'multimodal' && <MultimodalIntelligencePage />}
          {activeTab === 'security' && <EnterpriseSecurityPage />}
          {activeTab === 'predictive' && <PredictiveIntelligencePage />}
          {activeTab === 'behaviour' && <BehaviourIntelligencePage />}
          {activeTab === 'cross-camera' && <MovementIntelligencePage />}
          {activeTab === 'incidents' && <IncidentsPage />}
          {activeTab === 'cameras' && <CameraManagementPage onLocateOnMap={(cam) => handleOpenMapWithTarget(cam)} />}
          {activeTab === 'live' && <LivePreviewPage onLocateOnMap={(cam) => handleOpenMapWithTarget(cam)} />}
          {activeTab === 'ai-pipeline' && <AIPipelinePage />}
          {activeTab === 'intelligence' && <PerimeterIntelligencePage />}
          {activeTab === 'anpr' && <VehicleIntelligencePage />}
          {activeTab === 'face' && <FaceIntelligencePage />}
          {activeTab === 'edge' && <SystemHealthCenterPage />}
          {activeTab === 'events' && <SecurityEventsPage />}
          {activeTab === 'evidence' && <ForensicEvidencePage />}
          {activeTab === 'dispatches' && <CheckpostDispatchesPage />}
          {activeTab === 'sensor-fusion' && <SensorFusionPage />}
          {activeTab === 'thermal-fusion' && <ThermalFusionPage />}
          {activeTab === 'ptz-control' && <PTZControlPage />}
          {activeTab === 'drone-operations' && <DroneOperationsPage />}
          {activeTab === 'gis-intelligence' && <GISIntelligencePage />}
        </main>
      </div>

      {/* Global Camera Details Inspection Modal */}
      <CameraDetailsModal
        isOpen={!!selectedCameraForInspection}
        onClose={() => setSelectedCameraForInspection(null)}
        camera={selectedCameraForInspection}
        onRefresh={refreshCameras}
        onEdit={handleEdit}
      />

      {/* Edit Camera Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={refreshCameras}
        cameraToEdit={selectedCameraForEdit}
      />

      {/* Situational Awareness Map Modal */}
      <SituationalMapModal
        isOpen={globalMapOpen}
        onClose={() => {
          setGlobalMapOpen(false);
          setTargetMapCamera(null);
        }}
        targetCamera={targetMapCamera}
        onSelectIncident={() => {
          setGlobalMapOpen(false);
          setActiveTab('incidents');
        }}
        onInspectCamera={(cam) => {
          setSelectedCameraForInspection(cam);
        }}
      />

      {/* Floating Tactical AI Copilot Launcher (Shifted & Positioned on Right) */}
      <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-7 sm:right-7 z-40 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-sky-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-2xl shadow-cyan-500/40 flex items-center gap-2 sm:gap-2.5 border border-cyan-400/40 group transition-all transform hover:scale-105 cursor-pointer ring-2 ring-cyan-500/20"
        title="Open Tactical AI Copilot (Right Panel)"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <Bot className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold font-mono tracking-wide">AI Copilot</span>
        <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">TACTICAL</span>
      </button>

      {/* Global AI Virtual Assistant Modal */}
      <AIAssistantModal
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />
    </div>
  );
};

import { HomePage3D } from './pages/HomePage3D';

const AuthenticatedApp: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-slate-400 tracking-wider">VALIDATING SECURE IDENTITY MATRIX...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <HomePage3D onSuccess={() => {}} />;
  }

  return (
    <CameraProvider>
      <MainLayout />
    </CameraProvider>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
