
import React, { useState } from 'react';
import { Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePurchaseOrder } from '@/contexts/PurchaseOrderContext';
import { PurchaseOrder } from '@/types/purchase';

interface POReceivingProcessProps {
  purchaseOrder?: PurchaseOrder | null;
  onClose: () => void;
}

const POReceivingProcess: React.FC<POReceivingProcessProps> = ({ purchaseOrder, onClose }) => {
  const { receivePOItems } = usePurchaseOrder();
  const [loading, setLoading] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [receivingItems, setReceivingItems] = useState(
    purchaseOrder?.items.map((item) => ({
      po_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity_ordered: item.quantity_ordered,
      quantity_received_previously: item.quantity_received,
      quantity_receiving: 0,
      unit_cost: item.unit_cost,
      total_cost: 0,
      condition: 'good' as 'good' | 'damaged' | 'partial',
      notes: ''
    })) || []
  );

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...receivingItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    if (field === 'quantity_receiving') {
      updatedItems[index].total_cost = value * updatedItems[index].unit_cost;
    }

    setReceivingItems(updatedItems);
  };

  const handleReceiveAll = () => {
    const updatedItems = receivingItems.map((item) => ({
      ...item,
      quantity_receiving: Math.max(0, item.quantity_ordered - item.quantity_received_previously),
      total_cost: Math.max(0, item.quantity_ordered - item.quantity_received_previously) * item.unit_cost
    }));
    setReceivingItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const itemsToReceive = receivingItems.filter((item) => item.quantity_receiving > 0);

      if (itemsToReceive.length === 0) {
        alert('Please specify quantities to receive');
        setLoading(false);
        return;
      }

      await receivePOItems({
        po_id: purchaseOrder?.id,
        received_date: receivedDate,
        received_by: 'current-user',
        notes,
        items: itemsToReceive.map((item) => ({
          po_item_id: item.po_item_id,
          product_id: item.product_id,
          quantity_received: item.quantity_receiving,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          condition: item.condition,
          notes: item.notes
        }))
      });

      onClose();
    } catch (error) {
      console.error('Error receiving items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalReceiving = () => {
    return receivingItems.reduce((sum, item) => sum + item.quantity_receiving, 0);
  };

  const getTotalValue = () => {
    return receivingItems.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const getReceivingStatus = (item: any) => {
    const remaining = item.quantity_ordered - item.quantity_received_previously;
    if (remaining === 0) return 'complete';
    if (item.quantity_received_previously > 0) return 'partial';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receiving Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">PO Number</p>
              <p className="font-semibold">{purchaseOrder?.po_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Supplier</p>
              <p className="font-semibold">{purchaseOrder?.supplier_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <Badge variant="outline">{purchaseOrder?.status?.toUpperCase()}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="received_date">Received Date *</Label>
              <Input
                id="received_date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                required />

            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Receiving notes" />

            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Items to Receive</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={handleReceiveAll}>

              Receive All Outstanding
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Previously Received</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Receiving Now</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivingItems.map((item, index) => {
                const outstanding = item.quantity_ordered - item.quantity_received_previously;
                const status = getReceivingStatus(item);

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-600">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.quantity_ordered}</TableCell>
                    <TableCell>{item.quantity_received_previously}</TableCell>
                    <TableCell>
                      <span className={outstanding > 0 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                        {outstanding}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity_receiving}
                        onChange={(e) => handleItemChange(index, 'quantity_receiving', parseInt(e.target.value) || 0)}
                        className="w-20"
                        min="0"
                        max={outstanding}
                        disabled={outstanding === 0} />

                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.condition}
                        onValueChange={(value) => handleItemChange(index, 'condition', value)}
                        disabled={item.quantity_receiving === 0}>

                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                        status === 'complete' ? 'default' :
                        status === 'partial' ? 'outline' : 'secondary'
                        }
                        className="flex items-center gap-1 w-fit">

                        {status === 'complete' ?
                        <CheckCircle className="h-3 w-3" /> :
                        status === 'partial' ?
                        <AlertTriangle className="h-3 w-3" /> :
                        null}
                        {status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>);

              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items Receiving</p>
              <p className="text-2xl font-bold">{getTotalReceiving()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold">
                {purchaseOrder?.currency} {getTotalValue().toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || getTotalReceiving() === 0}>

          {loading ? 'Processing...' : `Receive ${getTotalReceiving()} Items`}
        </Button>
      </div>
    </div>);

};

export default POReceivingProcess;