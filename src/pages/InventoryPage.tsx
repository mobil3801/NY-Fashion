import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, FileText, BarChart3, Upload, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedInventoryProvider } from '@/contexts/EnhancedInventoryContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useIsMobile } from '@/hooks/use-mobile';

// Import accessibility utilities for dev mode
if (import.meta.env.DEV) {
  import('@/utils/contrast-checker').then(({ reportContrastIssues }) => {
    // Auto-run contrast check in dev mode after component mounts
    setTimeout(() => {
      reportContrastIssues();
    }, 2000);
  });
}

import EnhancedProductManagement from '@/components/inventory/EnhancedProductManagement';
import StockMovement from '@/components/inventory/StockMovement';
import InventoryAdjustments from '@/components/inventory/InventoryAdjustments';
import LowStockAlerts from '@/components/inventory/LowStockAlerts';
import CSVImport from '@/components/inventory/CSVImport';
import BarcodeGeneration from '@/components/inventory/BarcodeGeneration';
import NetworkDiagnosticsHelper from '@/components/network/NetworkDiagnosticsHelper';
import InventoryDebugPanel from '@/components/inventory/InventoryDebugPanel';
import EnhancedInventoryDiagnostics from '@/components/inventory/EnhancedInventoryDiagnostics';
import InventoryErrorBoundary from '@/components/inventory/InventoryErrorBoundary';
import InventoryNetworkMonitor from '@/components/inventory/InventoryNetworkMonitor';

const InventoryPage = () => {
  const { t } = useLanguage();
  const { online, connectionState, errorDetails } = useNetwork();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('products');
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showBarcodeGen, setShowBarcodeGen] = useState(false);

  // Auto-show diagnostics if there are persistent connection issues
  useEffect(() => {
    if (!online && connectionState === 'offline' && errorDetails) {
      const timer = setTimeout(() => {
        setActiveTab('diagnostics');
      }, 5000); // Switch to diagnostics after 5 seconds of being offline
      return () => clearTimeout(timer);
    }
  }, [online, connectionState, errorDetails]);

  return (
    <InventoryErrorBoundary>
      <EnhancedInventoryProvider>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header with enhanced accessibility */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              {t('inventory', 'Inventory')}
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Manage your products and stock levels
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Inventory actions">
            <Button
                variant="outline"
                onClick={() => setShowCSVImport(true)}
                className="touch-manipulation"
                aria-label="Import products from CSV file"
                size={isMobile ? "sm" : "default"}>

              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              {isMobile ? "Import" : "Import CSV"}
            </Button>
            <Button
                variant="outline"
                onClick={() => setShowBarcodeGen(true)}
                className="touch-manipulation"
                aria-label="Generate barcode labels for products"
                size={isMobile ? "sm" : "default"}>

              <QrCode className="h-4 w-4 mr-2" aria-hidden="true" />
              {isMobile ? "Labels" : "Generate Labels"}
            </Button>
            <Button
                variant="outline"
                className="touch-manipulation"
                aria-label="Export inventory data"
                size={isMobile ? "sm" : "default"}>

              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        {/* Main Inventory Interface with enhanced mobile responsiveness */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            /* Mobile scrollable tabs */
            <div className="w-full overflow-x-auto">
              <TabsList className="inline-flex w-max min-w-full h-12" role="tablist" aria-label="Inventory management sections">
                <TabsTrigger
                  value="products"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="Manage products and variants">

                  <Package className="h-4 w-4" aria-hidden="true" />
                  Products
                </TabsTrigger>
                <TabsTrigger
                  value="stock"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="View and manage stock movements">

                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Stock
                </TabsTrigger>
                <TabsTrigger
                  value="adjustments"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="Make inventory adjustments">

                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Adjustments
                </TabsTrigger>
                <TabsTrigger
                  value="alerts"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="View low stock alerts and critical items">

                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Alerts
                </TabsTrigger>
                <TabsTrigger
                  value="reports"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="Generate inventory reports and analytics">

                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Reports
                </TabsTrigger>
                <TabsTrigger
                  value="diagnostics"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="Network diagnostics and troubleshooting">

                  <Package className="h-4 w-4" aria-hidden="true" />
                  Network
                </TabsTrigger>
                <TabsTrigger
                  value="debug"
                  className="flex items-center gap-2 px-3 h-10 text-sm whitespace-nowrap"
                  aria-label="Inventory debug panel">

                  <Package className="h-4 w-4" aria-hidden="true" />
                  Debug
                </TabsTrigger>
              </TabsList>
            </div>) : (

            /* Desktop grid tabs */
            <TabsList className="grid w-full grid-cols-7" role="tablist" aria-label="Inventory management sections">
              <TabsTrigger
                value="products"
                className="flex items-center gap-2"
                aria-label="Manage products and variants">

                <Package className="h-4 w-4" aria-hidden="true" />
                Products
              </TabsTrigger>
              <TabsTrigger
                value="stock"
                className="flex items-center gap-2"
                aria-label="View and manage stock movements">

                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Stock Movement
              </TabsTrigger>
              <TabsTrigger
                value="adjustments"
                className="flex items-center gap-2"
                aria-label="Make inventory adjustments">

                <FileText className="h-4 w-4" aria-hidden="true" />
                Adjustments
              </TabsTrigger>
              <TabsTrigger
                value="alerts"
                className="flex items-center gap-2"
                aria-label="View low stock alerts and critical items">

                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Low Stock
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="flex items-center gap-2"
                aria-label="Generate inventory reports and analytics">

                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Reports
              </TabsTrigger>
              <TabsTrigger
                value="diagnostics"
                className="flex items-center gap-2"
                aria-label="Network diagnostics and troubleshooting">

                <Package className="h-4 w-4" aria-hidden="true" />
                Diagnostics
              </TabsTrigger>
              <TabsTrigger
                value="debug"
                className="flex items-center gap-2"
                aria-label="Inventory debug panel">

                <Package className="h-4 w-4" aria-hidden="true" />
                Debug
              </TabsTrigger>
            </TabsList>)
            }

          <TabsContent value="products" className="mt-4">
            <EnhancedProductManagement />
          </TabsContent>

          <TabsContent value="stock" className="mt-4">
            <StockMovement />
          </TabsContent>

          <TabsContent value="adjustments" className="mt-4">
            <InventoryAdjustments />
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <LowStockAlerts />
          </TabsContent>

          <TabsContent value="reports" role="tabpanel" aria-labelledby="reports-tab" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  Inventory Reports
                </CardTitle>
                <CardDescription>
                  Generate comprehensive inventory reports and analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`} role="region" aria-label="Available reports">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Stock Valuation Report</CardTitle>
                      <CardDescription className="text-sm">
                        Current inventory value by category
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Movement History</CardTitle>
                      <CardDescription className="text-sm">
                        Detailed stock movement analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Low Stock Summary</CardTitle>
                      <CardDescription className="text-sm">
                        Products below minimum levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">ABC Analysis</CardTitle>
                      <CardDescription className="text-sm">
                        Product performance classification
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Turnover Analysis</CardTitle>
                      <CardDescription className="text-sm">
                        Inventory turnover metrics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Barcode Labels</CardTitle>
                      <CardDescription className="text-sm">
                        Generate product barcode labels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">Generate</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" role="tabpanel" aria-labelledby="diagnostics-tab" className="mt-4">
            <NetworkDiagnosticsHelper />
          </TabsContent>
          
          <TabsContent value="debug" role="tabpanel" aria-labelledby="debug-tab" className="mt-4">
            <EnhancedInventoryDiagnostics />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CSVImport isOpen={showCSVImport} onClose={() => setShowCSVImport(false)} />
        <BarcodeGeneration isOpen={showBarcodeGen} onClose={() => setShowBarcodeGen(false)} />
        
        {/* Network Monitor */}
        <InventoryNetworkMonitor />
      </div>
      </EnhancedInventoryProvider>
    </InventoryErrorBoundary>);

};

export default InventoryPage;