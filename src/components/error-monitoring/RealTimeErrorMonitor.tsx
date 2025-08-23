
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Clock, Activity, Bell, BellOff, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { errorTrackingService, ErrorTracking } from '@/services/enhanced-error-tracking';

interface RealTimeErrorMonitorProps {
  className?: string;
  maxErrors?: number;
  refreshInterval?: number;
}

interface RealTimeError extends ErrorTracking {
  isNew?: boolean;
}

const RealTimeErrorMonitor: React.FC<RealTimeErrorMonitorProps> = ({
  className,
  maxErrors = 20,
  refreshInterval = 10000 // 10 seconds
}) => {
  const { toast } = useToast();
  const [errors, setErrors] = useState<RealTimeError[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedError, setSelectedError] = useState<ErrorTracking | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const showNotification = (error: ErrorTracking) => {
    if (notificationPermission === 'granted' && isActive) {
      const notification = new Notification('New Error Detected', {
        body: `${error.error_type}: ${error.error_message}`,
        icon: '/favicon.ico',
        tag: `error-${error.id}`,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        setSelectedError(error);
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  };

  const loadRecentErrors = async () => {
    if (!isActive) return;

    try {
      const recentErrors = await errorTrackingService.getRecentErrors(maxErrors);

      setErrors((prevErrors) => {
        const newErrors = recentErrors.map((error) => {
          const isNew = !prevErrors.some((prev) => prev.id === error.id);
          return { ...error, isNew };
        });

        // Show notifications for truly new errors
        newErrors.forEach((error) => {
          if (error.isNew && error.severity_level <= 2) {
            showNotification(error);
            toast({
              title: 'New Critical Error',
              description: `${error.error_type}: ${error.error_message}`,
              variant: 'destructive'
            });
          }
        });

        return newErrors;
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load real-time errors:', error);
    }
  };

  useEffect(() => {
    // Initial load
    loadRecentErrors();

    // Set up interval if active
    if (isActive) {
      const interval = setInterval(loadRecentErrors, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [isActive, refreshInterval]);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        requestNotificationPermission();
      }
    }
  }, []);

  const getSeverityColor = (level: number): string => {
    switch (level) {
      case 1:return 'text-red-600 bg-red-50 border-red-200';
      case 2:return 'text-orange-600 bg-orange-50 border-orange-200';
      case 3:return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 4:return 'text-green-600 bg-green-50 border-green-200';
      case 5:return 'text-blue-600 bg-blue-50 border-blue-200';
      default:return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityLabel = (level: number): string => {
    switch (level) {
      case 1:return 'Critical';
      case 2:return 'High';
      case 3:return 'Medium';
      case 4:return 'Low';
      case 5:return 'Info';
      default:return 'Unknown';
    }
  };

  const criticalErrors = errors.filter((e) => e.severity_level <= 2).length;
  const recentNewErrors = errors.filter((e) => e.isNew).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className={`h-5 w-5 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
            Real-Time Error Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' &&
            <Button
              variant="ghost"
              size="sm"
              onClick={requestNotificationPermission}
              className="text-xs">

                <Bell className="h-4 w-4 mr-1" />
                Enable Notifications
              </Button>
            }
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsActive(!isActive)}>

              {isActive ?
              <BellOff className="h-4 w-4" /> :

              <Bell className="h-4 w-4" />
              }
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last update: {format(lastUpdate, 'HH:mm:ss')}
            </span>
            {criticalErrors > 0 &&
            <Badge variant="destructive" className="text-xs">
                {criticalErrors} Critical
              </Badge>
            }
            {recentNewErrors > 0 &&
            <Badge variant="secondary" className="text-xs">
                {recentNewErrors} New
              </Badge>
            }
          </div>
          <span>{errors.length} errors</span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {errors.length === 0 ?
        <div className="p-6 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent errors detected</p>
            <p className="text-xs mt-1">
              {isActive ? 'Monitoring active' : 'Monitoring paused'}
            </p>
          </div> :

        <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-3">
              {errors.map((error) =>
            <div
              key={error.id}
              className={`
                    flex items-center justify-between p-3 rounded-lg border transition-all
                    ${getSeverityColor(error.severity_level)}
                    ${error.isNew ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
                    hover:shadow-sm cursor-pointer
                  `}
              onClick={() => setSelectedError(error)}>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: error.severity_level <= 2 ? '#fef2f2' : '#f8fafc',
                      color: error.severity_level <= 2 ? '#dc2626' : '#64748b'
                    }}>

                        {getSeverityLabel(error.severity_level)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {error.occurrence_count}x
                      </Badge>
                      {error.isNew &&
                  <Badge className="text-xs bg-blue-500">
                          NEW
                        </Badge>
                  }
                      {error.is_resolved &&
                  <Badge variant="secondary" className="text-xs text-green-700">
                          Resolved
                        </Badge>
                  }
                    </div>
                    <p className="text-sm font-medium truncate mb-1">
                      {error.error_message}
                    </p>
                    <div className="flex items-center gap-2 text-xs opacity-75">
                      <span>{error.error_type}</span>
                      {error.component_name &&
                  <>
                          <span>•</span>
                          <span>{error.component_name}</span>
                        </>
                  }
                      <span>•</span>
                      <span>{format(new Date(error.last_seen), 'HH:mm:ss')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {error.severity_level <= 2 &&
                <AlertTriangle className="h-4 w-4 text-red-500" />
                }
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Error Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>{error.error_type}</strong> - Severity: {getSeverityLabel(error.severity_level)}
                            </AlertDescription>
                          </Alert>
                          
                          <div>
                            <h4 className="font-semibold mb-2">Error Message</h4>
                            <p className="text-sm bg-muted p-3 rounded">
                              {error.error_message}
                            </p>
                          </div>

                          {error.error_stack &&
                      <div>
                              <h4 className="font-semibold mb-2">Stack Trace</h4>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48">
                                {error.error_stack}
                              </pre>
                            </div>
                      }

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Component:</strong> {error.component_name || 'N/A'}
                            </div>
                            <div>
                              <strong>URL:</strong> {error.url}
                            </div>
                            <div>
                              <strong>Occurrences:</strong> {error.occurrence_count}
                            </div>
                            <div>
                              <strong>Environment:</strong> {error.environment}
                            </div>
                            <div>
                              <strong>First Seen:</strong> {format(new Date(error.first_seen), 'PPp')}
                            </div>
                            <div>
                              <strong>Last Seen:</strong> {format(new Date(error.last_seen), 'PPp')}
                            </div>
                          </div>

                          {error.additional_context && error.additional_context !== '{}' &&
                      <div>
                              <h4 className="font-semibold mb-2">Additional Context</h4>
                              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                {JSON.stringify(JSON.parse(error.additional_context), null, 2)}
                              </pre>
                            </div>
                      }
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
            )}
            </div>
          </ScrollArea>
        }
      </CardContent>
    </Card>);

};

export default RealTimeErrorMonitor;