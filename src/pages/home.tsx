// src/pages/home.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/navbar';
import BottomBar from '../components/bottombar';
// subpages
import UserProfilePage from './subpages/userProfilePage';
import QualityDashboardPage from './subpages/quality/qualityDashboardPage';
import WaferViewPage from './subpages/quality/waferViewPage';
import ProcessMonitoringPage from './subpages/quality/processMonitoringPage';
import AlertsPage from './subpages/quality/alertsPage';
import DefectDetectionPage from './subpages/quality/defectDetectionPage';
import ProcessSimulationPage from './subpages/quality/processSimulationPage';

interface HomeProps {
  currentUser: string | null;
  token: string | null;
  onLogout: () => void;
}

type TabType =
  | 'home'
  | 'profile'
  | 'users'
  | 'quality'
  | 'wafer-view'
  | 'defect-detection'
  | 'process-simulation'
  | 'process-monitoring'
  | 'alerts';

const navItems: { key: TabType; label: string }[] = [
  { key: 'home', label: 'nav.home' },
  { key: 'quality', label: 'nav.quality' },
  { key: 'wafer-view', label: 'nav.waferView' },
  { key: 'defect-detection', label: 'nav.defectDetection' },
  { key: 'process-simulation', label: 'nav.processSimulation' },
  { key: 'process-monitoring', label: 'nav.processMonitoring' },
  { key: 'alerts', label: 'nav.alerts' },
  { key: 'profile', label: 'nav.profile' },
];

export default function Home({ currentUser, token, onLogout }: HomeProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  return (

    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      <div className="flex-shrink-0">
        <Navbar<TabType>
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          isAdmin={false}
          navItems={navItems}
          onViewAllNotifications={() => setActiveTab('alerts')}
        />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-8 flex flex-col items-center justify-start">
        {activeTab === 'home' && (
          <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-full max-w-2xl text-center my-auto">
            <h2 className="text-3xl font-bold mb-4 text-white">{t('home.welcomeTitle')}</h2>
            <p className="text-slate-400 mb-6">{t('home.welcomeDesc')}</p>
            <div className="p-4 bg-slate-900 rounded border border-slate-700 text-left overflow-hidden">
              <p className="text-xs text-slate-500 mb-1">{t('home.tokenLabel')}</p>
              <code className="text-xs text-blue-300 break-all">{token}</code>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="w-full">
            <QualityDashboardPage />
          </div>
        )}

        {activeTab === 'wafer-view' && (
          <div className="w-full">
            <WaferViewPage />
          </div>
        )}

        {activeTab === 'defect-detection' && (
          <div className="w-full">
            <DefectDetectionPage />
          </div>
        )}

        {activeTab === 'process-simulation' && (
          <div className="w-full">
            <ProcessSimulationPage />
          </div>
        )}

        {activeTab === 'process-monitoring' && (
          <div className="w-full">
            <ProcessMonitoringPage />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="w-full">
            <AlertsPage />
          </div>
        )}

        {activeTab === 'profile' && (
          <UserProfilePage currentUser={currentUser} />
        )}
      </main>

      <div className="flex-shrink-0">
        <BottomBar />
      </div>
    </div>
  );
}