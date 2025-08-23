
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePurchaseOrder } from '@/contexts/PurchaseOrderContext';
import { useInventory } from '@/contexts/InventoryContext';
import { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase';

interface PurchaseOrderFormProps {
  purchaseOrder?: PurchaseOrder | null;
  onClose: () => void;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ purchaseOrder, onClose }) => {
  const { suppliers, savePurchaseOrder } = usePurchaseOrder();
  const { products } = useInventory();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: purchaseOrder?.supplier_id || '',
    supplier_name: purchaseOrder?.supplier_name || '',
    order_date: purchaseOrder?.order_date || new Date().toISOString().split('T')[0],
    expected_date: purchaseOrder?.expected_date || '',
    freight_cost: purchaseOrder?.freight_cost || 0,
    duty_cost: purchaseOrder?.duty_cost || 0,
    other_costs: purchaseOrder?.other_costs || 0,
    currency: purchaseOrder?.currency || 'USD',
    notes: purchaseOrder?.notes || '',
    status: purchaseOrder?.status || 'draft'
  });

  const [items, setItems] = useState<Partial<PurchaseOrderItem>[]>(
    purchaseOrder?.items || [
    {
      product_id: '',
      product_name: '',
      sku: '',
      quantity_ordered: 1,
      unit_cost: 0,
      total_cost: 0,
      description: ''
    }]

  );

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    setFormData((prev) => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier?.name || '',
      currency: supplier?.currency || 'USD'
    }));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const updatedItems = [...items];
      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        product_name: product.name,
        sku: product.sku,
        unit_cost: product.cost || 0,
        total_cost: (product.cost || 0) * (updatedItems[index].quantity_ordered || 1)
      };
      setItems(updatedItems);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    if (field === 'quantity_ordered' || field === 'unit_cost') {
      const quantity = field === 'quantity_ordered' ? value : updatedItems[index].quantity_ordered || 0;
      const unitCost = field === 'unit_cost' ? value : updatedItems[index].unit_cost || 0;
      updatedItems[index].total_cost = quantity * unitCost;
    }

    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([
    ...items,
    {
      product_id: '',
      product_name: '',
      sku: '',
      quantity_ordered: 1,
      unit_cost: 0,
      total_cost: 0,
      description: ''
    }]
    );
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
    const totalCost = subtotal + formData.freight_cost + formData.duty_cost + formData.other_costs;
    return { subtotal, totalCost };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { subtotal, totalCost } = calculateTotals();

      await savePurchaseOrder({
        ...formData,
        id: purchaseOrder?.id,
        subtotal,
        total_cost: totalCost,
        items: items.filter((item) => item.product_id),
        created_by: 'current-user' // In real app, get from auth context
      });

      onClose();
    } catch (error) {
      console.error('Error saving purchase order:', error);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalCost } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier *</Label>
              <Select value={formData.supplier_id} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) =>
                  <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
                required />

            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_date">Expected Date</Label>
              <Input
                id="expected_date"
                type="date"
                value={formData.expected_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, expected_date: e.target.value }))} />

            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Enter any additional notes"
              rows={3} />

          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) =>
              <TableRow key={index}>
                  <TableCell>
                    <Select
                    value={item.product_id}
                    onValueChange={(value) => handleProductChange(index, value)}>

                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) =>
                      <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                    value={item.sku}
                    readOnly
                    className="w-24" />

                  </TableCell>
                  <TableCell>
                    <Input
                    type="number"
                    value={item.quantity_ordered}
                    onChange={(e) => handleItemChange(index, 'quantity_ordered', parseInt(e.target.value) || 0)}
                    className="w-20"
                    min="1" />

                  </TableCell>
                  <TableCell>
                    <Input
                    type="number"
                    value={item.unit_cost}
                    onChange={(e) => handleItemChange(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                    className="w-24"
                    step="0.01"
                    min="0" />

                  </TableCell>
                  <TableCell>
                    {formData.currency} {(item.total_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}>

                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Landed Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Landed Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="freight_cost">Freight Cost</Label>
              <Input
                id="freight_cost"
                type="number"
                value={formData.freight_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, freight_cost: parseFloat(e.target.value) || 0 }))}
                step="0.01"
                min="0" />

            </div>
            <div className="space-y-2">
              <Label htmlFor="duty_cost">Duty Cost</Label>
              <Input
                id="duty_cost"
                type="number"
                value={formData.duty_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, duty_cost: parseFloat(e.target.value) || 0 }))}
                step="0.01"
                min="0" />

            </div>
            <div className="space-y-2">
              <Label htmlFor="other_costs">Other Costs</Label>
              <Input
                id="other_costs"
                type="number"
                value={formData.other_costs}
                onChange={(e) => setFormData((prev) => ({ ...prev, other_costs: parseFloat(e.target.value) || 0 }))}
                step="0.01"
                min="0" />

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formData.currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Freight:</span>
              <span>{formData.currency} {formData.freight_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Duty:</span>
              <span>{formData.currency} {formData.duty_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other:</span>
              <span>{formData.currency} {formData.other_costs.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formData.currency} {totalCost.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !formData.supplier_id || items.filter((item) => item.product_id).length === 0}>
          {loading ? 'Saving...' : purchaseOrder ? 'Update PO' : 'Create PO'}
        </Button>
      </div>
    </form>);

};

export default PurchaseOrderForm;