
import React from 'react';
import { ShoppingCart, Users, DollarSign, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { POSProvider } from '@/contexts/POSContext';
import ProductSearch from '@/components/pos/ProductSearch';
import ShoppingCartComponent from '@/components/pos/ShoppingCart';
import CustomerSelection from '@/components/pos/CustomerSelection';
import PaymentComponent from '@/components/pos/PaymentComponent';
import ReturnsExchanges from '@/components/pos/ReturnsExchanges';
import { useAuth } from '@/contexts/AuthContext';

const POSPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <POSProvider>
      <div className="min-h-screen bg-gray-50 p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
              <p className="text-gray-600">Cashier: {user?.username}</p>
            </div>
            <div className="flex gap-2">
              <ReturnsExchanges />
              <Button variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Quick Actions
              </Button>
            </div>
          </div>
        </div>

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
                <CardTitle className="flex items-center gap-2 text-sm">
                  Session Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="font-semibold text-blue-600">0</p>
                    <p className="text-gray-600">Transactions</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="font-semibold text-green-600">$0.00</p>
                    <p className="text-gray-600">Total Sales</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <p className="font-semibold text-yellow-600">0</p>
                    <p className="text-gray-600">Items Sold</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <p className="font-semibold text-purple-600">0</p>
                    <p className="text-gray-600">Returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Help</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2 text-xs text-gray-600">
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
      </div>
    </POSProvider>);

};

export default POSPage;