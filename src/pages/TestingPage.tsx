
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TestReportDashboard from '@/components/testing/TestReportDashboard';
import LiveAPITester from '@/components/testing/LiveAPITester';
import {
  TestTube,
  Activity,
  FileText,
  Zap } from
'lucide-react';

export default function TestingPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <TestTube className="h-8 w-8 text-emerald-600" />
        <div>
          <h1 className="text-3xl font-bold">Testing Dashboard</h1>
          <p className="text-gray-600">Comprehensive testing suite for inventory APIs</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Test Reports
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Live API Testing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <TestReportDashboard />
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          <LiveAPITester />
        </TabsContent>
      </Tabs>
    </div>);

}