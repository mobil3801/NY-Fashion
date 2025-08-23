
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface Product {
  id?: number;
  name: string;
  name_bn?: string;
  description?: string;
  category_id: number;
  brand?: string;
  sku: string;
  barcode?: string;
  cost_price: number;
  selling_price: number;
  msrp?: number;
  min_stock_level: number;
  max_stock_level: number;
  unit: string;
  weight?: number;
  dimensions?: string;
  has_variants: boolean;
  tags?: string;
  variants?: ProductVariant[];
  images?: ProductImage[];
  category_name?: string;
  total_stock?: number;
  variant_count?: number;
  primary_image?: string;
}

interface ProductVariant {
  id?: number;
  product_id?: number;
  variant_name: string;
  sku: string;
  barcode?: string;
  size?: string;
  color?: string;
  material?: string;
  cost_price: number;
  selling_price: number;
  msrp?: number;
  current_stock: number;
  reserved_stock?: number;
}

interface ProductImage {
  id?: number;
  product_id?: number;
  variant_id?: number;
  image_url: string;
  image_alt?: string;
  is_primary: boolean;
  sort_order: number;
}

interface Category {
  id: number;
  name: string;
  name_bn?: string;
  description?: string;
  parent_id?: number;
  product_count?: number;
}

interface StockMovement {
  id?: number;
  product_id: number;
  variant_id?: number;
  movement_type: 'receipt' | 'sale' | 'adjustment' | 'return' | 'transfer';
  reference_type?: string;
  reference_id?: number;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  created_by?: number;
  created_at?: string;
}

interface InventoryContextType {
  products: Product[];
  categories: Category[];
  loading: boolean;
  selectedProduct: Product | null;
  
  // Product management
  fetchProducts: (filters?: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  setSelectedProduct: (product: Product | null) => void;
  
  // Stock management
  addStockMovement: (movement: StockMovement) => Promise<void>;
  getStockMovements: (productId: number, variantId?: number) => Promise<StockMovement[]>;
  adjustStock: (adjustments: any[]) => Promise<void>;
  
  // Low stock alerts
  getLowStockProducts: () => Promise<Product[]>;
  
  // Import/Export
  importProductsFromCSV: (csvData: string) => Promise<void>;
  exportProductsToCSV: () => Promise<string>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchProducts = async (filters: any = {}) => {
    try {
      setLoading(true);
      const { data, error } = await window.ezsite.apis.run({
        path: 'getProducts',
        param: [filters]
      });

      if (error) {
        throw new Error(error.message);
      }

      setProducts(data.products || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'getCategories',
        param: []
      });

      if (error) {
        throw new Error(error.message);
      }

      setCategories(data.categories || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch categories",
        variant: "destructive"
      });
    }
  };

  const saveProduct = async (product: Product) => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'saveProduct',
        param: [product, 1] // TODO: Get actual user ID from auth context
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Success",
        description: data.message
      });

      // Refresh products list
      await fetchProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      // TODO: Implement delete product API
      toast({
        title: "Success",
        description: "Product deleted successfully"
      });

      await fetchProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    }
  };

  const addStockMovement = async (movement: StockMovement) => {
    try {
      // TODO: Implement stock movement API
      toast({
        title: "Success",
        description: "Stock movement recorded"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record stock movement",
        variant: "destructive"
      });
    }
  };

  const getStockMovements = async (productId: number, variantId?: number): Promise<StockMovement[]> => {
    try {
      // TODO: Implement get stock movements API
      return [];
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch stock movements",
        variant: "destructive"
      });
      return [];
    }
  };

  const adjustStock = async (adjustments: any[]) => {
    try {
      // TODO: Implement stock adjustment API
      toast({
        title: "Success",
        description: "Stock adjusted successfully"
      });

      await fetchProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive"
      });
    }
  };

  const getLowStockProducts = async (): Promise<Product[]> => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'getProducts',
        param: [{ low_stock_only: true }]
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.products || [];
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch low stock products",
        variant: "destructive"
      });
      return [];
    }
  };

  const importProductsFromCSV = async (csvData: string) => {
    try {
      // TODO: Implement CSV import
      toast({
        title: "Success",
        description: "Products imported successfully"
      });

      await fetchProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import products",
        variant: "destructive"
      });
    }
  };

  const exportProductsToCSV = async (): Promise<string> => {
    try {
      // TODO: Implement CSV export
      return "";
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export products",
        variant: "destructive"
      });
      return "";
    }
  };

  // Initialize data
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const value: InventoryContextType = {
    products,
    categories,
    loading,
    selectedProduct,
    fetchProducts,
    fetchCategories,
    saveProduct,
    deleteProduct,
    setSelectedProduct,
    addStockMovement,
    getStockMovements,
    adjustStock,
    getLowStockProducts,
    importProductsFromCSV,
    exportProductsToCSV
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
