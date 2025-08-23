
import React, { useState } from 'react';
import { Package, AlertTriangle, FileText, BarChart3, Upload, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { useLanguage } from '@/contexts/LanguageContext';

import ProductManagement from '@/components/inventory/ProductManagement';
import StockMovement from '@/components/inventory/StockMovement';
import InventoryAdjustments from '@/components/inventory/InventoryAdjustments';
import LowStockAlerts from '@/components/inventory/LowStockAlerts';
import CSVImport from '@/components/inventory/CSVImport';
import BarcodeGeneration from '@/components/inventory/BarcodeGeneration';

const InventoryPage = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('products');
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showBarcodeGen, setShowBarcodeGen] = useState(false);

  return (
    <InventoryProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('inventory')}</h1>
            <p className="text-muted-foreground">
              Comprehensive inventory management for Bangladeshi women's wear
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCSVImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" onClick={() => setShowBarcodeGen(true)}>
              <QrCode className="h-4 w-4 mr-2" />
              Generate Labels
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Main Inventory Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Stock Movement
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Adjustments
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Stock
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
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

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Inventory Reports
                </CardTitle>
                <CardDescription>
                  Generate comprehensive inventory reports and analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        </Tabs>

        {/* Dialogs */}
        <CSVImport isOpen={showCSVImport} onClose={() => setShowCSVImport(false)} />
        <BarcodeGeneration isOpen={showBarcodeGen} onClose={() => setShowBarcodeGen(false)} />
      </div>
    </InventoryProvider>);

};

export default InventoryPage;