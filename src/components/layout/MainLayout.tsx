
import React from 'react';
import { Outlet } from 'react-router-dom';
import DebugFloatingButton from '@/components/debug/DebugFloatingButton';
import ConnectionIndicator from '@/components/network/ConnectionIndicator';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
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

      {/* Network Connection Indicator */}
      <div className="fixed bottom-4 left-4 z-40">
        <ConnectionIndicator variant="minimal" />
      </div>

      {/* Debug Tools - Development Only */}
      <DebugFloatingButton />
    </div>);

};

export default MainLayout;