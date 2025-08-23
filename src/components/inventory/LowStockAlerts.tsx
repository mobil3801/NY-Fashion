
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, ShoppingCart, TrendingDown, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useInventory } from '@/contexts/InventoryContext';

const LowStockAlerts = () => {
  const { getLowStockProducts } = useInventory();
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLowStockProducts();
  }, []);

  const fetchLowStockProducts = async () => {
    try {
      setLoading(true);
      const products = await getLowStockProducts();
      setLowStockProducts(products);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockLevel = (current: number, min: number, max: number) => {
    if (current === 0) return { level: 'out', percentage: 0, color: 'bg-red-500' };
    if (current <= min) return { level: 'critical', percentage: current / min * 50, color: 'bg-red-500' };
    if (current <= min * 2) return { level: 'low', percentage: 50 + (current - min) / min * 30, color: 'bg-yellow-500' };
    return { level: 'good', percentage: 80 + (current - min * 2) / (max - min * 2) * 20, color: 'bg-green-500' };
  };

  const getStockBadge = (level: string) => {
    switch (level) {
      case 'out':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'low':
        return <Badge variant="secondary">Low Stock</Badge>;
      default:
        return <Badge variant="default">Good</Badge>;
    }
  };

  const generatePurchaseOrder = (productId: number) => {
    // TODO: Implement purchase order generation
    console.log('Generate PO for product:', productId);
  };

  const criticalProducts = lowStockProducts.filter((p) => (p.total_stock || 0) === 0);
  const lowProducts = lowStockProducts.filter((p) => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= p.min_stock_level);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Low Stock Alerts</h2>
          <p className="text-muted-foreground">
            Monitor inventory levels and receive alerts for low stock items
          </p>
        </div>
        <Button onClick={fetchLowStockProducts}>
          <Bell className="h-4 w-4 mr-2" />
          Refresh Alerts
        </Button>
      </div>

      {/* Alert Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Out of Stock
            </CardTitle>
            <Package className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Immediate attention required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Below minimum level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Value at Risk
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{
              lowStockProducts.reduce((sum, product) => sum + product.selling_price * (product.total_stock || 0), 0).toLocaleString()
              }</div>
            <p className="text-xs text-muted-foreground">
              Current inventory value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reorder Suggested
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Products need reordering
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Stock Alert */}
      {criticalProducts.length > 0 &&
      <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-red-700">Critical Stock Alert</CardTitle>
            </div>
            <CardDescription className="text-red-600">
              {criticalProducts.length} products are completely out of stock and need immediate restocking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {criticalProducts.slice(0, 6).map((product) =>
            <div key={product.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => generatePurchaseOrder(product.id)}>
                    Reorder
                  </Button>
                </div>
            )}
            </div>
            {criticalProducts.length > 6 &&
          <p className="text-sm text-red-600 mt-2">
                And {criticalProducts.length - 6} more products...
              </p>
          }
          </CardContent>
        </Card>
      }

      {/* Low Stock Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Products</CardTitle>
          <CardDescription>
            Products below minimum stock level threshold
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ?
          <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div> :
          lowStockProducts.length > 0 ?
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Min Level</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.map((product) => {
                const stockInfo = getStockLevel(
                  product.total_stock || 0,
                  product.min_stock_level,
                  product.max_stock_level
                );

                return (
                  <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">{product.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {product.total_stock || 0} {product.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {product.min_stock_level} {product.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStockBadge(stockInfo.level)}
                      </TableCell>
                      <TableCell>
                        <div className="w-20">
                          <Progress
                          value={stockInfo.percentage}
                          className="h-2" />

                          <span className="text-xs text-muted-foreground">
                            {stockInfo.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        ৳{((product.total_stock || 0) * product.selling_price).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generatePurchaseOrder(product.id)}>

                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Reorder
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>);

              })}
              </TableBody>
            </Table> :

          <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">All Stock Levels Good!</h3>
              <p>No products are below their minimum stock levels.</p>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

};

export default LowStockAlerts;