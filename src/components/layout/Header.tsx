
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, User, Globe, Wifi } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NetworkStatusIndicator } from '@/components/network/NetworkStatusIndicator';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6 shadow-sm" role="banner" aria-label="Main header">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden p-2"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Logo and app name */}
        <div className="flex items-center space-x-2">
          <img 
            src="https://cdn.ezsite.ai/AutoDev/19016/bb4a2cd5-b101-49df-bd0d-eeb788f55077.jpg" 
            alt="Logo" 
            className="h-8 w-8 rounded object-contain"
          />
          <h1 className="text-lg lg:text-xl font-semibold text-gray-900 hidden sm:block">
            {t('common.appName', 'Business Management')}
          </h1>
          <h1 className="text-lg font-semibold text-gray-900 sm:hidden">
            BMS
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Input */}
        <input
          type="text"
          placeholder={t('search')}
          className="border rounded-lg px-3 py-1 w-64 hidden md:block"
          aria-label={t('search')}
        />

        {/* Network status */}
        <div className="hidden sm:block">
          <NetworkStatusIndicator />
        </div>

        {/* User menu */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 truncate max-w-[120px]">
              {user?.name || user?.email}
            </span>
          </div>
          
          {/* Mobile user menu */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;