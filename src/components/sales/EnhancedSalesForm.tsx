
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, CloudOff, Save, RefreshCw, AlertTriangle, CheckCircle, Plus, Minus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNetwork } from '@/contexts/NetworkContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { networkAPI } from '@/lib/network/api-wrapper';
import { ApiError, ERROR_CODES } from '@/lib/errors';

interface SaleItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface SaleFormData {
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'cash' | 'other';
  notes: string;
}

interface QueuedSale {
  id: string;
  formData: SaleFormData;
  timestamp: number;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'failed';
}

export function EnhancedSalesForm() {
  const { online, retryNow } = useNetwork();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedSales, setQueuedSales] = useState<QueuedSale[]>([]);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);

  const [formData, setFormData] = useState<SaleFormData>({
    customerName: '',
    customerPhone: '',
    items: [{
      id: crypto.randomUUID(),
      productName: '',
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0
    }],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    notes: ''
  });

  // Load queued sales from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('queued-sales-v2');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQueuedSales(parsed.map((sale: any) => ({
          ...sale,
          status: sale.status || 'pending'
        })));
      } catch (error) {
        console.warn('Failed to load queued sales:', error);
        localStorage.removeItem('queued-sales-v2');
      }
    }
  }, []);

  // Save queued sales to localStorage
  const saveQueuedSales = useCallback((sales: QueuedSale[]) => {
    setQueuedSales(sales);
    localStorage.setItem('queued-sales-v2', JSON.stringify(sales));
  }, []);

  // Calculate totals when items change
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = subtotal * 0.08875; // NYC tax rate
    const total = subtotal + taxAmount - formData.discountAmount;

    setFormData((prev) => ({
      ...prev,
      subtotal,
      taxAmount,
      total: Math.max(0, total)
    }));
  }, [formData.items, formData.discountAmount]);

  // Process queued sales when coming online
  useEffect(() => {
    if (online && queuedSales.length > 0 && !isSyncing) {
      processQueuedSales();
    }
  }, [online, queuedSales.length]);

  const generateIdempotencyKey = () => {
    return `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateItemTotal = (index: number, quantity: number, unitPrice: number) => {
    const lineTotal = quantity * unitPrice;
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], quantity, unitPrice, lineTotal };

    setFormData((prev) => ({
      ...prev,
      items: newItems
    }));
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, {
        id: crypto.randomUUID(),
        productName: '',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0
      }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const submitSaleToAPI = async (saleData: SaleFormData, idempotencyKey: string) => {
    // Create the sale record
    const saleResponse = await window.ezsite.apis.tableCreate(36856, {
      invoice_no: `INV-${Date.now()}`,
      customer_name: saleData.customerName || null,
      subtotal_cents: Math.round(saleData.subtotal * 100),
      tax_cents: Math.round(saleData.taxAmount * 100),
      discount_cents: Math.round(saleData.discountAmount * 100),
      total_cents: Math.round(saleData.total * 100),
      payment_method: saleData.paymentMethod,
      status: 'sale',
      created_by: user?.ID || 1,
      notes: saleData.notes || null,
      idempotency_key: idempotencyKey
    });

    if (saleResponse.error) {
      throw new Error(saleResponse.error);
    }

    const saleId = saleResponse.data?.ID || saleResponse.data?.id;

    // Create sale items
    for (const item of saleData.items) {
      if (item.productName.trim()) {
        const itemResponse = await window.ezsite.apis.tableCreate(36857, {
          sale_id: saleId,
          variant_id: null, // Will need product lookup in real implementation
          qty: item.quantity,
          unit_price_cents: Math.round(item.unitPrice * 100),
          unit_cost_cents: Math.round(item.unitPrice * 100 * 0.6), // Assume 40% margin
          line_discount_cents: 0,
          product_name: item.productName // Store name for reference
        });

        if (itemResponse.error) {
          console.warn('Failed to create sale item:', itemResponse.error);
        }
      }
    }

    return saleResponse;
  };

  const processQueuedSales = async () => {
    if (!online || queuedSales.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setLastSyncAttempt(Date.now());

    const salesToProcess = queuedSales.filter((sale) => sale.status === 'pending');
    let processedCount = 0;
    let failedCount = 0;

    // Update all pending sales to syncing status
    const updatedSales = queuedSales.map((sale) =>
    sale.status === 'pending' ? { ...sale, status: 'syncing' as const } : sale
    );
    saveQueuedSales(updatedSales);

    for (const queuedSale of salesToProcess) {
      try {
        await submitSaleToAPI(queuedSale.formData, queuedSale.idempotencyKey);

        // Remove successfully synced sale
        const remainingSales = queuedSales.filter((sale) => sale.id !== queuedSale.id);
        saveQueuedSales(remainingSales);
        processedCount++;
      } catch (error) {
        console.error('Failed to process queued sale:', error);

        // Mark as failed
        const failedSales = queuedSales.map((sale) =>
        sale.id === queuedSale.id ?
        { ...sale, status: 'failed' as const } :
        sale
        );
        saveQueuedSales(failedSales);
        failedCount++;
      }
    }

    setIsSyncing(false);

    if (processedCount > 0) {
      toast({
        title: "Sync Complete",
        description: `${processedCount} offline sale(s) synced successfully`,
        variant: "default"
      });
    }

    if (failedCount > 0) {
      toast({
        title: "Sync Issues",
        description: `${failedCount} sale(s) failed to sync. Will retry later.`,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      });
      return;
    }

    if (formData.items.length === 0 || formData.items.every((item) => !item.productName.trim())) {
      toast({
        title: "Validation Error",
        description: "At least one item is required",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = generateIdempotencyKey();

    try {
      if (online) {
        // Try direct submission when online
        await networkAPI.createWithOfflineSupport(
          () => submitSaleToAPI(formData, idempotencyKey),
          'Sale'
        );

        // Reset form on successful save
        resetForm();
      } else {
        // Queue for offline processing
        const queuedSale: QueuedSale = {
          id: crypto.randomUUID(),
          formData: { ...formData },
          timestamp: Date.now(),
          idempotencyKey,
          status: 'pending'
        };

        const updatedQueue = [...queuedSales, queuedSale];
        saveQueuedSales(updatedQueue);

        toast({
          title: "Saved Offline",
          description: "Sale saved offline – will sync when online",
          variant: "default"
        });

        // Reset form after queuing
        resetForm();
      }
    } catch (error) {
      console.error('Sale submission failed:', error);

      if (error instanceof ApiError && error.code === ERROR_CODES.QUEUED_OFFLINE) {
        // Already queued, just reset form
        resetForm();
      } else if (!online || error instanceof ApiError && error.code === ERROR_CODES.NETWORK_OFFLINE) {
        // Queue the sale if offline or network error
        const queuedSale: QueuedSale = {
          id: crypto.randomUUID(),
          formData: { ...formData },
          timestamp: Date.now(),
          idempotencyKey,
          status: 'pending'
        };

        const updatedQueue = [...queuedSales, queuedSale];
        saveQueuedSales(updatedQueue);

        toast({
          title: "Saved Offline",
          description: "Connection lost. Sale saved offline – will sync when online",
          variant: "default"
        });

        resetForm();
      } else {
        toast({
          title: "Save Failed",
          description: "Failed to save sale. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      items: [{
        id: crypto.randomUUID(),
        productName: '',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0
      }],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      paymentMethod: 'cash',
      notes: ''
    });
  };

  const handleRetryNow = async () => {
    setLastSyncAttempt(Date.now());
    await retryNow();

    if (queuedSales.length > 0) {
      await processQueuedSales();
    }
  };

  const handleRetrySale = async (saleId: string) => {
    const saleToRetry = queuedSales.find((sale) => sale.id === saleId);
    if (!saleToRetry) return;

    try {
      setIsSyncing(true);
      await submitSaleToAPI(saleToRetry.formData, saleToRetry.idempotencyKey);

      // Remove successfully synced sale
      const remainingSales = queuedSales.filter((sale) => sale.id !== saleId);
      saveQueuedSales(remainingSales);

      toast({
        title: "Retry Successful",
        description: "Sale synced successfully",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Failed to sync sale. Will try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingSales = queuedSales.filter((sale) => sale.status === 'pending');
  const failedSales = queuedSales.filter((sale) => sale.status === 'failed');
  const syncingSales = queuedSales.filter((sale) => sale.status === 'syncing');

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Create Sale</span>
          <div className="flex items-center gap-2">
            {!online &&
            <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            }
            {pendingSales.length > 0 &&
            <Badge variant="outline" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                {pendingSales.length} queued
              </Badge>
            }
            {syncingSales.length > 0 &&
            <Badge variant="default" className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {syncingSales.length} syncing
              </Badge>
            }
            {failedSales.length > 0 &&
            <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {failedSales.length} failed
              </Badge>
            }
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                placeholder="Enter customer name"
                required />

            </div>
            <div>
              <Label htmlFor="customerPhone">Customer Phone</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="Enter customer phone" />

            </div>
          </div>

          {/* Sale Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="flex items-center gap-2"
                disabled={!online && formData.items.length >= 10}
                aria-disabled={!online && formData.items.length >= 10}>

                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {formData.items.map((item, index) =>
            <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  {index === 0 && <Label className="text-sm">Product Name</Label>}
                  <Input
                  placeholder="Product name"
                  value={item.productName}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index] = { ...newItems[index], productName: e.target.value };
                    setFormData((prev) => ({ ...prev, items: newItems }));
                  }}
                  required />

                </div>
                <div className="col-span-2">
                  {index === 0 && <Label className="text-sm">Quantity</Label>}
                  <Input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItemTotal(index, parseInt(e.target.value) || 1, item.unitPrice)}
                  required />

                </div>
                <div className="col-span-2">
                  {index === 0 && <Label className="text-sm">Unit Price</Label>}
                  <Input
                  type="number"
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItemTotal(index, item.quantity, parseFloat(e.target.value) || 0)}
                  required />

                </div>
                <div className="col-span-2">
                  {index === 0 && <Label className="text-sm">Line Total</Label>}
                  <Input
                  value={`$${item.lineTotal.toFixed(2)}`}
                  disabled
                  className="bg-muted" />

                </div>
                <div className="col-span-1">
                  {formData.items.length > 1 &&
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="h-10 w-10 p-0 text-destructive hover:text-destructive">

                      <Minus className="h-4 w-4" />
                    </Button>
                }
                </div>
              </div>
            )}
          </div>

          {/* Payment and Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value: 'cash' | 'other') =>
                  setFormData((prev) => ({ ...prev, paymentMethod: value }))
                  }>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other/External Device</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes" />

              </div>
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${formData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (8.875%):</span>
                <span>${formData.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    discountAmount: parseFloat(e.target.value) || 0
                  }))}
                  className="w-20 h-8 text-right" />

              </div>
              <hr />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>${formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2">
              {!online &&
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryNow}
                className="flex items-center gap-2"
                disabled={isSyncing}>

                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Retry Connection
                </Button>
              }
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting || isSyncing && !online}
              aria-disabled={isSubmitting || isSyncing && !online}
              className="flex items-center gap-2 min-w-[120px]">

              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : online ? 'Save Sale' : 'Save Offline'}
            </Button>
          </div>

          {/* Status Messages */}
          {!online &&
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>You're offline. Sales will be saved locally and synced when connection is restored.</span>
              </div>
            </div>
          }

          {queuedSales.length > 0 &&
          <div className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CloudOff className="h-4 w-4 text-blue-700" />
                  <span className="text-blue-700 font-medium">
                    {queuedSales.length} offline sale(s) waiting to sync
                  </span>
                </div>
                {online && !isSyncing &&
              <Button
                variant="outline"
                size="sm"
                onClick={processQueuedSales}
                className="text-blue-700 border-blue-300">

                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
              }
              </div>
              
              {failedSales.length > 0 &&
            <div className="space-y-1">
                  {failedSales.slice(0, 3).map((sale) =>
              <div key={sale.id} className="flex items-center justify-between text-xs">
                      <span>Sale for {sale.formData.customerName} - ${sale.formData.total.toFixed(2)}</span>
                      <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRetrySale(sale.id)}
                  className="h-6 px-2 text-red-600">

                        Retry
                      </Button>
                    </div>
              )}
                  {failedSales.length > 3 &&
              <div className="text-xs text-gray-600">
                      ...and {failedSales.length - 3} more
                    </div>
              }
                </div>
            }
            </div>
          }

          {lastSyncAttempt &&
          <div className="text-xs text-gray-500 text-center">
              Last sync attempt: {new Date(lastSyncAttempt).toLocaleTimeString()}
            </div>
          }
        </form>
      </CardContent>
    </Card>);

}