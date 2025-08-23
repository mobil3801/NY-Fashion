import React, { useState, useEffect, useRef } from 'react';
import { Search, Scan, Package, Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/types/pos';
import { usePOS } from '@/contexts/POSContext';
import { useToast } from '@/hooks/use-toast';

const ProductSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'sku' | 'barcode'>('name');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { addToCart } = usePOS();
  const { toast } = useToast();

  // Focus search input on component mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto-search when query changes (debounced)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data: products } = await window.ezsite.apis.run({
          path: 'searchProducts',
          param: [searchQuery, searchType]
        });
        setSearchResults(products || []);
      } catch (error) {
        toast({
          title: 'Search Error',
          description: 'Failed to search products',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchType, toast]);

  // Handle barcode scan (Enter key simulation)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery) {
      handleSearch();
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;

    setIsLoading(true);
    try {
      const { data: products } = await window.ezsite.apis.run({
        path: 'searchProducts',
        param: [searchQuery, searchType]
      });
      setSearchResults(products || []);

      // Auto-select if exact barcode match
      if (searchType === 'barcode' && products?.length === 1) {
        setSelectedProduct(products[0]);
      }
    } catch (error) {
      toast({
        title: 'Search Error',
        description: 'Failed to search products',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const variant = selectedProduct.variants.find((v) => v.id === selectedVariant);

    // Check stock availability
    const availableStock = variant ? variant.stockQuantity : selectedProduct.currentStock;
    if (quantity > availableStock) {
      toast({
        title: 'Insufficient Stock',
        description: `Only ${availableStock} units available`,
        variant: 'destructive'
      });
      return;
    }

    addToCart(selectedProduct, variant, quantity);

    toast({
      title: 'Product Added',
      description: `${selectedProduct.name} added to cart`
    });

    // Reset form
    setSearchQuery('');
    setSelectedProduct(null);
    setSelectedVariant('');
    setQuantity(1);
    searchInputRef.current?.focus();
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants.length > 0 ? product.variants[0].id : '');
  };

  const handleQuantityChange = (change: number) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Search Type and Input */}
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Select 
                value={searchType} 
                onValueChange={(value: 'name' | 'sku' | 'barcode') => setSearchType(value)}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="barcode">Barcode</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search by ${searchType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
              
              <Button 
                onClick={handleSearch} 
                disabled={isLoading} 
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Scan className="h-4 w-4" />
                <span className="ml-2 sm:hidden">Scan</span>
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {isLoading && <div className="text-center py-4">Searching...</div>}
          
          {searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2 mt-4">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedProduct?.id === product.id ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:justify-between sm:items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{product.name}</h4>
                      <p className="text-sm text-gray-600">{product.sku}</p>
                      <p className="text-sm text-gray-500">{product.description}</p>
                    </div>
                    <div className="flex justify-between items-center sm:flex-col sm:text-right sm:items-end">
                      <p className="font-semibold">${product.basePrice.toFixed(2)}</p>
                      <Badge 
                        variant={product.currentStock > product.minStockLevel ? 'default' : 'destructive'}
                        className="mt-1"
                      >
                        Stock: {product.currentStock}
                      </Badge>
                    </div>
                  </div>
                  {product.isApparel && (
                    <Badge variant="secondary" className="mt-2">
                      Apparel (Tax Exempt under $110)
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Selection */}
      {selectedProduct && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <Package className="h-12 w-12 text-gray-400 mx-auto sm:mx-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-center sm:text-left">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 text-center sm:text-left">
                    {selectedProduct.description}
                  </p>
                  
                  {/* Variants Selection */}
                  {selectedProduct.variants.length > 0 && (
                    <div className="mb-3">
                      <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedProduct.variants.map((variant) => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.size && `Size: ${variant.size}`}
                              {variant.color && ` Color: ${variant.color}`}
                              {variant.priceAdjustment !== 0 &&
                                ` (+$${variant.priceAdjustment.toFixed(2)})`
                              }
                              {` - Stock: ${variant.stockQuantity}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                    <label className="text-sm font-medium">Qty:</label>
                    <div className="flex items-center border rounded-lg">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center border-0 focus:ring-0"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuantityChange(1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price and Add to Cart */}
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center border-t pt-4">
                <div className="text-center sm:text-left">
                  {(() => {
                    const variant = selectedProduct.variants.find((v) => v.id === selectedVariant);
                    const unitPrice = selectedProduct.basePrice + (variant?.priceAdjustment || 0);
                    return (
                      <div>
                        <p className="text-sm text-gray-600">
                          Unit Price: ${unitPrice.toFixed(2)}
                        </p>
                        <p className="font-semibold text-lg">
                          Total: ${(unitPrice * quantity).toFixed(2)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <Button 
                  onClick={handleAddToCart} 
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  Add to Cart
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductSearch;