
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, CloudOff, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { toast } from '@/hooks/use-toast';

interface SaleFormData {
  customerName: string;
  items: {name: string;quantity: number;price: number;}[];
  total: number;
}

interface QueuedSale {
  id: string;
  formData: SaleFormData;
  timestamp: number;
  idempotencyKey: string;
}

export function NetworkAwareSaleForm() {
  const { online, retryNow } = useNetwork();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [queuedSales, setQueuedSales] = useState<QueuedSale[]>([]);

  const [formData, setFormData] = useState<SaleFormData>({
    customerName: '',
    items: [{ name: 'Sample Item', quantity: 1, price: 25.00 }],
    total: 25.00
  });

  // Load queued sales from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('queued-sales');
    if (stored) {
      try {
        setQueuedSales(JSON.parse(stored));
      } catch (error) {
        console.warn('Failed to load queued sales:', error);
      }
    }
  }, []);

  // Save queued sales to localStorage
  const saveQueuedSales = (sales: QueuedSale[]) => {
    setQueuedSales(sales);
    localStorage.setItem('queued-sales', JSON.stringify(sales));
  };

  // Generate idempotency key
  const generateIdempotencyKey = () => {
    return `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Process queued sales when coming online
  useEffect(() => {
    if (online && queuedSales.length > 0) {
      processQueuedSales();
    }
  }, [online]);

  const processQueuedSales = async () => {
    const salesToProcess = [...queuedSales];
    let processedCount = 0;

    for (const queuedSale of salesToProcess) {
      try {
        await submitSaleToAPI(queuedSale.formData, queuedSale.idempotencyKey);

        // Remove from queue on success
        const remainingSales = queuedSales.filter((sale) => sale.id !== queuedSale.id);
        saveQueuedSales(remainingSales);
        processedCount++;
      } catch (error) {
        console.error('Failed to process queued sale:', error);
        // Keep in queue for later retry
      }
    }

    if (processedCount > 0) {
      toast({
        title: "Sync Complete",
        description: `${processedCount} offline sale(s) have been synced successfully`,
        variant: "default"
      });
    }
  };

  const submitSaleToAPI = async (saleData: SaleFormData, idempotencyKey: string) => {
    const response = await window.ezsite.apis.tableCreate(36856, {
      customer_name: saleData.customerName,
      subtotal_cents: Math.round(saleData.total * 100),
      tax_cents: 0,
      discount_cents: 0,
      total_cents: Math.round(saleData.total * 100),
      payment_method: 'cash',
      status: 'sale',
      created_by: 1, // Will be set by auth context
      idempotency_key: idempotencyKey,
      items: JSON.stringify(saleData.items)
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRetryAttempt(0);

    const idempotencyKey = generateIdempotencyKey();

    try {
      if (online) {
        // Try to submit directly when online
        await submitSaleToAPI(formData, idempotencyKey);

        toast({
          title: "Sale Saved",
          description: "Sale has been saved successfully",
          variant: "default"
        });

        // Reset form on successful save
        setFormData({
          customerName: '',
          items: [{ name: '', quantity: 1, price: 0 }],
          total: 0
        });
      } else {
        // Queue for offline processing
        const queuedSale: QueuedSale = {
          id: crypto.randomUUID(),
          formData: { ...formData },
          timestamp: Date.now(),
          idempotencyKey
        };

        const updatedQueue = [...queuedSales, queuedSale];
        saveQueuedSales(updatedQueue);

        toast({
          title: "Saved Offline",
          description: "Sale saved offline – will sync when online",
          variant: "default"
        });

        // Reset form after queuing
        setFormData({
          customerName: '',
          items: [{ name: '', quantity: 1, price: 0 }],
          total: 0
        });
      }
    } catch (error) {
      console.error('Sale submission failed:', error);

      if (!online) {
        // Queue the sale if offline
        const queuedSale: QueuedSale = {
          id: crypto.randomUUID(),
          formData: { ...formData },
          timestamp: Date.now(),
          idempotencyKey
        };

        const updatedQueue = [...queuedSales, queuedSale];
        saveQueuedSales(updatedQueue);

        toast({
          title: "Saved Offline",
          description: "Connection lost. Sale saved offline – will sync when online",
          variant: "default"
        });
      } else {
        setRetryAttempt((prev) => prev + 1);
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

  const handleRetryNow = async () => {
    setRetryAttempt(0);
    await retryNow();

    if (queuedSales.length > 0) {
      await processQueuedSales();
    }
  };

  return (
    <Card className="w-full max-w-2xl">
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
            {queuedSales.length > 0 &&
            <Badge variant="outline" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                {queuedSales.length} queued
              </Badge>
            }
            
            {retryAttempt > 0 &&
            <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Retry {retryAttempt}/3
              </Badge>
            }
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              placeholder="Enter customer name"
              required />

          </div>

          <div className="space-y-3">
            <Label>Items</Label>
            {formData.items.map((item, index) =>
            <div key={index} className="grid grid-cols-3 gap-3">
                <Input
                placeholder="Item name"
                value={item.name}
                onChange={(e) => {
                  const newItems = [...formData.items];
                  newItems[index].name = e.target.value;
                  setFormData({ ...formData, items: newItems });
                }}
                required />

                <Input
                type="number"
                placeholder="Qty"
                min="1"
                value={item.quantity}
                onChange={(e) => {
                  const newItems = [...formData.items];
                  newItems[index].quantity = parseInt(e.target.value) || 1;
                  const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
                  setFormData({ ...formData, items: newItems, total: newTotal });
                }}
                required />

                <Input
                type="number"
                placeholder="Price"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => {
                  const newItems = [...formData.items];
                  newItems[index].price = parseFloat(e.target.value) || 0;
                  const newTotal = newItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
                  setFormData({ ...formData, items: newItems, total: newTotal });
                }}
                required />

              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-lg font-semibold">
              Total: ${formData.total.toFixed(2)}
            </div>
            
            <div className="flex items-center gap-2">
              {retryAttempt > 0 && online &&
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryNow}
                className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry Now
                </Button>
              }
              
              <Button
                type="submit"
                disabled={isSubmitting || !online && queuedSales.length >= 10}
                aria-disabled={isSubmitting || !online && queuedSales.length >= 10}
                className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Saving...' : online ? 'Save Sale' : 'Save Offline'}
              </Button>
            </div>
          </div>

          {!online &&
          <div className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4" />
                  <span>You're offline. Sales will be saved locally and synced when connection is restored.</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleRetryNow}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Connection
                </Button>
              </div>
            </div>
          }

          {queuedSales.length > 0 && online &&
          <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudOff className="h-4 w-4" />
                  <span>{queuedSales.length} offline sale(s) waiting to sync...</span>
                </div>
                <Button variant="outline" size="sm" onClick={processQueuedSales} disabled={isSubmitting}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </div>
            </div>
          }
        </form>
      </CardContent>
    </Card>);

}