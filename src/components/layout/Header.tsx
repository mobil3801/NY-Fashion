
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NetworkStatusIndicator } from '@/components/network/NetworkStatusIndicator';
import ConnectionVerificationPanel from '@/components/network/ConnectionVerificationPanel';

const Header: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [verificationOpen, setVerificationOpen] = useState(false);

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
        aria-label={t('search')} />

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Connection Verification Button */}
        <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-xs"
              title="Connection Security Check">

              <Shield className="h-3 w-3" />
              Verify
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
            <ConnectionVerificationPanel onClose={() => setVerificationOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Network Status Indicator */}
        <NetworkStatusIndicator />

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
    </header>);

};

export default Header;