
import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Header: React.FC = () => {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  return (
    <header
      className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm"
      role="banner"
      aria-label="Main header">
      {/* Search Input */}
      <input
        type="text"
        placeholder={t('search')}
        className="border rounded-lg px-3 py-1 w-64"
        aria-label={t('search')}
      />

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLanguageToggle}
          className="text-sm"
          aria-label={`Switch to ${language === 'en' ? 'বাংলা' : 'English'}`}>
          <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
          <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
        </Button>

        {/* Simple Avatar */}
        <div 
          className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center"
          title={user?.name || 'User'}
          aria-label="User avatar">
          <span className="text-sm font-medium text-gray-600">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
