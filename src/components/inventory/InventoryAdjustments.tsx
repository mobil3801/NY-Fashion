
import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

const InventoryAdjustments = () => {
  const { products } = useInventory();
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [showCreateAdjustment, setShowCreateAdjustment] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [adjustmentForm, setAdjustmentForm] = useState({
    reason: '',
    notes: '',
    items: []
  });

  const [adjustmentItems, setAdjustmentItems] = useState<any[]>([]);

  const adjustmentReasons = [
    'Physical Count Discrepancy',
    'Damaged Goods',
    'Expired Items',
    'Theft/Loss',
    'System Error',
    'Supplier Return',
    'Other'
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const addAdjustmentItem = () => {
    setAdjustmentItems([
      ...adjustmentItems,
      {
        product_id: '',
        variant_id: '',
        current_stock: 0,
        adjusted_stock: 0,
        difference: 0,
        unit_cost: 0,
        reason: ''
      }
    ]);
  };

  const removeAdjustmentItem = (index: number) => {
    setAdjustmentItems(adjustmentItems.filter((_, i) => i !== index));
  };

  const updateAdjustmentItem = (index: number, field: string, value: any) => {
    const updated = [...adjustmentItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calculate difference when stock values change
    if (field === 'current_stock' || field === 'adjusted_stock') {
      updated[index].difference = updated[index].adjusted_stock - updated[index].current_stock;
    }
    
    setAdjustmentItems(updated);
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const adjustmentData = {
        ...adjustmentForm,
        items: adjustmentItems,
        created_by: user?.id
      };

      // TODO: Call API to create adjustment
      console.log('Creating adjustment:', adjustmentData);
      
      setShowCreateAdjustment(false);
      setAdjustmentForm({ reason: '', notes: '', items: [] });
      setAdjustmentItems([]);
      
    } catch (error) {
      console.error('Error creating adjustment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Adjustments</h2>
          <p className="text-muted-foreground">
            Create and manage stock adjustments with proper authorization
          </p>
        </div>
        {hasPermission(user, 'inventory', 'create') && (
          <Dialog open={showCreateAdjustment} onOpenChange={setShowCreateAdjustment}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Inventory Adjustment</DialogTitle>
                <DialogDescription>
                  Create a new inventory adjustment with proper documentation
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateAdjustment} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Adjustment Reason *</Label>
                    <Select 
                      value={adjustmentForm.reason}
                      onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, reason: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {adjustmentReasons.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adjustment_date">Adjustment Date</Label>
                    <Input
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={adjustmentForm.notes}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                    placeholder="Additional notes about this adjustment..."
                    rows={3}
                  />
                </div>

                {/* Adjustment Items */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Adjustment Items</h3>
                    <Button type="button" variant="outline" onClick={addAdjustmentItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {adjustmentItems.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-6 gap-4">
                          <div className="col-span-2 space-y-2">
                            <Label>Product *</Label>
                            <Select 
                              value={item.product_id}
                              onValueChange={(value) => {
                                const product = products.find(p => p.id!.toString() === value);
                                updateAdjustmentItem(index, 'product_id', value);
                                updateAdjustmentItem(index, 'current_stock', product?.total_stock || 0);
                                updateAdjustmentItem(index, 'unit_cost', product?.cost_price || 0);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id!.toString()}>
                                    {product.name} ({product.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Current Stock</Label>
                            <Input
                              type="number"
                              value={item.current_stock}
                              onChange={(e) => updateAdjustmentItem(index, 'current_stock', parseInt(e.target.value) || 0)}
                              readOnly
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Adjusted Stock *</Label>
                            <Input
                              type="number"
                              value={item.adjusted_stock}
                              onChange={(e) => updateAdjustmentItem(index, 'adjusted_stock', parseInt(e.target.value) || 0)}
                              placeholder="New stock level"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Difference</Label>
                            <Input
                              type="number"
                              value={item.difference}
                              readOnly
                              className={`${
                                item.difference > 0 ? 'text-green-600' : 
                                item.difference < 0 ? 'text-red-600' : ''
                              }`}
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAdjustmentItem(index)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <Label>Item Notes</Label>
                          <Input
                            value={item.reason}
                            onChange={(e) => updateAdjustmentItem(index, 'reason', e.target.value)}
                            placeholder="Specific reason for this item adjustment..."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {adjustmentItems.length === 0 && (
                    <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        No items added yet. Click "Add Item" to start.
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="flex justify-end space-x-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateAdjustment(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || adjustmentItems.length === 0}>
                    {loading ? 'Creating...' : 'Create Adjustment'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Adjustments List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Adjustments</CardTitle>
              <CardDescription>
                All inventory adjustments requiring approval
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search adjustments..." className="w-64" />
              <Button variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length > 0 ? (
                adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell className="font-mono">
                      {adjustment.adjustment_number}
                    </TableCell>
                    <TableCell>
                      {new Date(adjustment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                    <TableCell>{adjustment.total_items}</TableCell>
                    <TableCell>৳{adjustment.total_value}</TableCell>
                    <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                    <TableCell>{adjustment.created_by}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4" />
                        </Button>
                        {adjustment.status === 'pending' && hasPermission(user, 'inventory', 'approve') && (
                          <>
                            <Button variant="ghost" size="sm">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No inventory adjustments found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryAdjustments;
