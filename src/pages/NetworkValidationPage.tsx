import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NetworkValidationDashboard from '@/components/network/NetworkValidationDashboard';
import NetworkConditionSimulator from '@/components/network/NetworkConditionSimulator';
import QueuePersistenceValidator from '@/components/network/QueuePersistenceValidator';
import MemoryLeakDetector from '@/components/network/MemoryLeakDetector';

export default function NetworkValidationPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Network Infrastructure Validation</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive testing and validation of network queue management, 
          offline synchronization, and memory management functionality.
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Overview</TabsTrigger>
          <TabsTrigger value="simulator">Network Simulator</TabsTrigger>
          <TabsTrigger value="queue">Queue Validator</TabsTrigger>
          <TabsTrigger value="memory">Memory Detector</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <NetworkValidationDashboard />
        </TabsContent>
        
        <TabsContent value="simulator" className="space-y-6">
          <NetworkConditionSimulator />
        </TabsContent>
        
        <TabsContent value="queue" className="space-y-6">
          <QueuePersistenceValidator />
        </TabsContent>
        
        <TabsContent value="memory" className="space-y-6">
          <MemoryLeakDetector />
        </TabsContent>
      </Tabs>
    </div>
  );
}