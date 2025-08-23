
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import NetworkStatusMonitor from '@/components/debug/NetworkStatusMonitor';
import ApiDebugDashboard from '@/components/debug/ApiDebugDashboard';
import ConnectionRecovery from '@/components/debug/ConnectionRecovery';
import DebugSettingsPanel from '@/components/debug/DebugSettingsPanel';

const NetworkDebugPage: React.FC = () => {
  const navigate = useNavigate();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold mb-2">Debug Mode Not Available</h2>
              <p className="text-gray-600">
                Network debugging tools are only available in development mode.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="mt-4">

                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}>

            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Network Debug Tools</h1>
            <p className="text-gray-600">
              Comprehensive network diagnostics and API monitoring
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api">API Calls</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetworkStatusMonitor />
            <ConnectionRecovery />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}>

                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.clear();
                    sessionStorage.clear();
                  }}>

                  Clear Storage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if ('caches' in window) {
                      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
                    }
                  }}>

                  Clear Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.clear()}>

                  Clear Console
                </Button>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div><strong>Keyboard Shortcuts:</strong></div>
                <div>• <code>Ctrl + Shift + D</code> - Toggle debug mode</div>
                <div>• <code>Ctrl + Shift + R</code> - Hard refresh</div>
                <div>• <code>F12</code> - Developer tools</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <ApiDebugDashboard />
        </TabsContent>

        <TabsContent value="recovery" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConnectionRecovery />
            <NetworkStatusMonitor />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="max-w-2xl">
            <DebugSettingsPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>);

};

export default NetworkDebugPage;