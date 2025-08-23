
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useResponsive } from '@/hooks/use-responsive';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const location = useLocation();

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile, isSidebarOpen]);

  // Auto-close sidebar when switching from mobile to desktop
  useEffect(() => {
    if (isDesktop && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isDesktop, isSidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 layout-transition">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onClose={closeSidebar} />

      
      <div className={`min-h-screen flex flex-col layout-transition ${isDesktop ? 'lg:ml-64' : ''}`}>
        {/* Mobile/Tablet Header Bar */}
        {(isMobile || isTablet) &&
        <div className="flex items-center justify-between sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">NY</span>
              </div>
              <div>
                <span className="font-bold text-gray-900 text-sm sm:text-base">NY FASHION</span>
                <p className="text-xs text-gray-500 hidden sm:block">Management System</p>
              </div>
            </div>
            <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 focus:ring-2 focus:ring-emerald-500 focus-visible"
            aria-label="Toggle navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="sidebar-navigation">

              <Menu className="w-5 h-5" />
            </Button>
          </div>
        }

        {/* Desktop Header */}
        {isDesktop && <Header />}

        {/* Main Content Area */}
        <main
          className="flex-1 responsive-padding main-content overflow-x-hidden"
          role="main"
          aria-label="Main content"
          style={{ minHeight: `calc(100vh - ${isDesktop ? '80px' : '64px'})` }}>

          <div className="max-w-none mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {(isMobile || isTablet) && isSidebarOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={closeSidebar}
        aria-hidden="true" />

      }
    </div>);

};

export default MainLayout;