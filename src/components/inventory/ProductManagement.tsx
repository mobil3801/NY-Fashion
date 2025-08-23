
import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useInventory } from '@/contexts/InventoryContext';
import ProductForm from './ProductForm';

const ProductManagement = () => {
  const { products, categories, loading, fetchProducts, deleteProduct, setSelectedProduct } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts({
      search: searchTerm,
      category_id: selectedCategory || undefined
    });
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setSelectedProduct(product);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setSelectedProduct(null);
  };

  const getStockStatus = (product: any) => {
    const stock = product.total_stock || 0;
    if (stock === 0) return { status: 'Out of Stock', color: 'destructive' };
    if (stock <= product.min_stock_level) return { status: 'Low Stock', color: 'secondary' };
    return { status: 'In Stock', color: 'default' };
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
              }} />

          </DialogContent>
        </Dialog>
      </div>

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
                onChange={(e) => setSearchTerm(e.target.value)} />

            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) =>
                <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name} ({category.product_count})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button type="submit">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {loading ?
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
        </div> :

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
                      onClick={() => handleEdit(product)}>

                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product.id!)}>

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
                      {product.total_stock || 0} {product.unit}
                      {(product.total_stock || 0) <= product.min_stock_level &&
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold">৳{product.selling_price}</span>
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

      {products.length === 0 && !loading &&
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
      }
    </div>);

};

export default ProductManagement;