
import React, { useState } from 'react';
import { Bell, Search, Globe, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
  };

  return (
    <header
      className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm transition-all duration-200 h-20"
      role="banner"
      aria-label="Main header">



      <div className="px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between w-full">
          {/* Left Section - Search */}
          <div className="flex items-center flex-1 max-w-2xl">
            {/* Desktop Search */}
            <div className="relative hidden md:block w-full max-w-md">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"
                aria-hidden="true" />



              <input
                type="text"
                placeholder={t('search')}
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full transition-all duration-200 hover:border-gray-400 text-sm"
                aria-label={t('search')} />



            </div>

            {/* Mobile Search Overlay */}
            {isSearchOpen &&
            <div className="md:hidden fixed inset-0 z-50 bg-white">
                <div className="flex items-center p-4 border-b">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                    type="text"
                    placeholder={t('search')}
                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full"
                    autoFocus />



                  </div>
                  <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSearch}
                  className="ml-2 p-2 hover:bg-gray-100 rounded-2xl">



                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            }
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Mobile Search Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSearch}
              className="md:hidden p-2 hover:bg-emerald-50 rounded-2xl transition-colors duration-200 focus:ring-2 focus:ring-emerald-500"
              aria-label={t('search')}>



              <Search className="w-4 h-4" />
            </Button>

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLanguageToggle}
              onKeyDown={(e) => handleKeyDown(e, handleLanguageToggle)}
              className="p-2 sm:px-3 hover:bg-emerald-50 rounded-2xl transition-colors duration-200 focus:ring-2 focus:ring-emerald-500 min-w-0"
              aria-label={`Switch to ${language === 'en' ? 'বাংলা' : 'English'}`}>



              <Globe className="w-4 h-4 mr-0 sm:mr-2 flex-shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline whitespace-nowrap text-sm">
                {language === 'en' ? 'বাংলা' : 'English'}
              </span>
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-emerald-50 rounded-2xl relative transition-colors duration-200 focus:ring-2 focus:ring-emerald-500"
              aria-label="Notifications">



              <Bell className="w-4 h-4" />
              {/* Notification indicator */}
              <span
                className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
                aria-hidden="true" />



            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-2xl transition-colors duration-200 focus:ring-2 focus:ring-emerald-500 hover:bg-emerald-50"
                  aria-label="User menu">



                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} alt={user?.name || 'User avatar'} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 sm:w-56 rounded-2xl border border-gray-200 shadow-lg bg-white"
                align="end"
                forceMount
                sideOffset={8}>



                <div className="flex items-center gap-3 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatar} alt={user?.name || 'User avatar'} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 leading-none min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <span className="inline-block text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-xl w-fit mt-1">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer rounded-xl m-1 text-red-600 hover:text-red-700 hover:bg-red-50 focus:bg-red-50 focus:text-red-700 transition-colors duration-200"
                  role="menuitem">



                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>);

};

export default Header;