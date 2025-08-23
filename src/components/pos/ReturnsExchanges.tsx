
import React, { useState } from 'react';
import { RotateCcw, Search, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Invoice, ReturnItem, CartItem } from '@/types/pos';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const ReturnsExchanges: React.FC = () => {
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [originalInvoice, setOriginalInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [exchangeItems, setExchangeItems] = useState<CartItem[]>([]);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { addToCart } = usePOS();
  const { user } = useAuth();
  const { toast } = useToast();

  const returnReasons = [
  'Defective item',
  'Wrong size/color',
  'Customer changed mind',
  'Item not as described',
  'Damaged during shipping',
  'Other'];


  const searchInvoice = async () => {
    if (!invoiceSearch) return;

    setIsLoading(true);
    try {
      // Mock invoice data - replace with actual database query
      const mockInvoice: Invoice = {
        id: 'inv-1',
        invoiceNumber: invoiceSearch,
        customerId: 'cust-1',
        customer: {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-0123',
          createdAt: '2024-01-01T00:00:00Z'
        },
        items: [
        {
          id: 'item-1',
          product: {
            id: 'prod-1',
            sku: 'TSHIRT-001',
            name: 'Basic Cotton T-Shirt',
            description: 'Comfortable cotton t-shirt',
            category: 'Apparel',
            basePrice: 25.99,
            isApparel: true,
            isActive: true,
            currentStock: 50,
            minStockLevel: 10,
            variants: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          variant: {
            id: 'var-1',
            productId: 'prod-1',
            size: 'M',
            color: 'Blue',
            sku: 'TSHIRT-001-M-BLU',
            priceAdjustment: 0,
            stockQuantity: 20
          },
          quantity: 2,
          unitPrice: 25.99,
          lineDiscount: 0,
          lineDiscountType: 'percentage',
          subtotal: 51.98
        }],

        subtotal: 51.98,
        orderDiscount: 0,
        orderDiscountType: 'percentage',
        taxAmount: 4.35,
        totalAmount: 56.33,
        paymentMethod: { type: 'cash', name: 'Cash' },
        paymentDetails: { amountPaid: 60, changeGiven: 3.67 },
        cashierId: user?.id || '',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        status: 'completed'
      };

      if (invoiceSearch === mockInvoice.invoiceNumber) {
        setOriginalInvoice(mockInvoice);
        // Initialize return items with zero quantities
        setReturnItems(mockInvoice.items.map((item) => ({
          originalCartItemId: item.id,
          quantity: 0,
          reason: ''
        })));
      } else {
        throw new Error('Invoice not found');
      }
    } catch (error) {
      toast({
        title: 'Invoice Not Found',
        description: 'Please check the invoice number and try again',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateReturnQuantity = (itemId: string, quantity: number) => {
    setReturnItems((prev) => prev.map((item) =>
    item.originalCartItemId === itemId ?
    { ...item, quantity: Math.max(0, quantity) } :
    item
    ));
  };

  const updateReturnReason = (itemId: string, reason: string) => {
    setReturnItems((prev) => prev.map((item) =>
    item.originalCartItemId === itemId ?
    { ...item, reason } :
    item
    ));
  };

  const calculateReturnAmount = () => {
    if (!originalInvoice) return 0;

    return returnItems.reduce((total, returnItem) => {
      const originalItem = originalInvoice.items.find((item) => item.id === returnItem.originalCartItemId);
      if (originalItem && returnItem.quantity > 0) {
        return total + originalItem.unitPrice * returnItem.quantity;
      }
      return total;
    }, 0);
  };

  const processReturn = async () => {
    if (!originalInvoice) return;

    const itemsToReturn = returnItems.filter((item) => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to return',
        variant: 'destructive'
      });
      return;
    }

    // Validate return reasons
    const invalidItems = itemsToReturn.filter((item) => !item.reason);
    if (invalidItems.length > 0) {
      toast({
        title: 'Missing Return Reasons',
        description: 'Please provide reasons for all returned items',
        variant: 'destructive'
      });
      return;
    }

    try {
      const returnAmount = calculateReturnAmount();

      // Create return record
      const returnExchange = {
        id: `return-${Date.now()}`,
        originalInvoiceId: originalInvoice.id,
        returnItems: itemsToReturn,
        returnAmount,
        exchangeAmount: 0,
        refundAmount: returnAmount,
        reason: returnReason,
        processedBy: user?.id || '',
        createdAt: new Date().toISOString()
      };

      // TODO: Save return to database
      // TODO: Update stock levels
      // TODO: Process refund

      toast({
        title: 'Return Processed',
        description: `Return processed successfully. Refund amount: $${returnAmount.toFixed(2)}`
      });

      // Reset form
      setOriginalInvoice(null);
      setReturnItems([]);
      setReturnReason('');
      setInvoiceSearch('');
      setShowReturnDialog(false);

    } catch (error) {
      toast({
        title: 'Return Error',
        description: 'Failed to process return',
        variant: 'destructive'
      });
    }
  };

  const addReturnedItemToCart = (originalItem: CartItem, returnQuantity: number) => {
    // Add returned item back to cart for exchange
    addToCart(originalItem.product, originalItem.variant, returnQuantity);
    toast({
      title: 'Item Added',
      description: 'Item added to cart for exchange'
    });
  };

  return (
    <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          Returns & Exchanges
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Returns & Exchanges</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Search */}
          <div className="space-y-3">
            <h3 className="font-medium">Find Original Invoice</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter invoice number..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchInvoice()} />

              <Button onClick={searchInvoice} disabled={isLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Original Invoice Details */}
          {originalInvoice &&
          <>
              <Separator />
              <div>
                <h3 className="font-medium mb-3">Original Invoice Details</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p><strong>Invoice:</strong> {originalInvoice.invoiceNumber}</p>
                        <p><strong>Date:</strong> {new Date(originalInvoice.createdAt).toLocaleDateString()}</p>
                        <p><strong>Total:</strong> ${originalInvoice.totalAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        {originalInvoice.customer &&
                      <>
                            <p><strong>Customer:</strong> {originalInvoice.customer.name}</p>
                            <p><strong>Email:</strong> {originalInvoice.customer.email}</p>
                            <p><strong>Phone:</strong> {originalInvoice.customer.phone}</p>
                          </>
                      }
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Items to Return</h4>
                      {originalInvoice.items.map((originalItem, index) => {
                      const returnItem = returnItems.find((item) => item.originalCartItemId === originalItem.id);
                      return (
                        <div key={originalItem.id} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h5 className="font-medium">{originalItem.product.name}</h5>
                                {originalItem.variant &&
                              <p className="text-sm text-gray-600">
                                    {originalItem.variant.size && `Size: ${originalItem.variant.size}`}
                                    {originalItem.variant.color && ` Color: ${originalItem.variant.color}`}
                                  </p>
                              }
                                <p className="text-sm text-gray-600">
                                  Original Quantity: {originalItem.quantity} × ${originalItem.unitPrice.toFixed(2)}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                ${originalItem.subtotal.toFixed(2)}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="text-sm font-medium">Return Quantity</label>
                                <Input
                                type="number"
                                min="0"
                                max={originalItem.quantity}
                                value={returnItem?.quantity || 0}
                                onChange={(e) => updateReturnQuantity(originalItem.id, parseInt(e.target.value) || 0)} />

                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">Reason</label>
                                <Select
                                value={returnItem?.reason || ''}
                                onValueChange={(value) => updateReturnReason(originalItem.id, value)}
                                disabled={!returnItem?.quantity || returnItem.quantity === 0}>

                                  <SelectTrigger>
                                    <SelectValue placeholder="Select reason" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {returnReasons.map((reason) =>
                                  <SelectItem key={reason} value={reason}>
                                        {reason}
                                      </SelectItem>
                                  )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-end">
                                <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addReturnedItemToCart(originalItem, returnItem?.quantity || 0)}
                                disabled={!returnItem?.quantity || returnItem.quantity === 0}
                                className="w-full">

                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Exchange
                                </Button>
                              </div>
                            </div>
                          </div>);

                    })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Return Summary */}
              <div>
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3">Return Summary</h4>
                    
                    <div>
                      <label className="text-sm font-medium">Overall Reason (Optional)</label>
                      <Textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Additional notes about the return..."
                      className="mt-1" />

                    </div>

                    <Separator className="my-4" />

                    <div className="flex justify-between items-center mb-4">
                      <span className="font-medium">Total Refund Amount:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${calculateReturnAmount().toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                      variant="outline"
                      onClick={() => setShowReturnDialog(false)}>

                        Cancel
                      </Button>
                      <Button
                      onClick={processReturn}
                      disabled={calculateReturnAmount() === 0}
                      className="bg-red-600 hover:bg-red-700">

                        Process Return
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          }
        </div>
      </DialogContent>
    </Dialog>);

};

export default ReturnsExchanges;