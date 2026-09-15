// src/pages/admin/adminHome.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar, { type NavEntry } from '../../components/navbar';
import BottomBar from '../../components/bottombar';
// subpages for admin
import UserManagePage from './subpages/userManagePage';
import UserProfilePage from '../subpages/userProfilePage';
import QualityDashboardPage from '../subpages/quality/qualityDashboardPage';
import WaferViewPage from '../subpages/quality/waferViewPage';
import ProcessMonitoringPage from '../subpages/quality/processMonitoringPage';
import AlertsPage from '../subpages/quality/alertsPage';
import DefectDetectionPage from '../subpages/quality/defectDetectionPage';
import ProcessSimulationPage from '../subpages/quality/processSimulationPage';
import ModelTuningPage from './subpages/modelTuningPage';

interface AdminHomeProps {
  currentUser: string | null;
  token: string | null;
  onLogout: () => void;
}

type AdminTabType =
  | 'dashboard'
  | 'users'
  | 'profile'
  | 'quality'
  | 'wafer-view'
  | 'defect-detection'
  | 'process-simulation'
  | 'process-monitoring'
  | 'alerts'
  | 'model-tuning';

const adminNavItems: NavEntry<AdminTabType>[] = [
  { key: 'dashboard', label: 'nav.dashboard' },
  { key: 'quality', label: 'nav.quality' },
  { key: 'wafer-view', label: 'nav.waferView' },
  { key: 'defect-detection', label: 'nav.defectDetection' },
  {
    type: 'group',
    label: 'nav.aiTools',
    adminOnly: true,
    items: [
      { key: 'process-simulation', label: 'nav.processSimulation' },
      { key: 'model-tuning', label: 'nav.modelTuning' },
    ],
  },
  { key: 'process-monitoring', label: 'nav.processMonitoring' },
  { key: 'alerts', label: 'nav.alerts' },
  { key: 'users', label: 'nav.users', adminOnly: true },
  { key: 'profile', label: 'nav.profile' },
];

export default function AdminHome({ currentUser, token, onLogout }: AdminHomeProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTabType>('dashboard');

  return (
    // 1. Outermost layer: pinned exactly to viewport height (h-screen), overflow disallowed
    <div className="w-full h-screen flex flex-col overflow-hidden bg-slate-900 text-white">
      
      {/* 2. Top nav bar: fixed height, flex-shrink-0 */}
      <div className="flex-shrink-0">
        <Navbar<AdminTabType>
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onLogout={onLogout}
          isAdmin={true}
          navItems={adminNavItems}
          onViewAllNotifications={() => setActiveTab('alerts')}
        />
      </div>

      {/* 3. Main content area: flex-1 fills remaining height; min-h-0 + overflow-y-auto lets long content scroll internally */}
      <main className="flex-1 min-h-0 overflow-y-auto p-8 flex flex-col items-center justify-start">
        {activeTab === 'dashboard' && (
          <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-full max-w-2xl text-center my-auto">
            <h2 className="text-3xl font-bold mb-4 text-purple-400">{t('adminHome.welcomeTitle')}</h2>
            <p className="text-slate-400 mb-6">{t('adminHome.welcomeBack')} <span className="text-white font-semibold">{currentUser}</span>。</p>
            <div className="p-4 bg-slate-900 rounded border border-slate-700 text-left overflow-hidden">
              <p className="text-xs text-slate-500 mb-1">{t('adminHome.tokenLabel')}</p>
              <code className="text-xs text-purple-300 break-all">{token}</code>
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

        {activeTab === 'users' && (
          <div className="w-full">
            <UserManagePage currentUser={currentUser} onForceLogout={onLogout} />
          </div>
        )}

        {activeTab === 'model-tuning' && (
          <div className="w-full">
            <ModelTuningPage />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="w-full">
            <UserProfilePage currentUser={currentUser} />
          </div>
        )}
      </main>

      {/* 4. Bottom bar: flex-shrink-0 ensures it's never squeezed, stays pinned to the bottom of the viewport */}
      <div className="flex-shrink-0 z-10">
        <BottomBar />
      </div>

    </div>
  );
}