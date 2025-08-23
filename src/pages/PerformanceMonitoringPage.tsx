
import React from 'react';
import ComprehensivePerformanceDashboard from '@/components/monitoring/ComprehensivePerformanceDashboard';
import PerformanceThresholdManager from '@/components/monitoring/PerformanceThresholdManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Settings, BarChart3, AlertTriangle } from 'lucide-react';

const PerformanceMonitoringPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Performance Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor, analyze, and optimize your application's performance in real-time
          </p>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Real-time Monitoring</p>
                <p className="text-2xl font-bold text-blue-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Metrics Collected</p>
                <p className="text-2xl font-bold text-green-600">24/7</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alert System</p>
                <p className="text-2xl font-bold text-orange-600">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto-Optimization</p>
                <p className="text-2xl font-bold text-purple-600">Smart</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance Dashboard
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Threshold Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ComprehensivePerformanceDashboard />
        </TabsContent>

        <TabsContent value="thresholds" className="mt-6">
          <PerformanceThresholdManager />
        </TabsContent>
      </Tabs>
    </div>);

};

export default PerformanceMonitoringPage;