
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';

interface ConnectionIndicatorProps {
  variant?: 'badge' | 'icon' | 'minimal';
  className?: string;
}

export function ConnectionIndicator({ 
  variant = 'badge', 
  className = '' 
}: ConnectionIndicatorProps) {
  const { online, status } = useNetwork();

  const getIcon = () => {
    if (online) {
      return status.consecutiveFailures === 0 ? 
        <Wifi className="h-3 w-3" /> : 
        <AlertTriangle className="h-3 w-3" />;
    }
    return <WifiOff className="h-3 w-3" />;
  };

  const getColor = () => {
    if (online) {
      return status.consecutiveFailures === 0 ? 'text-green-500' : 'text-yellow-500';
    }
    return 'text-red-500';
  };

  const getBadgeVariant = () => {
    if (online) {
      return status.consecutiveFailures === 0 ? 'default' : 'secondary';
    }
    return 'destructive';
  };

  if (variant === 'icon') {
    return (
      <div className={`${getColor()} ${className}`} title={`Network: ${online ? 'Online' : 'Offline'}`}>
        {getIcon()}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${
          online ? (status.consecutiveFailures === 0 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-red-500'
        }`} />
      </div>
    );
  }

  // Default badge variant
  return (
    <Badge variant={getBadgeVariant() as any} className={`gap-1 ${className}`}>
      {getIcon()}
      {online ? (status.consecutiveFailures === 0 ? 'Online' : 'Unstable') : 'Offline'}
    </Badge>
  );
}

export default ConnectionIndicator;
