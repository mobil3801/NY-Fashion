
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Shield, 
  Activity, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import DeploymentControlDashboard from '@/components/deployment/DeploymentControlDashboard';
import ProductionSafetyControls from '@/components/deployment/ProductionSafetyControls';
import DeploymentPipelineManager from '@/components/deployment/DeploymentPipelineManager';
import ComprehensiveMonitoringDashboard from '@/components/deployment/ComprehensiveMonitoringDashboard';
import { useRealTimeMonitoring } from '@/hooks/use-real-time-monitoring';
import { useDeploymentControl } from '@/hooks/use-deployment-control';

const DeploymentControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { systemHealth, currentMetrics, processedAlerts } = useRealTimeMonitoring();
  const { deploymentMetrics, environments } = useDeploymentControl();

  // Calculate system status indicators
  const criticalAlerts = processedAlerts.filter(alert => alert.severity === 'critical').length;
  const unhealthyEnvironments = environments.filter((env: any) => env.status !== 'healthy').length;
  const systemStatusColor = systemHealth.status === 'healthy' ? 'text-green-500' : 
                           systemHealth.status === 'degraded' ? 'text-yellow-500' : 'text-red-500';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Rocket className="w-8 h-8 text-blue-600" />
                Production Deployment Control
              </h1>
              <p className="text-gray-600 mt-2">
                Comprehensive deployment management with real-time monitoring and safety controls
              </p>
            </div>
            
            {/* System Status Indicator */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  {getStatusIcon(systemHealth.status)}
                  <span className={`font-semibold capitalize ${systemStatusColor}`}>
                    {systemHealth.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600">System Status</div>
              </div>
              <div className="h-12 w-px bg-gray-300"></div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {deploymentMetrics.success_rate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts > 0 && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Alert className="border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                <span className="font-medium">Critical alerts detected:</span> {criticalAlerts} issues require immediate attention. 
                <Button variant="link" className="text-red-700 p-0 ml-2" onClick={() => setActiveTab('monitoring')}>
                  View Details →
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Quick Status Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Deployments</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {environments.filter((env: any) => env.last_deployment_id).length}
                  </p>
                </div>
                <Rocket className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className={`text-2xl font-bold ${currentMetrics.error_rate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {currentMetrics.error_rate.toFixed(2)}%
                  </p>
                </div>
                <Activity className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Safety Controls</p>
                  <p className="text-2xl font-bold text-green-600">
                    {environments.filter((env: any) => env.circuit_breaker_status === 'closed').length}/
                    {environments.length}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Environments</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{environments.length}</span>
                    {unhealthyEnvironments > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {unhealthyEnvironments} issues
                      </Badge>
                    )}
                  </div>
                </div>
                <Settings className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Deployment Control
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Pipeline Manager
            </TabsTrigger>
            <TabsTrigger value="safety" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Safety Controls
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DeploymentControlDashboard />
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <DeploymentPipelineManager />
          </TabsContent>

          <TabsContent value="safety" className="space-y-6">
            <ProductionSafetyControls />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <ComprehensiveMonitoringDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DeploymentControlPage;
