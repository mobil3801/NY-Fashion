
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard';
import ErrorTrackingDashboard from '@/components/monitoring/ErrorTrackingDashboard';
import ApiDebugDashboard from '@/components/debug/ApiDebugDashboard';
import { Activity, AlertTriangle, Bug, TrendingUp } from 'lucide-react';

const MonitoringPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Comprehensive monitoring and observability dashboard
          </p>
        </div>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            API Debug
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorTrackingDashboard />
        </TabsContent>

        <TabsContent value="api">
          <ApiDebugDashboard />
        </TabsContent>

        <TabsContent value="performance">
          <div className="text-center py-12">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Performance Monitoring</h3>
            <p className="text-muted-foreground">
              Advanced performance monitoring features coming soon
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringPage;
