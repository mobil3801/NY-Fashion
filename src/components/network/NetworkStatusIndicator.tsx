
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wifi, WifiOff, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { formatDistanceToNow } from 'date-fns';

export function NetworkStatusIndicator() {
  const { online, status } = useNetwork();

  const getStatusColor = () => {
    if (online) return 'bg-green-500';
    if (status.consecutiveFailures > 3) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusIcon = () => {
    if (online) return <Wifi className="h-3 w-3" />;
    if (status.consecutiveFailures > 3) return <AlertTriangle className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (online) return 'Online';
    if (status.consecutiveFailures > 3) return 'Connection Lost';
    return 'Checking...';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            {getStatusIcon()}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Connection Status</span>
            <Badge variant={online ? 'default' : 'destructive'}>
              {getStatusText()}
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Check:</span>
              <span>{formatDistanceToNow(status.lastCheck)} ago</span>
            </div>
            
            {status.consecutiveFailures > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed Attempts:</span>
                <span>{status.consecutiveFailures}</span>
              </div>
            )}
            
            {status.lastError && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Last Error:</span>
                <div className="text-xs bg-muted p-2 rounded text-red-600">
                  {status.lastError}
                </div>
              </div>
            )}
          </div>

          {!online && (
            <div className="text-xs text-muted-foreground bg-amber-50 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium">Offline Mode Active</span>
              </div>
              <p>Changes will be saved locally and synced when connection is restored.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
