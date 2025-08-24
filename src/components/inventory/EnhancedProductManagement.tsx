
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Package, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEnhancedInventory } from '@/contexts/EnhancedInventoryContext';
import { useNetwork } from '@/contexts/NetworkContext';
import ProductForm from './ProductForm';
import { toast } from '@/hooks/use-toast';

const EnhancedProductManagement = () => {
  const { 
    products, 
    categories, 
    loading, 
    fetchProducts, 
    deleteProduct, 
    setSelectedProduct, 
    error,
    clearError,
    getConnectionStatus,
    retryFailedOperations,
    isRetrying,
    lastSync
  } = useEnhancedInventory();

  const { online } = useNetwork();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConnectionInfo, setShowConnectionInfo] = useState(false);

  const connectionStatus = getConnectionStatus();

  // Show connection issues prominently
  useEffect(() => {
    if (!online || connectionStatus.quality === 'poor' || connectionStatus.quality === 'offline') {
      setShowConnectionInfo(true);
    } else if (online && connectionStatus.quality === 'good') {
      // Auto-hide connection info when connection improves
      const timer = setTimeout(() => setShowConnectionInfo(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [online, connectionStatus.quality]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRefreshing(true);
    
    try {
      await fetchProducts({
        search: searchTerm.trim(),
        category_id: selectedCategory || undefined,
        include_inactive: false
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setSelectedProduct(product);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setSelectedProduct(null);
  };

  const handleRetry = async () => {
    clearError();
    await retryFailedOperations();
  };

  const getStockStatus = (product: any) => {
    const stock = product.total_stock ?? product.current_stock ?? 0;
    const minLevel = product.min_stock_level ?? 5;

    if (stock === 0) return { status: 'Out of Stock', color: 'destructive' };
    if (stock <= minLevel) return { status: 'Low Stock', color: 'secondary' };
    return { status: 'In Stock', color: 'default' };
  };

  const getConnectionQualityIcon = () => {
    if (!online) return <WifiOff className="h-4 w-4 text-red-500" />;
    
    switch (connectionStatus.quality) {
      case 'excellent':
      case 'good':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'fair':
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-orange-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionMessage = () => {
    if (!online) return 'You are offline. Changes will sync when connection is restored.';
    
    switch (connectionStatus.quality) {
      case 'excellent':
        return 'Excellent connection quality';
      case 'good':
        return 'Good connection quality';
      case 'fair':
        return 'Fair connection - some operations may be slower';
      case 'poor':
        return 'Poor connection - operations may fail or take longer';
      default:
        return 'Connection issues detected';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Management</h2>
          <p className="text-muted-foreground">
            Manage your women's wear inventory
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowForm(true)}>
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
            <ProductForm
              product={editingProduct}
              onClose={handleCloseForm}
              onSave={() => {
                handleCloseForm();
                fetchProducts();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Connection Status */}
      {showConnectionInfo && (
        <Alert className={online ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
          <div className="flex items-center gap-2">
            {getConnectionQualityIcon()}
            <AlertTriangle className="h-4 w-4" />
          </div>
          <AlertDescription className="flex items-center justify-between">
            <span>{getConnectionMessage()}</span>
            <div className="flex items-center gap-2">
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {new Date(lastSync).toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConnectionInfo(false)}
              >
                ✕
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search products, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name} ({category.product_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isRefreshing}>
              <Search className="h-4 w-4 mr-2" />
              {isRefreshing ? 'Searching...' : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error Display with Enhanced Information */}
      {error && !loading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800">
                  Failed to Load Products
                </h3>
                <p className="text-sm text-red-700 mb-2">
                  {error.message || 'Unable to fetch products. Please check your connection and try again.'}
                </p>
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <span>Error Code: {error.code}</span>
                  {error.retryable && <Badge variant="outline" className="text-xs">Retryable</Badge>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearError}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {loading || isRefreshing ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
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
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const stockStatus = getStockStatus(product);
            return (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg leading-tight">
                        {product.name}
                      </CardTitle>
                      {product.name_bn && (
                        <p className="text-sm text-muted-foreground">
                          {product.name_bn}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{product.category_name}</Badge>
                    <Badge variant={stockStatus.color as any}>
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
                      {(product.total_stock ?? product.current_stock ?? 0) <= (product.min_stock_level ?? 5) && (
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold">৳{product.selling_price ?? product.price ?? 0}</span>
                  </div>
                  {product.has_variants && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Variants:</span>
                      <span>{product.variant_count} variants</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {products.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start building your inventory by adding your first product.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Product
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedProductManagement;
