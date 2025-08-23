
import React, { useState, useEffect } from 'react';
import { Bug, X, Activity, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useDebug } from '@/debug';

const DebugFloatingButton: React.FC = () => {
  const navigate = useNavigate();
  const { networkStatus, apiCalls, debugSettings } = useDebug();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Only show in development mode
  useEffect(() => {
    setShowButton(process.env.NODE_ENV === 'development' && debugSettings.enabled);
  }, [debugSettings.enabled]);

  // Keyboard shortcut to toggle debug mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + Shift + D to toggle debug panel
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        if (showButton) {
          setIsExpanded(!isExpanded);
        }
      }

      // Escape to close expanded panel
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, showButton]);

  if (!showButton) return null;

  const failedCalls = apiCalls.filter((call) => call.status === 'error').length;
  const pendingCalls = apiCalls.filter((call) =>
  call.status === 'pending' || call.status === 'retrying'
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ?
      <Card className="w-64 shadow-lg border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Debug Tools</span>
              </div>
              <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0">

                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Status Indicators */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Network:</span>
                <Badge
                variant={networkStatus.isOnline ? "default" : "destructive"}
                className="text-xs">

                  {networkStatus.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              
              {networkStatus.latency &&
            <div className="flex items-center justify-between">
                  <span className="text-gray-600">Latency:</span>
                  <span className="text-xs font-mono">
                    {networkStatus.latency.toFixed(0)}ms
                  </span>
                </div>
            }

              <div className="flex items-center justify-between">
                <span className="text-gray-600">API Calls:</span>
                <div className="flex gap-1">
                  {pendingCalls > 0 &&
                <Badge variant="secondary" className="text-xs">
                      {pendingCalls} pending
                    </Badge>
                }
                  {failedCalls > 0 &&
                <Badge variant="destructive" className="text-xs">
                      {failedCalls} failed
                    </Badge>
                }
                  {pendingCalls === 0 && failedCalls === 0 &&
                <Badge variant="outline" className="text-xs">
                      All good
                    </Badge>
                }
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/debug/network')}
              className="flex-1 text-xs">

                <Activity className="h-3 w-3 mr-1" />
                Monitor
              </Button>
              <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="flex-1 text-xs">

                <RefreshCw className="h-3 w-3 mr-1" />
                Reload
              </Button>
            </div>

            <div className="text-xs text-gray-500 text-center">
              Press <kbd className="bg-gray-200 px-1 rounded">Ctrl+Shift+D</kbd> to toggle
            </div>
          </CardContent>
        </Card> :

      <Button
        onClick={() => setIsExpanded(true)}
        className="rounded-full h-12 w-12 bg-blue-600 hover:bg-blue-700 shadow-lg relative"
        title="Debug Tools (Ctrl+Shift+D)">

          <Bug className="h-5 w-5 text-white" />
          
          {/* Status indicators */}
          {(failedCalls > 0 || !networkStatus.isOnline) &&
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
        }
          
          {pendingCalls > 0 && failedCalls === 0 && networkStatus.isOnline &&
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-yellow-500 rounded-full border-2 border-white animate-pulse" />
        }
        </Button>
      }
    </div>);

};

export default DebugFloatingButton;