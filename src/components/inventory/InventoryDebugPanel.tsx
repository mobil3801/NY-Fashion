
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Activity,
  Package,
  Settings
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/hooks/use-toast';

const InventoryDebugPanel = () => {
  const { healthCheck, seedData, fetchProducts, clearError } = useInventory();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isRunningHealthCheck, setIsRunningHealthCheck] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);

  const runHealthCheck = async () => {
    setIsRunningHealthCheck(true);
    try {
      const result = await healthCheck();
      setHealthStatus(result);
      
      if (result.overall_health === 'HEALTHY') {
        toast({
          title: "System Healthy",
          description: "All inventory system components are working correctly.",
          variant: "default"
        });
      } else {
        toast({
          title: "System Issues Detected",
          description: `Found ${result.issues?.length || 0} issues that need attention.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Health Check Failed",
        description: error.message || "Unable to run system health check.",
        variant: "destructive"
      });
      setHealthStatus({
        overall_health: 'ERROR',
        error: error.message,
        issues: [error.message]
      });
    } finally {
      setIsRunningHealthCheck(false);
    }
  };

  const runSeedData = async () => {
    setIsSeedingData(true);
    try {
      const result = await seedData();
      setSeedResult(result);
      
      toast({
        title: "Data Seeding Complete",
        description: `Added ${result.products_inserted || 0} products to the inventory.`,
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Data Seeding Failed",
        description: error.message || "Unable to seed inventory data.",
        variant: "destructive"
      });
      setSeedResult({
        error: error.message,
        products_inserted: 0
      });
    } finally {
      setIsSeedingData(false);
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'NEEDS_ATTENTION':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'NEEDS_ATTENTION':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Inventory System Debug Panel
        </CardTitle>
        <CardDescription>
          Diagnostic tools and system status for the inventory management system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="health" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="data">Data Management</TabsTrigger>
            <TabsTrigger value="testing">API Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">System Health Check</h3>
              <Button 
                onClick={runHealthCheck}
                disabled={isRunningHealthCheck}
                className="flex items-center gap-2"
              >
                {isRunningHealthCheck ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    Run Health Check
                  </>
                )}
              </Button>
            </div>

            {healthStatus && (
              <Card className={`border-2 ${getHealthStatusColor(healthStatus.overall_health)}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getHealthStatusIcon(healthStatus.overall_health)}
                      <span className="font-semibold text-lg">
                        {healthStatus.overall_health}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {new Date(healthStatus.timestamp).toLocaleTimeString()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <p className="text-sm font-medium">Database</p>
                      <Badge variant={healthStatus.database_connection ? "default" : "destructive"}>
                        {healthStatus.database_connection ? "Connected" : "Failed"}
                      </Badge>
                    </div>
                    
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <p className="text-sm font-medium">Products</p>
                      <Badge variant="outline">
                        {healthStatus.sample_data?.total_products || 0}
                      </Badge>
                    </div>

                    <div className="text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                      <p className="text-sm font-medium">Low Stock</p>
                      <Badge variant="secondary">
                        {healthStatus.sample_data?.low_stock_products || 0}
                      </Badge>
                    </div>

                    <div className="text-center">
                      <XCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                      <p className="text-sm font-medium">Out of Stock</p>
                      <Badge variant="destructive">
                        {healthStatus.sample_data?.out_of_stock_products || 0}
                      </Badge>
                    </div>
                  </div>

                  {healthStatus.issues && healthStatus.issues.length > 0 && (
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-2">Issues Found:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {healthStatus.issues.map((issue: string, index: number) => (
                            <li key={index} className="text-sm">{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {healthStatus.recommendations && healthStatus.recommendations.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-2">Recommendations:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {healthStatus.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Data Management</h3>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Seed Sample Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Add sample products and categories to test the system
                      </p>
                    </div>
                    <Button 
                      onClick={runSeedData}
                      disabled={isSeedingData}
                      variant="outline"
                    >
                      {isSeedingData ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Seeding...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 mr-2" />
                          Seed Data
                        </>
                      )}
                    </Button>
                  </div>

                  {seedResult && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(seedResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Refresh Products</h4>
                      <p className="text-sm text-muted-foreground">
                        Reload product data from the database
                      </p>
                    </div>
                    <Button 
                      onClick={() => fetchProducts()}
                      variant="outline"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Clear Errors</h4>
                      <p className="text-sm text-muted-foreground">
                        Clear any cached error states in the inventory system
                      </p>
                    </div>
                    <Button 
                      onClick={clearError}
                      variant="outline"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Clear Errors
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="testing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">API Testing</h3>
            </div>

            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                Use the System Health tab to test all API endpoints automatically. 
                Manual testing tools will be available in future versions.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">Available API Endpoints:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><code>getProducts(filters)</code> - Fetch product inventory</li>
                <li><code>getLowStockProducts(filters)</code> - Get products below minimum stock</li>
                <li><code>healthCheckInventory()</code> - System diagnostic check</li>
                <li><code>seedInventoryData()</code> - Populate sample data</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InventoryDebugPanel;
