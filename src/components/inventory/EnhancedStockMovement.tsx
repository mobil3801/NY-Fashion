
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Package, RefreshCw, ArrowRight, CheckCircle, X, Loader2, AlertCircle, History, Undo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';

interface PendingMovement {
  id: string;
  originalData: any;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface ValidationState {
  [key: string]: {
    isValid: boolean;
    message: string;
  };
}

const EnhancedStockMovement = () => {
  const { products, addStockMovement, getStockMovements } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>({});

  // Optimistic updates and conflicts
  const [pendingMovements, setPendingMovements] = useState<PendingMovement[]>([]);
  const [conflictResolution, setConflictResolution] = useState<any>(null);

  // Form state with validation
  const [movementForm, setMovementForm] = useState({
    product_id: '',
    variant_id: '',
    movement_type: '',
    quantity: 0,
    unit_cost: 0,
    notes: '',
    expectedStock: 0 // For conflict detection
  });

  const movementTypes = [
  { value: 'receipt', label: 'Stock Receipt', icon: TrendingUp, color: 'green' },
  { value: 'adjustment', label: 'Stock Adjustment', icon: RefreshCw, color: 'blue' },
  { value: 'sale', label: 'Sale', icon: TrendingDown, color: 'red' },
  { value: 'return', label: 'Return', icon: Package, color: 'orange' },
  { value: 'transfer', label: 'Transfer', icon: ArrowRight, color: 'purple' }];


  // Real-time form validation
  const validateField = useCallback((field: string, value: any) => {
    const validations: ValidationState = { ...validationState };

    switch (field) {
      case 'product_id':
        validations[field] = {
          isValid: !!value,
          message: !value ? 'Product is required' : ''
        };
        break;
      case 'movement_type':
        validations[field] = {
          isValid: !!value,
          message: !value ? 'Movement type is required' : ''
        };
        break;
      case 'quantity':
        const qty = parseInt(value) || 0;
        validations[field] = {
          isValid: qty > 0,
          message: qty <= 0 ? 'Quantity must be greater than 0' : ''
        };
        break;
      case 'unit_cost':
        const cost = parseFloat(value) || 0;
        validations[field] = {
          isValid: cost >= 0,
          message: cost < 0 ? 'Unit cost cannot be negative' : ''
        };
        break;
    }

    setValidationState(validations);
    return validations[field]?.isValid ?? true;
  }, [validationState]);

  // Enhanced form update with validation
  const updateFormField = useCallback((field: string, value: any) => {
    setMovementForm((prev) => ({ ...prev, [field]: value }));
    validateField(field, value);

    // Update expected stock when product changes
    if (field === 'product_id') {
      const product = products.find((p) => p.id!.toString() === value);
      setMovementForm((prev) => ({
        ...prev,
        expectedStock: product?.total_stock || 0,
        variant_id: '', // Reset variant when product changes
        unit_cost: product?.cost_price || 0
      }));
    }
  }, [products, validateField]);

  // Fetch movements with conflict detection
  const fetchMovements = useCallback(async (productId: number, variantId?: number) => {
    if (!productId) return;

    try {
      setLoading(true);
      const data = await getStockMovements(productId, variantId);

      // Check for conflicts with pending movements
      const conflicts = pendingMovements.filter((pending) =>
      pending.status === 'pending' &&
      data.some((movement) => movement.id === pending.id)
      );

      if (conflicts.length > 0) {
        setConflictResolution({
          conflicts,
          serverData: data,
          localData: movements
        });
      } else {
        setMovements(data);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch stock movements. Please try again.',
        variant: 'destructive',
        action:
        <Button variant="outline" size="sm" onClick={() => fetchMovements(productId, variantId)}>
            Retry
          </Button>

      });
    } finally {
      setLoading(false);
    }
  }, [getStockMovements, pendingMovements, movements, toast]);

  // Enhanced movement submission with optimistic updates
  const handleAddMovement = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isFormValid = ['product_id', 'movement_type', 'quantity', 'unit_cost'].every((field) =>
    validateField(field, movementForm[field as keyof typeof movementForm])
    );

    if (!isFormValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting.',
        variant: 'destructive'
      });
      return;
    }

    const movementId = `temp_${Date.now()}`;
    const movementData = {
      ...movementForm,
      id: movementId,
      product_id: parseInt(movementForm.product_id),
      variant_id: movementForm.variant_id ? parseInt(movementForm.variant_id) : undefined,
      total_cost: movementForm.quantity * movementForm.unit_cost,
      created_by: user?.id,
      created_at: new Date().toISOString()
    };

    try {
      // Optimistic update
      const tempMovement: PendingMovement = {
        id: movementId,
        originalData: movementData,
        timestamp: Date.now(),
        status: 'pending'
      };

      setPendingMovements((prev) => [...prev, tempMovement]);
      setMovements((prev) => [movementData, ...prev]);

      // Show optimistic success
      const undoToast = toast({
        title: 'Movement Added',
        description: `Stock movement recorded for ${products.find((p) => p.id === movementData.product_id)?.name}`,
        action:
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Rollback optimistic update
            setMovements((prev) => prev.filter((m) => m.id !== movementId));
            setPendingMovements((prev) => prev.filter((p) => p.id !== movementId));
            undoToast.dismiss?.();
            toast({
              title: 'Movement Cancelled',
              description: 'Stock movement has been cancelled.'
            });
          }}>

            <Undo className="h-3 w-3 mr-1" />
            Undo
          </Button>

      });

      // Close form
      setShowAddMovement(false);
      setMovementForm({
        product_id: '',
        variant_id: '',
        movement_type: '',
        quantity: 0,
        unit_cost: 0,
        notes: '',
        expectedStock: 0
      });
      setValidationState({});

      // Actual API call
      await addStockMovement(movementData);

      // Update pending status to success
      setPendingMovements((prev) =>
      prev.map((p) =>
      p.id === movementId ?
      { ...p, status: 'success' as const } :
      p
      )
      );

      // Refresh movements to get server data
      if (selectedProduct) {
        setTimeout(() => fetchMovements(selectedProduct.id), 1000);
      }

    } catch (error) {
      // Rollback optimistic update on error
      setMovements((prev) => prev.filter((m) => m.id !== movementId));
      setPendingMovements((prev) =>
      prev.map((p) =>
      p.id === movementId ?
      { ...p, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' } :
      p
      )
      );

      const errorMessage = error instanceof Error ? error.message : 'Failed to add stock movement';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        action:
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Retry the operation
            setShowAddMovement(true);
          }}>

            Retry
          </Button>

      });
    }
  }, [movementForm, validateField, toast, user?.id, products, selectedProduct, addStockMovement, fetchMovements]);

  // Cleanup pending movements
  useEffect(() => {
    const cleanup = setInterval(() => {
      setPendingMovements((prev) => {
        const now = Date.now();
        return prev.filter((p) =>
        p.status === 'pending' || now - p.timestamp < 30000 // Keep for 30 seconds
        );
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  // Memoized movement type info
  const getMovementTypeInfo = useCallback((type: string) => {
    return movementTypes.find((mt) => mt.value === type) || movementTypes[0];
  }, []);

  // Enhanced quantity formatting
  const formatMovementQuantity = useCallback((type: string, quantity: number) => {
    const sign = ['receipt', 'return', 'adjustment'].includes(type) && quantity > 0 ? '+' : '';
    return `${sign}${quantity}`;
  }, []);

  // Conflict resolution dialog
  const ConflictResolutionDialog = () => {
    if (!conflictResolution) return null;

    return (
      <Dialog open={!!conflictResolution} onOpenChange={() => setConflictResolution(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data Conflict Detected</DialogTitle>
            <DialogDescription>
              The stock data has been updated by another user. Please choose how to resolve this conflict.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                There are conflicting changes to the stock movements. You can either keep the server data or merge with your local changes.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setMovements(conflictResolution.serverData);
                  setConflictResolution(null);
                }}>

                Use Server Data
              </Button>
              <Button
                onClick={() => {
                  // Implement merge logic here
                  setMovements(conflictResolution.serverData);
                  setConflictResolution(null);
                }}>

                Merge Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>);

  };

  return (
    <div className="space-y-6">
      <ConflictResolutionDialog />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Movements</h2>
          <p className="text-muted-foreground">
            Track all stock changes with real-time validation and conflict resolution
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
                Record a new stock movement with real-time validation
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddMovement} className="space-y-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label htmlFor="product">Product *</Label>
                <Select
                  value={movementForm.product_id}
                  onValueChange={(value) => updateFormField('product_id', value)}>

                  <SelectTrigger className={validationState.product_id?.isValid === false ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) =>
                    <SelectItem key={product.id} value={product.id!.toString()}>
                        {product.name} ({product.sku}) - Stock: {product.total_stock || 0}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {validationState.product_id?.message &&
                <p className="text-sm text-red-500">{validationState.product_id.message}</p>
                }
              </div>

              {/* Movement Type */}
              <div className="space-y-2">
                <Label htmlFor="movement_type">Movement Type *</Label>
                <Select
                  value={movementForm.movement_type}
                  onValueChange={(value) => updateFormField('movement_type', value)}>

                  <SelectTrigger className={validationState.movement_type?.isValid === false ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select movement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {movementTypes.map((type) =>
                    <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {validationState.movement_type?.message &&
                <p className="text-sm text-red-500">{validationState.movement_type.message}</p>
                }
              </div>

              {/* Quantity and Unit Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={movementForm.quantity}
                    onChange={(e) => updateFormField('quantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className={validationState.quantity?.isValid === false ? 'border-red-500' : ''}
                    required />

                  {validationState.quantity?.message &&
                  <p className="text-sm text-red-500">{validationState.quantity.message}</p>
                  }
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_cost">Unit Cost (৳)</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={movementForm.unit_cost}
                    onChange={(e) => updateFormField('unit_cost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={validationState.unit_cost?.isValid === false ? 'border-red-500' : ''} />

                  {validationState.unit_cost?.message &&
                  <p className="text-sm text-red-500">{validationState.unit_cost.message}</p>
                  }
                </div>
              </div>

              {/* Expected vs New Stock Preview */}
              {movementForm.product_id && movementForm.quantity > 0 &&
              <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-center">
                      <span>Current Stock: {movementForm.expectedStock}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span>
                        New Stock: {
                      ['receipt', 'return'].includes(movementForm.movement_type) ?
                      movementForm.expectedStock + movementForm.quantity :
                      movementForm.expectedStock - movementForm.quantity
                      }
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              }

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={movementForm.notes}
                  onChange={(e) => updateFormField('notes', e.target.value)}
                  placeholder="Additional notes or reason for movement..."
                  rows={3} />

              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => setShowAddMovement(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ?
                  <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </> :

                  'Add Movement'
                  }
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
          const typeMovements = movements.filter((m) => m.movement_type === type.value);
          const totalQuantity = typeMovements.reduce((sum, m) => sum + (m.quantity || 0), 0);

          return (
            <Card key={type.value}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{type.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalQuantity}</div>
                <p className="text-xs text-muted-foreground">
                  {typeMovements.length} transactions
                </p>
              </CardContent>
            </Card>);

        })}
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            View Stock Movements
          </CardTitle>
          <CardDescription>
            Select a product to view its detailed stock movement history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Select
              onValueChange={(value) => {
                const product = products.find((p) => p.id!.toString() === value);
                setSelectedProduct(product);
                if (product) fetchMovements(product.id);
              }}>

              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) =>
                <SelectItem key={product.id} value={product.id!.toString()}>
                    {product.name} ({product.sku})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            
            {selectedProduct &&
            <Badge variant="outline" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Current Stock: {selectedProduct.total_stock || 0} {selectedProduct.unit}
              </Badge>
            }
            
            {selectedProduct &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMovements(selectedProduct.id)}
              disabled={loading}>

                {loading ?
              <Loader2 className="h-4 w-4 animate-spin" /> :

              <RefreshCw className="h-4 w-4" />
              }
              </Button>
            }
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      {selectedProduct &&
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Movement History - {selectedProduct.name}</span>
              {pendingMovements.filter((p) => p.status === 'pending').length > 0 &&
            <Badge variant="secondary" className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {pendingMovements.filter((p) => p.status === 'pending').length} pending
                </Badge>
            }
            </CardTitle>
            <CardDescription>
              All stock movements for this product with real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
          <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div> :
          movements.length > 0 ?
          <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                const typeInfo = getMovementTypeInfo(movement.movement_type);
                const Icon = typeInfo.icon;
                const pending = pendingMovements.find((p) => p.id === movement.id);

                return (
                  <TableRow
                    key={movement.id}
                    className={pending?.status === 'pending' ? 'opacity-70' : ''}>

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
                      'text-blue-600'}`
                      }>
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
                          {pending?.status === 'pending' ?
                      <Badge variant="secondary" className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Pending
                            </Badge> :
                      pending?.status === 'error' ?
                      <Badge variant="destructive" className="flex items-center gap-1">
                              <X className="h-3 w-3" />
                              Error
                            </Badge> :

                      <Badge variant="default" className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Complete
                            </Badge>
                      }
                        </TableCell>
                      </TableRow>);

              })}
                </TableBody>
              </Table> :

          <div className="text-center py-8 text-muted-foreground">
                No stock movements found for this product
              </div>
          }
          </CardContent>
        </Card>
      }
    </div>);

};

export default EnhancedStockMovement;