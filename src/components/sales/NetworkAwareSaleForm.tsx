
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, CloudOff, Save } from 'lucide-react';
import { useNetworkApi } from '@/hooks/use-network-api';
import { useOnlineStatus } from '@/contexts/NetworkContext';

interface SaleFormData {
  customerName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
}

export function NetworkAwareSaleForm() {
  const { executeWithOfflineHandling, queueStatus } = useNetworkApi();
  const online = useOnlineStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<SaleFormData>({
    customerName: '',
    items: [{ name: 'Sample Item', quantity: 1, price: 25.00 }],
    total: 25.00,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await executeWithOfflineHandling(
        async () => {
          // Simulate API call
          const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              timestamp: new Date().toISOString(),
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to save sale');
          }

          return response.json();
        },
        {
          successMessage: 'Sale saved successfully',
          offlineMessage: 'Sale saved offline and will sync when connection is restored',
          errorMessage: 'Failed to save sale. Please try again.',
        }
      );

      // Reset form on successful save
      setFormData({
        customerName: '',
        items: [{ name: '', quantity: 1, price: 0 }],
        total: 0,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Create Sale</span>
          <div className="flex items-center gap-2">
            {!online && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {queueStatus.size > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                {queueStatus.size} queued
              </Badge>
            )}
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
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Items</Label>
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].name = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                  required
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].quantity = parseInt(e.target.value) || 1;
                    const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    setFormData({ ...formData, items: newItems, total: newTotal });
                  }}
                  required
                />
                <Input
                  type="number"
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].price = parseFloat(e.target.value) || 0;
                    const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    setFormData({ ...formData, items: newItems, total: newTotal });
                  }}
                  required
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-lg font-semibold">
              Total: ${formData.total.toFixed(2)}
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting || (!online && queueStatus.size >= 10)}
              aria-disabled={isSubmitting || (!online && queueStatus.size >= 10)}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : online ? 'Save Sale' : 'Save Offline'}
            </Button>
          </div>

          {!online && (
            <div className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>You're offline. Sales will be saved locally and synced when connection is restored.</span>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
