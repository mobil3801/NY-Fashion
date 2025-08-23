
import React from 'react';
import { Outlet } from 'react-router-dom';
import DebugFloatingButton from '@/components/debug/DebugFloatingButton';
import ConnectionQualityIndicator from '@/components/network/ConnectionQualityIndicator';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Offline Banner - Global network status */}
      <OfflineBanner />
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <Header />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6" role="main" aria-label="Main content">
          <Outlet />
        </main>
      </div>

      {/* Network Connection Quality Indicator */}
      <div className="fixed bottom-4 left-4 z-40">
        <ConnectionQualityIndicator variant="full" showDetails={true} />
      </div>

      {/* Debug Tools - Development Only */}
      <DebugFloatingButton />
    </div>);

};

export default MainLayout;