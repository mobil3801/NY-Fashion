
import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, FileText, BarChart3, Upload, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';

// Import accessibility utilities for dev mode
if (import.meta.env.DEV) {
  import('@/utils/contrast-checker').then(({ reportContrastIssues }) => {
    // Auto-run contrast check in dev mode after component mounts
    setTimeout(() => {
      reportContrastIssues();
    }, 2000);
  });
}

import ProductManagement from '@/components/inventory/ProductManagement';
import StockMovement from '@/components/inventory/StockMovement';
import InventoryAdjustments from '@/components/inventory/InventoryAdjustments';
import LowStockAlerts from '@/components/inventory/LowStockAlerts';
import CSVImport from '@/components/inventory/CSVImport';
import BarcodeGeneration from '@/components/inventory/BarcodeGeneration';
import NetworkDiagnosticsHelper from '@/components/network/NetworkDiagnosticsHelper';

const InventoryPage = () => {
  const { t } = useLanguage();
  const { online, connectionState, errorDetails } = useNetwork();
  const [activeTab, setActiveTab] = useState('products');
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showBarcodeGen, setShowBarcodeGen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Auto-show diagnostics if there are persistent connection issues
  useEffect(() => {
    if (!online && connectionState === 'offline' && errorDetails) {
      const timer = setTimeout(() => {
        setShowDiagnostics(true);
      }, 5000); // Show diagnostics after 5 seconds of being offline
      return () => clearTimeout(timer);
    }
  }, [online, connectionState, errorDetails]);

  return (
    <InventoryProvider>
      <div className="space-y-6">
        {/* Header with enhanced accessibility */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-default-aa">
              {t('inventory')}
            </h1>
            <p className="text-muted-aa mt-2">
              Comprehensive inventory management for Bangladeshi women's wear
            </p>
          </div>
          <div className="flex gap-2" role="toolbar" aria-label="Inventory actions">
            <Button
              variant="outline"
              onClick={() => setShowCSVImport(true)}
              className="btn-outline-aa focus-aa touch-target-aa"
              aria-label="Import products from CSV file">



              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBarcodeGen(true)}
              className="btn-outline-aa focus-aa touch-target-aa"
              aria-label="Generate barcode labels for products">



              <QrCode className="h-4 w-4 mr-2" aria-hidden="true" />
              Generate Labels
            </Button>
            <Button
              variant="outline"
              className="btn-outline-aa focus-aa touch-target-aa"
              aria-label="Export inventory data">



              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        {/* Main Inventory Interface with enhanced accessibility */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6" role="tablist" aria-label="Inventory management sections">
            <TabsTrigger
              value="products"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="Manage products and variants">



              <Package className="h-4 w-4" aria-hidden="true" />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="stock"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="View and manage stock movements">



              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Stock Movement
            </TabsTrigger>
            <TabsTrigger
              value="adjustments"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="Make inventory adjustments">



              <FileText className="h-4 w-4" aria-hidden="true" />
              Adjustments
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="View low stock alerts and critical items">



              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Low Stock
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="Generate inventory reports and analytics">



              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Reports
            </TabsTrigger>
            <TabsTrigger
              value="diagnostics"
              className="flex items-center gap-2 focus-aa text-default-aa"
              aria-label="Network diagnostics and troubleshooting">



              <Package className="h-4 w-4" aria-hidden="true" />
              Diagnostics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="stock">
            <StockMovement />
          </TabsContent>

          <TabsContent value="adjustments">
            <InventoryAdjustments />
          </TabsContent>

          <TabsContent value="alerts">
            <LowStockAlerts />
          </TabsContent>

          <TabsContent value="reports" role="tabpanel" aria-labelledby="reports-tab">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-default-aa">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  Inventory Reports
                </CardTitle>
                <CardDescription className="text-muted-aa">
                  Generate comprehensive inventory reports and analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="region" aria-label="Available reports">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Stock Valuation Report</CardTitle>
                      <CardDescription className="text-sm">
                        Current inventory value by category
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm">Generate</Button>
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
                      <Button variant="outline" size="sm">Generate</Button>
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
                      <Button variant="outline" size="sm">Generate</Button>
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
                      <Button variant="outline" size="sm">Generate</Button>
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
                      <Button variant="outline" size="sm">Generate</Button>
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
                      <Button variant="outline" size="sm">Generate</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" role="tabpanel" aria-labelledby="diagnostics-tab">
            <NetworkDiagnosticsHelper />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CSVImport isOpen={showCSVImport} onClose={() => setShowCSVImport(false)} />
        <BarcodeGeneration isOpen={showBarcodeGen} onClose={() => setShowBarcodeGen(false)} />
      </div>
    </InventoryProvider>);

};

export default InventoryPage;