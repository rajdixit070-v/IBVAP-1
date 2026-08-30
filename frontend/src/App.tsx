import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
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
import { EdgeInfrastructurePage } from './pages/EdgeInfrastructurePage';
import { SecurityEventsPage } from './pages/SecurityEventsPage';
import { MultiSiteCommandPage } from './pages/MultiSiteCommandPage';
import { MultimodalIntelligencePage } from './pages/MultimodalIntelligencePage';
import { EnterpriseSecurityPage } from './pages/EnterpriseSecurityPage';
import { CameraDetailsModal } from './components/cameras/CameraDetailsModal';
import { CameraModal } from './components/cameras/CameraModal';
import { SituationalMapModal } from './components/incidents/SituationalMapModal';
import { AIAssistantModal } from './components/multimodal/AIAssistantModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DemoModeBanner } from './components/common/DemoModeBanner';
import { Camera } from './types/camera';
import { Bot } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCameraForInspection, setSelectedCameraForInspection] = useState<Camera | null>(null);
  const [selectedCameraForEdit, setSelectedCameraForEdit] = useState<Camera | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [globalMapOpen, setGlobalMapOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const { refreshCameras } = useCameras();

  const handleInspect = (cam: Camera) => {
    setSelectedCameraForInspection(cam);
  };

  const handleEdit = (cam: Camera) => {
    setSelectedCameraForEdit(cam);
    setCameraModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
      <Header
        onOpenMap={() => setGlobalMapOpen(true)}
        onOpenAssistant={() => setAssistantOpen(true)}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto bg-[#070b12]">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onNavigateToCameras={() => setActiveTab('cameras')}
              onNavigateToLive={() => setActiveTab('live')}
              onNavigateToIntelligence={() => setActiveTab('intelligence')}
              onNavigateToEvents={() => setActiveTab('events')}
              onNavigateToANPR={() => setActiveTab('anpr')}
              onNavigateToFace={() => setActiveTab('face')}
              onNavigateToEdge={() => setActiveTab('edge')}
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
          {activeTab === 'cameras' && <CameraManagementPage />}
          {activeTab === 'live' && <LivePreviewPage />}
          {activeTab === 'ai-pipeline' && <AIPipelinePage />}
          {activeTab === 'intelligence' && <PerimeterIntelligencePage />}
          {activeTab === 'anpr' && <VehicleIntelligencePage />}
          {activeTab === 'face' && <FaceIntelligencePage />}
          {activeTab === 'edge' && <EdgeInfrastructurePage />}
          {activeTab === 'events' && <SecurityEventsPage />}
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
        onClose={() => setGlobalMapOpen(false)}
        onSelectIncident={() => {
          setGlobalMapOpen(false);
          setActiveTab('incidents');
        }}
        onInspectCamera={(cam) => {
          setSelectedCameraForInspection(cam);
        }}
      />

      {/* Floating AI Virtual Assistant Action Button */}
      <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white px-4 py-2.5 rounded-full shadow-2xl shadow-cyan-500/40 flex items-center gap-2 border border-cyan-400/40 group transition-all transform hover:scale-105"
        title="Open AI Virtual Assistant Copilot"
      >
        <Bot className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold font-mono tracking-wide">AI Copilot</span>
      </button>

      {/* Global AI Virtual Assistant Modal */}
      <AIAssistantModal
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />
    </div>
  );
};

import { LoginPage } from './pages/LoginPage';
import { useAuth } from './context/AuthContext';

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
    return <LoginPage onSuccess={() => {}} />;
  }

  return (
    <CameraProvider>
      <MainLayout />
      <DemoModeBanner />
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
