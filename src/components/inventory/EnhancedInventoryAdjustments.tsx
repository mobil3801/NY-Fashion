
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Clock, Plus, Search, FileText, AlertTriangle, Loader2, Save, Trash2, Edit, Eye, RotateCcw } from 'lucide-react';
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
import { hasPermission } from '@/utils/permissions';

interface AdjustmentItem {
  id?: string;
  product_id: string;
  variant_id?: string;
  product_name?: string;
  current_stock: number;
  adjusted_stock: number;
  difference: number;
  unit_cost: number;
  reason: string;
  validated?: boolean;
  conflicts?: string[];
}

interface PendingAdjustment {
  id: string;
  status: 'draft' | 'pending' | 'processing' | 'approved' | 'rejected';
  timestamp: number;
  items: AdjustmentItem[];
  conflicts?: Array<{
    itemId: string;
    expectedStock: number;
    actualStock: number;
    message: string;
  }>;
}

interface ValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

const EnhancedInventoryAdjustments = () => {
  const { products, adjustStock } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();

  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [showCreateAdjustment, setShowCreateAdjustment] = useState(false);
  const [showViewAdjustment, setShowViewAdjustment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>({ isValid: false, errors: {}, warnings: {} });
  const [searchTerm, setSearchTerm] = useState('');

  // Pending adjustments for optimistic updates
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);

  const [adjustmentForm, setAdjustmentForm] = useState({
    reason: '',
    notes: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent'
  });

  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const adjustmentReasons = [
  'Physical Count Discrepancy',
  'Damaged Goods',
  'Expired Items',
  'Theft/Loss',
  'System Error',
  'Supplier Return',
  'Quality Issues',
  'Warehouse Transfer',
  'Other'];


  const priorityColors = {
    low: 'default',
    normal: 'secondary',
    high: 'destructive',
    urgent: 'destructive'
  } as const;

  // Real-time validation
  const validateAdjustment = useCallback(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Form validation
    if (!adjustmentForm.reason) {
      errors.reason = 'Adjustment reason is required';
    }

    if (adjustmentItems.length === 0) {
      errors.items = 'At least one item must be added';
    }

    // Item validation
    adjustmentItems.forEach((item, index) => {
      if (!item.product_id) {
        errors[`item_${index}_product`] = 'Product is required';
      }

      if (item.adjusted_stock < 0) {
        errors[`item_${index}_stock`] = 'Adjusted stock cannot be negative';
      }

      if (Math.abs(item.difference) > item.current_stock * 0.5) {
        warnings[`item_${index}_large`] = 'Large adjustment - please verify';
      }

      if (item.adjusted_stock === 0 && item.current_stock > 0) {
        warnings[`item_${index}_zero`] = 'Setting stock to zero';
      }
    });

    const isValid = Object.keys(errors).length === 0 && adjustmentItems.length > 0;
    setValidationState({ isValid, errors, warnings });

    return isValid;
  }, [adjustmentForm, adjustmentItems]);

  // Auto-validation on changes
  useEffect(() => {
    validateAdjustment();
  }, [validateAdjustment]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || adjustmentItems.length === 0) return;

    const autoSaveTimer = setTimeout(() => {
      if (validateAdjustment()) {
        // Save to localStorage as draft
        const draftData = {
          form: adjustmentForm,
          items: adjustmentItems,
          timestamp: Date.now()
        };
        localStorage.setItem('inventory_adjustment_draft', JSON.stringify(draftData));
        setLastSaved(new Date());
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimer);
  }, [adjustmentForm, adjustmentItems, autoSaveEnabled, validateAdjustment]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('inventory_adjustment_draft');
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        const draftAge = Date.now() - draftData.timestamp;

        // Only load if draft is less than 24 hours old
        if (draftAge < 24 * 60 * 60 * 1000) {
          const shouldLoad = window.confirm(
            'A saved draft was found. Would you like to continue with your previous adjustment?'
          );

          if (shouldLoad) {
            setAdjustmentForm(draftData.form);
            setAdjustmentItems(draftData.items);
            setLastSaved(new Date(draftData.timestamp));
          }
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

  // Enhanced status badge with animation
  const getStatusBadge = useCallback((status: string, processing?: boolean) => {
    const badges = {
      draft: <Badge variant="outline" className="flex items-center gap-1">
        <Edit className="h-3 w-3" />Draft
      </Badge>,
      pending: <Badge variant="secondary" className="flex items-center gap-1">
        {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
        Pending
      </Badge>,
      processing: <Badge variant="secondary" className="flex items-center gap-1 animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />Processing
      </Badge>,
      approved: <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />Approved
      </Badge>,
      rejected: <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" />Rejected
      </Badge>
    };

    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>;
  }, []);

  // Add adjustment item with conflict detection
  const addAdjustmentItem = useCallback(() => {
    const newItem: AdjustmentItem = {
      id: `temp_${Date.now()}`,
      product_id: '',
      variant_id: '',
      current_stock: 0,
      adjusted_stock: 0,
      difference: 0,
      unit_cost: 0,
      reason: '',
      validated: false
    };

    setAdjustmentItems((prev) => [...prev, newItem]);
  }, []);

  // Remove adjustment item
  const removeAdjustmentItem = useCallback((index: number) => {
    setAdjustmentItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update adjustment item with real-time validation
  const updateAdjustmentItem = useCallback((index: number, field: string, value: any) => {
    setAdjustmentItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Calculate difference and detect conflicts
      if (field === 'current_stock' || field === 'adjusted_stock') {
        updated[index].difference = updated[index].adjusted_stock - updated[index].current_stock;

        // Detect potential conflicts
        const conflicts = [];
        if (Math.abs(updated[index].difference) > updated[index].current_stock) {
          conflicts.push('Large stock change detected');
        }
        if (updated[index].adjusted_stock < 0) {
          conflicts.push('Negative stock not allowed');
        }

        updated[index].conflicts = conflicts.length > 0 ? conflicts : undefined;
      }

      // Auto-populate data when product changes
      if (field === 'product_id') {
        const product = products.find((p) => p.id!.toString() === value);
        if (product) {
          updated[index] = {
            ...updated[index],
            product_name: product.name,
            current_stock: product.total_stock || 0,
            unit_cost: product.cost_price || 0
          };
        }
      }

      updated[index].validated = !updated[index].conflicts?.length;
      return updated;
    });
  }, [products]);

  // Enhanced form submission with optimistic updates and conflict resolution
  const handleCreateAdjustment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAdjustment()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix all errors before submitting.',
        variant: 'destructive'
      });
      return;
    }

    const adjustmentId = `adj_${Date.now()}`;
    const adjustmentData = {
      id: adjustmentId,
      ...adjustmentForm,
      items: adjustmentItems,
      created_by: user?.id,
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    try {
      setLoading(true);

      // Check for real-time conflicts
      const conflicts = await checkStockConflicts(adjustmentItems);

      if (conflicts.length > 0) {
        const shouldContinue = window.confirm(
          `Stock conflicts detected for ${conflicts.length} items. Current stock levels may have changed. Continue anyway?`
        );

        if (!shouldContinue) {
          setLoading(false);
          return;
        }
      }

      // Optimistic update
      const pendingAdjustment: PendingAdjustment = {
        id: adjustmentId,
        status: 'processing',
        timestamp: Date.now(),
        items: adjustmentItems,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      };

      setPendingAdjustments((prev) => [...prev, pendingAdjustment]);
      setAdjustments((prev) => [adjustmentData, ...prev]);

      // Show success toast with undo option
      const successToast = toast({
        title: 'Adjustment Submitted',
        description: `Adjustment with ${adjustmentItems.length} items has been submitted for approval.`,
        action:
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Rollback logic
            setAdjustments((prev) => prev.filter((a) => a.id !== adjustmentId));
            setPendingAdjustments((prev) => prev.filter((p) => p.id !== adjustmentId));
            successToast.dismiss?.();
            toast({
              title: 'Adjustment Cancelled',
              description: 'The adjustment has been cancelled.'
            });
          }}>

            <RotateCcw className="h-3 w-3 mr-1" />
            Undo
          </Button>

      });

      // API call
      await adjustStock(adjustmentItems);

      // Update status to success
      setPendingAdjustments((prev) =>
      prev.map((p) => p.id === adjustmentId ? { ...p, status: 'approved' } : p)
      );

      // Clear form and localStorage
      setShowCreateAdjustment(false);
      setAdjustmentForm({ reason: '', notes: '', priority: 'normal' });
      setAdjustmentItems([]);
      localStorage.removeItem('inventory_adjustment_draft');
      setLastSaved(null);

    } catch (error) {
      // Rollback on error
      setAdjustments((prev) => prev.filter((a) => a.id !== adjustmentId));
      setPendingAdjustments((prev) => prev.filter((p) => p.id !== adjustmentId));

      const errorMessage = error instanceof Error ? error.message : 'Failed to create adjustment';
      toast({
        title: 'Submission Failed',
        description: errorMessage,
        variant: 'destructive',
        action:
        <Button variant="outline" size="sm" onClick={() => handleCreateAdjustment(e)}>
            Retry
          </Button>

      });
    } finally {
      setLoading(false);
    }
  }, [adjustmentForm, adjustmentItems, user?.id, validateAdjustment, adjustStock, toast]);

  // Mock function for checking stock conflicts
  const checkStockConflicts = async (items: AdjustmentItem[]) => {
    // In real implementation, this would check current stock against expected stock
    return [];
  };

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    if (!searchTerm) return adjustments;

    return adjustments.filter((adj) =>
    adj.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.id?.toString().includes(searchTerm)
    );
  }, [adjustments, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Adjustments</h2>
          <p className="text-muted-foreground">
            Create and manage stock adjustments with real-time validation and conflict resolution
          </p>
        </div>
        {hasPermission(user, 'inventory', 'create') &&
        <Dialog open={showCreateAdjustment} onOpenChange={setShowCreateAdjustment}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Adjustment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  Create Inventory Adjustment
                  {lastSaved && autoSaveEnabled &&
                <Badge variant="outline" className="text-xs">
                      <Save className="h-3 w-3 mr-1" />
                      Saved {lastSaved.toLocaleTimeString()}
                    </Badge>
                }
                </DialogTitle>
                <DialogDescription>
                  Create a new inventory adjustment with comprehensive validation and conflict detection
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateAdjustment} className="space-y-6">
                {/* Validation Summary */}
                {!validationState.isValid && Object.keys(validationState.errors).length > 0 &&
              <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Please fix the following errors:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {Object.values(validationState.errors).map((error, index) =>
                    <li key={index} className="text-sm">{error}</li>
                    )}
                      </ul>
                    </AlertDescription>
                  </Alert>
              }
                
                {/* Warnings */}
                {Object.keys(validationState.warnings).length > 0 &&
              <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Please review these warnings:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {Object.values(validationState.warnings).map((warning, index) =>
                    <li key={index} className="text-sm">{warning}</li>
                    )}
                      </ul>
                    </AlertDescription>
                  </Alert>
              }

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Adjustment Reason *</Label>
                    <Select
                    value={adjustmentForm.reason}
                    onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, reason: value })}>

                      <SelectTrigger className={validationState.errors.reason ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {adjustmentReasons.map((reason) =>
                      <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                    {validationState.errors.reason &&
                  <p className="text-sm text-red-500">{validationState.errors.reason}</p>
                  }
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                    value={adjustmentForm.priority}
                    onValueChange={(value: any) => setAdjustmentForm({ ...adjustmentForm, priority: value })}>

                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                  id="notes"
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  placeholder="Additional notes about this adjustment..."
                  rows={3} />

                </div>

                {/* Adjustment Items */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Adjustment Items</h3>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Auto-save:
                        <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}>

                          {autoSaveEnabled ? '✓ On' : '✗ Off'}
                        </Button>
                      </div>
                      <Button type="button" variant="outline" onClick={addAdjustmentItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                  </div>

                  {adjustmentItems.map((item, index) =>
                <Card key={item.id} className={item.conflicts ? 'border-yellow-500' : ''}>
                      <CardContent className="pt-4">
                        {item.conflicts &&
                    <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <ul className="list-disc ml-4">
                                {item.conflicts.map((conflict, i) =>
                          <li key={i}>{conflict}</li>
                          )}
                              </ul>
                            </AlertDescription>
                          </Alert>
                    }
                        
                        <div className="grid grid-cols-6 gap-4">
                          <div className="col-span-2 space-y-2">
                            <Label>Product *</Label>
                            <Select
                          value={item.product_id}
                          onValueChange={(value) => updateAdjustmentItem(index, 'product_id', value)}>

                              <SelectTrigger>
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
                          </div>

                          <div className="space-y-2">
                            <Label>Current Stock</Label>
                            <Input
                          type="number"
                          value={item.current_stock}
                          readOnly
                          className="bg-gray-50" />

                          </div>

                          <div className="space-y-2">
                            <Label>Adjusted Stock *</Label>
                            <Input
                          type="number"
                          value={item.adjusted_stock}
                          onChange={(e) => updateAdjustmentItem(index, 'adjusted_stock', parseInt(e.target.value) || 0)}
                          placeholder="New stock level"
                          className={validationState.errors[`item_${index}_stock`] ? 'border-red-500' : ''} />

                          </div>

                          <div className="space-y-2">
                            <Label>Difference</Label>
                            <Input
                          type="number"
                          value={item.difference}
                          readOnly
                          className={`bg-gray-50 ${
                          item.difference > 0 ? 'text-green-600' :
                          item.difference < 0 ? 'text-red-600' : ''}`
                          } />

                          </div>

                          <div className="flex items-end">
                            <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAdjustmentItem(index)}>

                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <Label>Item Notes</Label>
                          <Input
                        value={item.reason}
                        onChange={(e) => updateAdjustmentItem(index, 'reason', e.target.value)}
                        placeholder="Specific reason for this item adjustment..." />

                        </div>
                      </CardContent>
                    </Card>
                )}

                  {adjustmentItems.length === 0 &&
                <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        No items added yet. Click "Add Item" to start.
                      </CardContent>
                    </Card>
                }
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateAdjustment(false);
                    // Optionally save as draft
                  }}>

                    Save as Draft
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateAdjustment(false)}>
                    Cancel
                  </Button>
                  <Button
                  type="submit"
                  disabled={loading || !validationState.isValid}
                  className="min-w-32">

                    {loading ?
                  <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </> :

                  'Submit for Approval'
                  }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      </div>

      {/* Adjustments List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Adjustments</CardTitle>
              <CardDescription>
                All inventory adjustments with real-time status updates
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search adjustments..."
                className="w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} />

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
                <TableHead>Priority</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdjustments.length > 0 ?
              filteredAdjustments.map((adjustment) => {
                const pending = pendingAdjustments.find((p) => p.id === adjustment.id);

                return (
                  <TableRow key={adjustment.id}>
                      <TableCell className="font-mono">
                        {adjustment.id}
                      </TableCell>
                      <TableCell>
                        {new Date(adjustment.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{adjustment.reason}</TableCell>
                      <TableCell>
                        <Badge variant={priorityColors[adjustment.priority || 'normal']}>
                          {adjustment.priority || 'Normal'}
                        </Badge>
                      </TableCell>
                      <TableCell>{adjustment.items?.length || 0}</TableCell>
                      <TableCell>
                        {adjustment.items?.reduce((sum: number, item: any) => sum + Math.abs(item.difference || 0), 0) || 0} units
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(pending?.status || adjustment.status, pending?.status === 'processing')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowViewAdjustment(adjustment)}>

                            <Eye className="h-4 w-4" />
                          </Button>
                          {adjustment.status === 'pending' && hasPermission(user, 'inventory', 'approve') &&
                        <>
                              <Button variant="ghost" size="sm">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                        }
                        </div>
                      </TableCell>
                    </TableRow>);

              }) :

              <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No inventory adjustments found
                  </TableCell>
                </TableRow>
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Adjustment Dialog */}
      {showViewAdjustment &&
      <Dialog open={!!showViewAdjustment} onOpenChange={() => setShowViewAdjustment(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Adjustment Details - {showViewAdjustment.id}</DialogTitle>
              <DialogDescription>
                Detailed view of the inventory adjustment
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Reason:</strong> {showViewAdjustment.reason}</div>
                <div><strong>Status:</strong> {getStatusBadge(showViewAdjustment.status)}</div>
                <div><strong>Created:</strong> {new Date(showViewAdjustment.created_at).toLocaleString()}</div>
                <div><strong>Priority:</strong> 
                  <Badge variant={priorityColors[showViewAdjustment.priority || 'normal']} className="ml-2">
                    {showViewAdjustment.priority || 'Normal'}
                  </Badge>
                </div>
              </div>
              
              {showViewAdjustment.notes &&
            <div>
                  <strong>Notes:</strong>
                  <p className="text-sm text-muted-foreground mt-1">{showViewAdjustment.notes}</p>
                </div>
            }
              
              <div>
                <strong>Adjustment Items:</strong>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Adjusted</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showViewAdjustment.items?.map((item: any, index: number) =>
                  <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.current_stock}</TableCell>
                        <TableCell>{item.adjusted_stock}</TableCell>
                        <TableCell className={item.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </TableCell>
                        <TableCell>{item.reason || '-'}</TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    </div>);

};

export default EnhancedInventoryAdjustments;