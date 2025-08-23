import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  Network, 
  Database, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Settings
} from 'lucide-react';

import ComprehensiveIntegrationTester from '@/components/testing/ComprehensiveIntegrationTester';
import NetworkFailureSimulator from '@/components/testing/NetworkFailureSimulator';
import DatabaseConsistencyValidator from '@/components/testing/DatabaseConsistencyValidator';
import ErrorRecoveryTester from '@/components/testing/ErrorRecoveryTester';

const ComprehensiveTestingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('integration');

  const testingSuites = [
    {
      id: 'integration',
      name: 'Integration Testing',
      description: 'End-to-end functionality validation',
      icon: TestTube,
      component: ComprehensiveIntegrationTester,
      status: 'ready'
    },
    {
      id: 'network',
      name: 'Network Simulation',
      description: 'Network failure scenario testing',
      icon: Network,
      component: NetworkFailureSimulator,
      status: 'ready'
    },
    {
      id: 'database',
      name: 'Database Validation',
      description: 'Data integrity and consistency checks',
      icon: Database,
      component: DatabaseConsistencyValidator,
      status: 'ready'
    },
    {
      id: 'recovery',
      name: 'Error Recovery',
      description: 'Recovery mechanism validation',
      icon: Activity,
      component: ErrorRecoveryTester,
      status: 'ready'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Comprehensive Testing Suite</h1>
          <p className="text-xl text-muted-foreground">
            Staging Environment Integration & Recovery Testing
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className="gap-1">
            <Settings className="h-3 w-3" />
            Staging Environment
          </Badge>
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            All Systems Ready
          </Badge>
        </div>
      </div>

      {/* Testing Suite Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {testingSuites.map((suite) => {
          const IconComponent = suite.icon;
          return (
            <Card key={suite.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {suite.name}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">
                  {suite.description}
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${getStatusColor(suite.status)}`}>
                    {suite.status}
                  </Badge>
                  {getStatusIcon(suite.status)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Important Testing Guidelines */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> This comprehensive testing suite is designed for staging environment validation. 
          It tests end-to-end functionality, API integrations, database operations, network failure scenarios, 
          and recovery mechanisms. Run these tests before production deployment to ensure system reliability.
        </AlertDescription>
      </Alert>

      {/* Testing Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          {testingSuites.map((suite) => {
            const IconComponent = suite.icon;
            return (
              <TabsTrigger key={suite.id} value={suite.id} className="gap-2">
                <IconComponent className="h-4 w-4" />
                {suite.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {testingSuites.map((suite) => {
          const ComponentToRender = suite.component;
          return (
            <TabsContent key={suite.id} value={suite.id}>
              <ComponentToRender />
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Testing Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Testing Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Before Running Tests:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Ensure staging environment is properly configured</li>
                <li>• Verify database connectivity and test data availability</li>
                <li>• Check that all services are running and accessible</li>
                <li>• Backup important data before destructive tests</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">During Testing:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Monitor system performance during test execution</li>
                <li>• Review test results and investigate any failures</li>
                <li>• Document any issues or unexpected behaviors</li>
                <li>• Take screenshots of any error states encountered</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComprehensiveTestingPage;