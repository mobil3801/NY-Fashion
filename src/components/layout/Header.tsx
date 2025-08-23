import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Menu, User, Search, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NetworkStatusIndicator } from '@/components/network/NetworkStatusIndicator';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  isMobile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, sidebarOpen, isMobile = false }) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchVisible, setSearchVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6 shadow-sm" role="banner" aria-label="Main header">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 touch-manipulation"
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

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search - Desktop */}
        <div className="hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('search', 'Search...')}
              className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label={t('search', 'Search')}
            />
          </div>
        </div>

        {/* Search - Mobile */}
        <div className="md:hidden">
          {searchVisible ? (
            <div className="absolute top-16 left-4 right-4 bg-white border rounded-lg shadow-lg p-2 z-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('search', 'Search...')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onBlur={() => setSearchVisible(false)}
                />
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchVisible(true)}
              className="p-2 touch-manipulation"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Network status - Hidden on very small screens */}
        <div className="hidden sm:block">
          <NetworkStatusIndicator />
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="p-2 touch-manipulation">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span className="hidden md:inline text-sm max-w-[120px] truncate">
                  {user?.name || user?.email}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center space-x-2 p-2">
              <User className="h-4 w-4" />
              <div className="flex flex-col">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;