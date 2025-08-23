
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Package, RefreshCw, ArrowRight } from 'lucide-react';
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

const StockMovement = () => {
  const { products, addStockMovement, getStockMovements } = useInventory();
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [loading, setLoading] = useState(false);

  const [movementForm, setMovementForm] = useState({
    product_id: '',
    variant_id: '',
    movement_type: '',
    quantity: 0,
    unit_cost: 0,
    notes: ''
  });

  const movementTypes = [
    { value: 'receipt', label: 'Stock Receipt', icon: TrendingUp, color: 'green' },
    { value: 'adjustment', label: 'Stock Adjustment', icon: RefreshCw, color: 'blue' },
    { value: 'sale', label: 'Sale', icon: TrendingDown, color: 'red' },
    { value: 'return', label: 'Return', icon: Package, color: 'orange' },
    { value: 'transfer', label: 'Transfer', icon: ArrowRight, color: 'purple' }
  ];

  const fetchMovements = async (productId: number, variantId?: number) => {
    try {
      setLoading(true);
      const data = await getStockMovements(productId, variantId);
      setMovements(data);
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addStockMovement({
        ...movementForm,
        product_id: parseInt(movementForm.product_id),
        variant_id: movementForm.variant_id ? parseInt(movementForm.variant_id) : undefined,
        total_cost: movementForm.quantity * movementForm.unit_cost,
        created_by: user?.id
      });

      setShowAddMovement(false);
      setMovementForm({
        product_id: '',
        variant_id: '',
        movement_type: '',
        quantity: 0,
        unit_cost: 0,
        notes: ''
      });

      if (selectedProduct) {
        fetchMovements(selectedProduct.id);
      }
    } catch (error) {
      console.error('Error adding movement:', error);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    return movementTypes.find(mt => mt.value === type) || movementTypes[0];
  };

  const formatMovementQuantity = (type: string, quantity: number) => {
    const sign = ['receipt', 'return', 'adjustment'].includes(type) && quantity > 0 ? '+' : '';
    return `${sign}${quantity}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Movements</h2>
          <p className="text-muted-foreground">
            Track all stock changes and inventory transactions
          </p>
        </div>
        <Dialog open={showAddMovement} onOpenChange={setShowAddMovement}>
          <DialogTrigger asChild>
            <Button>
              <Package className="h-4 w-4 mr-2" />
              Add Movement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock Movement</DialogTitle>
              <DialogDescription>
                Record a new stock movement transaction
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMovement} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product *</Label>
                <Select 
                  value={movementForm.product_id}
                  onValueChange={(value) => setMovementForm({ ...movementForm, product_id: value })}
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
                <Label htmlFor="movement_type">Movement Type *</Label>
                <Select 
                  value={movementForm.movement_type}
                  onValueChange={(value) => setMovementForm({ ...movementForm, movement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select movement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {movementTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_cost">Unit Cost (৳)</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    value={movementForm.unit_cost}
                    onChange={(e) => setMovementForm({ ...movementForm, unit_cost: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  placeholder="Additional notes or reason for movement..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => setShowAddMovement(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Add Movement
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Movement Type Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {movementTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.value}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {type.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle>View Stock Movements</CardTitle>
          <CardDescription>
            Select a product to view its stock movement history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select 
              onValueChange={(value) => {
                const product = products.find(p => p.id!.toString() === value);
                setSelectedProduct(product);
                if (product) fetchMovements(product.id);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id!.toString()}>
                    {product.name} ({product.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <Badge variant="outline">
                Current Stock: {selectedProduct.total_stock || 0} {selectedProduct.unit}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      {selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle>Movement History - {selectedProduct.name}</CardTitle>
            <CardDescription>
              All stock movements for this product
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : movements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const typeInfo = getMovementTypeInfo(movement.movement_type);
                    const Icon = typeInfo.icon;
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {new Date(movement.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <Badge variant="outline">
                              {typeInfo.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono ${
                            ['receipt', 'return'].includes(movement.movement_type) ? 'text-green-600' : 
                            ['sale', 'adjustment'].includes(movement.movement_type) ? 'text-red-600' : 
                            'text-blue-600'
                          }`}>
                            {formatMovementQuantity(movement.movement_type, movement.quantity)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {movement.unit_cost ? `৳${movement.unit_cost}` : '-'}
                        </TableCell>
                        <TableCell>
                          {movement.total_cost ? `৳${movement.total_cost}` : '-'}
                        </TableCell>
                        <TableCell>
                          {movement.notes || '-'}
                        </TableCell>
                        <TableCell>
                          {movement.created_by || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No stock movements found for this product
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockMovement;
