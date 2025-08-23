
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseOrderProvider } from '@/contexts/PurchaseOrderContext';
import SupplierManagement from '@/components/purchase/SupplierManagement';
import PurchaseOrderManagement from '@/components/purchase/PurchaseOrderManagement';
import { ShoppingCart, Building2, FileText, TrendingUp } from 'lucide-react';

const PurchasePage = () => {
  return (
    <PurchaseOrderProvider>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Purchase Management</h1>
        </div>

        <Tabs defaultValue="purchase-orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders">
            <PurchaseOrderManagement />
          </TabsContent>

          <TabsContent value="suppliers">
            <SupplierManagement />
          </TabsContent>
        </Tabs>
      </div>
    </PurchaseOrderProvider>);

};

export default PurchasePage;