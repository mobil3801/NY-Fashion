import React, { useState } from 'react';
import { ShoppingCart, Users, DollarSign, RotateCcw, Menu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { POSProvider } from '@/contexts/POSContext';
import ProductSearch from '@/components/pos/ProductSearch';
import ShoppingCartComponent from '@/components/pos/ShoppingCart';
import CustomerSelection from '@/components/pos/CustomerSelection';
import PaymentComponent from '@/components/pos/PaymentComponent';
import ReturnsExchanges from '@/components/pos/ReturnsExchanges';
import NetworkAwarePOSOperations from '@/components/pos/NetworkAwarePOSOperations';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const POSPage: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('search');

  const handleCreateSale = async (saleData: any) => {
    // This would integrate with your actual POS sale creation logic
    console.log('Creating sale:', saleData);
    // Simulate API call
    return new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleProcessReturn = async (returnData: any) => {
    // This would integrate with your actual return processing logic
    console.log('Processing return:', returnData);
    return new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleSyncOfflineData = async () => {
    // This would sync all pending offline operations
    console.log('Syncing offline data...');
    return new Promise((resolve) => setTimeout(resolve, 2000));
  };

  return (
    <POSProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b p-4">
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Point of Sale</h1>
              <p className="text-gray-600 text-sm">Cashier: {user?.name || user?.email}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <ReturnsExchanges />
              <Button variant="outline" size={isMobile ? "sm" : "default"}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {isMobile ? "Actions" : "Quick Actions"}
              </Button>
            </div>
          </div>
        </div>

        {/* Network Operations Bar */}
        <div className="bg-blue-50 border-b p-3">
          <NetworkAwarePOSOperations
            onCreateSale={handleCreateSale}
            onProcessReturn={handleProcessReturn}
            onSyncOfflineData={handleSyncOfflineData} />

        </div>

        {/* Mobile Tabs Layout */}
        {isMobile ?
        <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="search" className="text-xs">
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="cart" className="text-xs">
                  <Menu className="h-4 w-4 mr-1" />
                  Cart
                </TabsTrigger>
                <TabsTrigger value="customer" className="text-xs">
                  <Users className="h-4 w-4 mr-1" />
                  Customer
                </TabsTrigger>
                <TabsTrigger value="payment" className="text-xs">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Payment
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Product Search
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductSearch />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cart" className="space-y-4">
                <ShoppingCartComponent />
              </TabsContent>

              <TabsContent value="customer" className="space-y-4">
                <CustomerSelection />
                
                {/* Quick Stats for Mobile */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Session Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="font-semibold text-blue-600 text-lg">0</p>
                        <p className="text-gray-600">Transactions</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="font-semibold text-green-600 text-lg">$0.00</p>
                        <p className="text-gray-600">Total Sales</p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <p className="font-semibold text-yellow-600 text-lg">0</p>
                        <p className="text-gray-600">Items Sold</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="font-semibold text-purple-600 text-lg">0</p>
                        <p className="text-gray-600">Returns</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4">
                <PaymentComponent />
                
                {/* Help Card for Mobile */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Help</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p><strong>Tap Search:</strong> Add products to cart</p>
                      <p><strong>Tap Cart:</strong> Review and modify items</p>
                      <p><strong>Tap Customer:</strong> Select or add customer</p>
                      <p><strong>Tap Payment:</strong> Complete transaction</p>
                      <p><strong>Long press:</strong> Quick actions on items</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div> : (

        /* Desktop Layout */
        <div className="p-4 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Product Search and Cart */}
              <div className="lg:col-span-2 space-y-6">
                {/* Product Search */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Product Search
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductSearch />
                  </CardContent>
                </Card>

                {/* Shopping Cart */}
                <ShoppingCartComponent />
              </div>

              {/* Right Column - Customer and Payment */}
              <div className="space-y-6">
                {/* Customer Selection */}
                <CustomerSelection />

                {/* Payment */}
                <PaymentComponent />

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      Session Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="font-semibold text-blue-600 text-xl">0</p>
                        <p className="text-gray-600">Transactions</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="font-semibold text-green-600 text-xl">$0.00</p>
                        <p className="text-gray-600">Total Sales</p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <p className="font-semibold text-yellow-600 text-xl">0</p>
                        <p className="text-gray-600">Items Sold</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="font-semibold text-purple-600 text-xl">0</p>
                        <p className="text-gray-600">Returns</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Help Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Help</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p><strong>F1:</strong> Focus product search</p>
                      <p><strong>F2:</strong> Focus customer search</p>
                      <p><strong>F3:</strong> Open returns dialog</p>
                      <p><strong>Enter:</strong> Search/scan barcode</p>
                      <p><strong>Esc:</strong> Clear current selection</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>)
        }
      </div>
    </POSProvider>);

};

export default POSPage;