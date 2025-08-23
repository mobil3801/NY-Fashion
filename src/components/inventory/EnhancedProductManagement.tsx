
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Package, AlertTriangle, RefreshCw, CheckCircle, Clock, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import ProductForm from './ProductForm';

interface OptimisticAction {
  type: 'delete' | 'update' | 'create';
  id: string | number;
  data?: any;
  timestamp: number;
}

interface ValidationError {
  field: string;
  message: string;
}

const EnhancedProductManagement = () => {
  const {
    products,
    categories,
    loading,
    loadingProducts,
    fetchProducts,
    deleteProduct,
    saveProduct,
    setSelectedProduct,
    error,
    isRetrying,
    retry,
    clearError
  } = useInventory();

  const { toast } = useToast();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Optimistic updates tracking
  const [optimisticActions, setOptimisticActions] = useState<OptimisticAction[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string | number>>(new Set());

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const [searchLoading, setSearchLoading] = useState(false);

  // Progressive loading states
  const [operationStates, setOperationStates] = useState<Record<string, {
    loading: boolean;
    error: string | null;
    success: boolean;
  }>>({});

  // Memoized filtered products
  const displayProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      // Hide optimistically deleted products
      if (optimisticActions.some((action) => action.type === 'delete' && action.id === product.id)) {
        return false;
      }
      return true;
    });

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((product) =>
      product.name?.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term) ||
      product.name_bn?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter((product) =>
      product.category_id?.toString() === selectedCategory
      );
    }

    return filtered;
  }, [products, optimisticActions, searchTerm, selectedCategory]);

  // Cleanup optimistic actions after timeout
  useEffect(() => {
    const cleanup = setTimeout(() => {
      const now = Date.now();
      setOptimisticActions((prev) =>
      prev.filter((action) => now - action.timestamp < 30000) // 30 seconds
      );
    }, 5000);

    return () => clearTimeout(cleanup);
  }, [optimisticActions]);

  // Enhanced search with debounce
  const debouncedSearch = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        await fetchProducts({
          search: term.trim(),
          category_id: selectedCategory || undefined,
          include_inactive: false
        });
      } catch (error) {
        console.error('Search failed:', error);
        toast({
          title: 'Search Error',
          description: 'Failed to search products. Please try again.',
          variant: 'destructive',
          action:
          <Button variant="outline" size="sm" onClick={() => debouncedSearch(term)}>
              Retry
            </Button>

        });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [fetchProducts, selectedCategory, toast]);

  // Handle search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Enhanced delete with optimistic updates and rollback
  const handleDelete = useCallback(async (product: any) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    const optimisticId = `delete_${product.id}_${Date.now()}`;
    const rollback = () => {
      setOptimisticActions((prev) => prev.filter((a) => a.id !== optimisticId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    };

    try {
      // Optimistic update
      setOptimisticActions((prev) => [...prev, {
        type: 'delete',
        id: optimisticId,
        data: product,
        timestamp: Date.now()
      }]);
      setDeletingIds((prev) => new Set(prev).add(product.id));

      // Show optimistic success toast
      const dismissToast = toast({
        title: 'Product Deleted',
        description: `${product.name} has been deleted successfully.`,
        variant: 'default',
        action:
        <Button variant="outline" size="sm" onClick={() => {
          rollback();
          dismissToast.dismiss?.();
          toast({
            title: 'Delete Cancelled',
            description: 'Product deletion has been cancelled.'
          });
        }}>
            Undo
          </Button>

      });

      // Actual API call
      await deleteProduct(product.id);

      // Remove optimistic action on success
      setOptimisticActions((prev) => prev.filter((a) => a.id !== optimisticId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });

      // Refresh list to ensure consistency
      setTimeout(() => {
        fetchProducts({
          search: searchTerm.trim(),
          category_id: selectedCategory || undefined
        });
      }, 1000);

    } catch (error) {
      // Rollback on error
      rollback();

      const errorMessage = error instanceof Error ? error.message : 'Failed to delete product';
      toast({
        title: 'Delete Failed',
        description: errorMessage,
        variant: 'destructive',
        action:
        <Button variant="outline" size="sm" onClick={() => handleDelete(product)}>
            Retry
          </Button>

      });
    }
  }, [deleteProduct, fetchProducts, searchTerm, selectedCategory, toast]);

  // Enhanced edit handler
  const handleEdit = useCallback((product: any) => {
    setEditingProduct(product);
    setSelectedProduct(product);
    setValidationErrors([]);
    setShowForm(true);
  }, [setSelectedProduct]);

  // Enhanced form close handler
  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingProduct(null);
    setSelectedProduct(null);
    setValidationErrors([]);
  }, [setSelectedProduct]);

  // Enhanced save handler
  const handleSave = useCallback(async () => {
    try {
      setValidationErrors([]);
      handleCloseForm();

      // Show success notification
      toast({
        title: 'Success',
        description: editingProduct ? 'Product updated successfully' : 'Product created successfully',
        variant: 'default'
      });

      // Refresh products list
      setTimeout(() => {
        fetchProducts({
          search: searchTerm.trim(),
          category_id: selectedCategory || undefined
        });
      }, 500);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save product';

      // Check for validation errors
      if (error instanceof Error && error.message.includes('validation')) {
        setValidationErrors([{
          field: 'form',
          message: errorMessage
        }]);
      }

      toast({
        title: 'Save Failed',
        description: errorMessage,
        variant: 'destructive',
        action:
        <Button variant="outline" size="sm" onClick={handleSave}>
            Retry
          </Button>

      });
    }
  }, [editingProduct, handleCloseForm, toast, fetchProducts, searchTerm, selectedCategory]);

  // Get enhanced stock status
  const getStockStatus = useCallback((product: any) => {
    const stock = product.total_stock ?? product.current_stock ?? 0;
    const minLevel = product.min_stock_level ?? 5;
    const isDeleting = deletingIds.has(product.id);

    if (isDeleting) {
      return { status: 'Deleting...', color: 'secondary', icon: Loader2 };
    }

    if (stock === 0) {
      return { status: 'Out of Stock', color: 'destructive', icon: AlertTriangle };
    }

    if (stock <= minLevel) {
      return { status: 'Low Stock', color: 'secondary', icon: AlertTriangle };
    }

    return { status: 'In Stock', color: 'default', icon: CheckCircle };
  }, [deletingIds]);

  // Enhanced retry function
  const handleRetry = useCallback(() => {
    clearError();
    setIsRefreshing(true);

    Promise.all([
    fetchProducts({
      search: searchTerm.trim(),
      category_id: selectedCategory || undefined
    })
    // Add any other recovery operations here
    ]).finally(() => {
      setIsRefreshing(false);
    });
  }, [clearError, fetchProducts, searchTerm, selectedCategory]);

  // Render loading skeleton
  const renderLoadingSkeleton = () =>
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) =>
    <Card key={i} className="animate-pulse">
          <CardHeader className="space-y-2">
            <div className="h-4 bg-gray-300 rounded"></div>
            <div className="h-3 bg-gray-300 rounded w-3/4"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-gray-300 rounded"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
    )}
    </div>;


  // Render enhanced error state
  const renderErrorState = () =>
  <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong>Failed to Load Products</strong>
          <p className="mt-1 text-sm">
            {error?.message || 'Unable to fetch products. Please check your connection and try again.'}
          </p>
          {error?.suggestion &&
        <p className="mt-1 text-sm font-medium">{error.suggestion}</p>
        }
        </div>
        <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={isRetrying}
        className="ml-4">

          {isRetrying ?
        <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Retrying...
            </> :

        <>
              <RefreshCw className="h-3 w-3 mr-2" />
              Retry
            </>
        }
        </Button>
      </AlertDescription>
    </Alert>;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Management</h2>
          <p className="text-muted-foreground">
            Manage your women's wear inventory with real-time updates
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowForm(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Update product information' : 'Create a new product in your inventory'}
              </DialogDescription>
            </DialogHeader>
            
            {/* Validation Errors */}
            {validationErrors.length > 0 &&
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc ml-4">
                    {validationErrors.map((error, index) =>
                  <li key={index}>{error.message}</li>
                  )}
                  </ul>
                </AlertDescription>
              </Alert>
            }

            <ProductForm
              product={editingProduct}
              onClose={handleCloseForm}
              onSave={handleSave} />

          </DialogContent>
        </Dialog>
      </div>

      {/* Enhanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {(searchLoading || isRefreshing) &&
            <Loader2 className="h-4 w-4 animate-spin" />
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search products, SKU, or barcode..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-10" />

                {searchLoading &&
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                }
                {searchTerm && !searchLoading &&
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => handleSearchChange('')}>

                    <X className="h-3 w-3" />
                  </Button>
                }
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) =>
                <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name} ({category.product_count || 0})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isRetrying}>

              {isRetrying ?
              <Loader2 className="h-4 w-4 animate-spin" /> :

              <RefreshCw className="h-4 w-4" />
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && !loading && renderErrorState()}

      {/* Loading State */}
      {(loading || isRefreshing) && renderLoadingSkeleton()}

      {/* Products Grid */}
      {!loading && !error &&
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayProducts.map((product) => {
          const stockStatus = getStockStatus(product);
          const isDeleting = deletingIds.has(product.id);
          const StatusIcon = stockStatus.icon;

          return (
            <Card
              key={product.id}
              className={`hover:shadow-md transition-all ${
              isDeleting ? 'opacity-50 pointer-events-none' : ''}`
              }>

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg leading-tight">
                        {product.name}
                      </CardTitle>
                      {product.name_bn &&
                    <p className="text-sm text-muted-foreground">
                          {product.name_bn}
                        </p>
                    }
                    </div>
                    <div className="flex gap-1">
                      <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      disabled={isDeleting}>

                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product)}
                      disabled={isDeleting}>

                        {isDeleting ?
                      <Loader2 className="h-4 w-4 animate-spin" /> :

                      <Trash2 className="h-4 w-4" />
                      }
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{product.category_name}</Badge>
                    <Badge variant={stockStatus.color as any} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {stockStatus.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SKU:</span>
                    <span className="font-mono">{product.sku}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {product.total_stock ?? product.current_stock ?? 0} {product.unit || 'pcs'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold">৳{product.selling_price ?? product.price ?? 0}</span>
                  </div>
                  {product.has_variants &&
                <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Variants:</span>
                      <span>{product.variant_count} variants</span>
                    </div>
                }
                </CardContent>
              </Card>);

        })}
        </div>
      }

      {/* Empty State */}
      {displayProducts.length === 0 && !loading && !error &&
      <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedCategory ?
            'No products match your current filters. Try adjusting your search criteria.' :
            'Start building your inventory by adding your first product.'
            }
            </p>
            {!searchTerm && !selectedCategory ?
          <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Button> :

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
            }}>

                Clear Filters
              </Button>
          }
          </CardContent>
        </Card>
      }
    </div>);

};

export default EnhancedProductManagement;