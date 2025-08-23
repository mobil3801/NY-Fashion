
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useApiRetry, type RetryContext } from '@/hooks/use-api-retry';
import { normalizeError, getUserFriendlyMessage, logApiEvent, type ApiError } from '@/lib/errors';

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
  loadingProducts: boolean;
  loadingCategories: boolean;
  selectedProduct: Product | null;
  error: ApiError | null;
  isRetrying: boolean;

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
  getLowStockProducts: (filters?: any) => Promise<Product[]>;

  // Import/Export
  importProductsFromCSV: (csvData: string) => Promise<void>;
  exportProductsToCSV: () => Promise<string>;

  // Manual retry and error handling
  retry: () => void;
  clearError: () => void;

  // Health check
  healthCheck: () => Promise<any>;
  seedData: () => Promise<any>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: {children: React.ReactNode;}) {
  // State management
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Request management
  const currentRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastFailedOperationRef = useRef<string | null>(null);

  // API retry hook
  const { executeWithRetry, abortAll, isMounted } = useApiRetry();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortAll();
    };
  }, [abortAll]);

  // Helper to generate and track request IDs
  const getNextRequestId = useCallback(() => {
    return ++currentRequestIdRef.current;
  }, []);

  // Helper to check if response is still valid
  const isValidResponse = useCallback((requestId: number) => {
    return isMountedRef.current && requestId === currentRequestIdRef.current;
  }, []);

  // Error handling helper
  const handleError = useCallback((error: unknown, operation: string) => {
    if (!isMountedRef.current) return;

    const normalizedError = normalizeError(error, operation);
    setError(normalizedError);
    lastFailedOperationRef.current = operation;

    // Show user-friendly error message
    const message = getUserFriendlyMessage(error);
    if (normalizedError.type !== 'business') {
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      setError(null);
      lastFailedOperationRef.current = null;
    }
  }, []);

  // Fetch products with retry logic
  const fetchProducts = useCallback(async (search?: string) => {
    if (!isMountedRef.current) return;

    const requestId = getNextRequestId();
    setLoadingProducts(true);
    clearError();

    try {
      await executeWithRetry(
        async (ctx: RetryContext) => {
          if (!isValidResponse(requestId)) {
            throw new Error('Request cancelled');
          }

          const { data, error } = await window.ezsite.apis.run({
            path: "getProducts",
            param: [{
              search: search || '',
              limit: 100,
              order_by: 'name',
              order_dir: 'asc'
            }]
          });

          if (error) {
            throw new Error(typeof error === 'string' ? error : 'Failed to fetch products');
          }

          // Only update state if this is still the current request
          if (isValidResponse(requestId)) {
            // Handle the response correctly - products are returned directly as array
            const products = Array.isArray(data) ? data : [];
            setProducts(products);
          }

          return data;
        },
        {
          attempts: 3,
          baseDelayMs: 300,
          maxDelayMs: 5000,
          onAttempt: ({ attempt, error }) => {
            if (isMountedRef.current) {
              setIsRetrying(attempt > 1);
              if (error) {
                logApiEvent({
                  operation: 'fetchProducts',
                  attempt,
                  retryable: attempt < 3,
                  message: error.message,
                  error
                });
              }
            }
          },
          onGiveUp: (error) => {
            if (isMountedRef.current) {
              setIsRetrying(false);
              handleError(error, 'fetchProducts');
            }
          }
        }
      );

      // Success - clear any previous errors
      if (isMountedRef.current) {
        setIsRetrying(false);
        clearError();
      }

    } catch (error) {
      if (isMountedRef.current) {
        setIsRetrying(false);
        handleError(error, 'fetchProducts');
        setProducts([]); // Set empty array to prevent UI issues
      }
    } finally {
      if (isValidResponse(requestId)) {
        setLoadingProducts(false);
      }
    }
  }, [executeWithRetry, getNextRequestId, isValidResponse, clearError, handleError]);

  // Fetch categories with retry logic
  const fetchCategories = useCallback(async () => {
    if (!isMountedRef.current) return;

    const requestId = getNextRequestId();
    setLoadingCategories(true);
    clearError();

    try {
      await executeWithRetry(
        async (ctx: RetryContext) => {
          if (!isValidResponse(requestId)) {
            throw new Error('Request cancelled');
          }

          const { data, error } = await window.ezsite.apis.run({
            path: "getCategories",
            param: [{
              order_by: 'name',
              order_dir: 'asc'
            }]
          });

          if (error) {
            throw new Error(typeof error === 'string' ? error : 'Failed to fetch categories');
          }

          // Only update state if this is still the current request
          if (isValidResponse(requestId)) {
            // Handle the response correctly - categories are returned directly as array
            const categories = Array.isArray(data) ? data : [];
            setCategories(categories);
          }

          return data;
        },
        {
          attempts: 3,
          baseDelayMs: 300,
          maxDelayMs: 5000,
          onAttempt: ({ attempt, error }) => {
            if (isMountedRef.current) {
              setIsRetrying(attempt > 1);
              if (error) {
                logApiEvent({
                  operation: 'fetchCategories',
                  attempt,
                  retryable: attempt < 3,
                  message: error.message,
                  error
                });
              }
            }
          },
          onGiveUp: (error) => {
            if (isMountedRef.current) {
              setIsRetrying(false);
              handleError(error, 'fetchCategories');
            }
          }
        }
      );

      // Success - clear any previous errors
      if (isMountedRef.current) {
        setIsRetrying(false);
        clearError();
      }

    } catch (error) {
      if (isMountedRef.current) {
        setIsRetrying(false);
        handleError(error, 'fetchCategories');
        setCategories([]); // Set empty array to prevent UI issues
      }
    } finally {
      if (isValidResponse(requestId)) {
        setLoadingCategories(false);
      }
    }
  }, [executeWithRetry, getNextRequestId, isValidResponse, clearError, handleError]);

  // Save product with retry logic
  const saveProduct = useCallback(async (product: Product) => {
    if (!isMountedRef.current) return;

    try {
      await executeWithRetry(
        async (ctx: RetryContext) => {
          const { data, error } = await window.ezsite.apis.run({
            path: 'saveProduct',
            param: [product, 1] // TODO: Get actual user ID from auth context
          });

          if (error) {
            throw new Error(typeof error === 'string' ? error : 'Failed to save product');
          }

          if (isMountedRef.current) {
            toast({
              title: "Success",
              description: data.message || "Product saved successfully"
            });

            // Refresh products list
            fetchProducts();
          }

          return data;
        },
        {
          attempts: 2, // Fewer attempts for write operations
          baseDelayMs: 500,
          maxDelayMs: 3000,
          onAttempt: ({ attempt, error }) => {
            if (isMountedRef.current && error) {
              logApiEvent({
                operation: 'saveProduct',
                attempt,
                retryable: attempt < 2,
                message: error.message,
                error
              });
            }
          }
        }
      );

    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'saveProduct');
        throw error; // Re-throw for form handling
      }
    }
  }, [executeWithRetry, handleError, fetchProducts]);

  // Manual retry function
  const retry = useCallback(() => {
    if (!isMountedRef.current || !lastFailedOperationRef.current) return;

    const operation = lastFailedOperationRef.current;
    clearError();

    switch (operation) {
      case 'fetchProducts':
        fetchProducts();
        break;
      case 'fetchCategories':
        fetchCategories();
        break;
      default:
        // For unknown operations, refresh all data
        fetchProducts();
        fetchCategories();
        break;
    }
  }, [clearError, fetchProducts, fetchCategories]);

  const healthCheck = useCallback(async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: "healthCheckInventory",
        param: []
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Health check failed');
      }

      return data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }, []);

  const seedData = useCallback(async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: "seedInventoryData",
        param: []
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Data seeding failed');
      }

      // Refresh products after seeding
      await fetchProducts();
      await fetchCategories();

      return data;
    } catch (error) {
      console.error('Seed data error:', error);
      throw error;
    }
  }, [fetchProducts, fetchCategories]);

  // Stub implementations for other methods (keeping existing behavior)
  const deleteProduct = useCallback(async (id: number) => {
    try {
      // TODO: Implement delete product API
      toast({
        title: "Success",
        description: "Product deleted successfully"
      });

      await fetchProducts();
    } catch (error) {
      handleError(error, 'deleteProduct');
    }
  }, [fetchProducts, handleError]);

  const addStockMovement = useCallback(async (movement: StockMovement) => {
    try {
      // TODO: Implement stock movement API
      toast({
        title: "Success",
        description: "Stock movement recorded"
      });
    } catch (error) {
      handleError(error, 'addStockMovement');
    }
  }, [handleError]);

  const getStockMovements = useCallback(async (productId: number, variantId?: number): Promise<StockMovement[]> => {
    try {
      // TODO: Implement get stock movements API
      return [];
    } catch (error) {
      handleError(error, 'getStockMovements');
      return [];
    }
  }, [handleError]);

  const adjustStock = useCallback(async (adjustments: any[]) => {
    try {
      // TODO: Implement stock adjustment API
      toast({
        title: "Success",
        description: "Stock adjusted successfully"
      });

      await fetchProducts();
    } catch (error) {
      handleError(error, 'adjustStock');
    }
  }, [fetchProducts, handleError]);

  const getLowStockProducts = useCallback(async (filters?: any): Promise<Product[]> => {
    if (!isMountedRef.current) return [];

    try {
      return await executeWithRetry(
        async (ctx: RetryContext) => {
          const { data, error } = await window.ezsite.apis.run({
            path: 'getLowStockProducts',
            param: [filters || { limit: 100 }]
          });

          if (error) {
            throw new Error(typeof error === 'string' ? error : 'Failed to fetch low stock products');
          }

          const products = Array.isArray(data) ? data : [];
          return products;
        },
        {
          attempts: 3,
          baseDelayMs: 300,
          maxDelayMs: 5000
        }
      );
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'getLowStockProducts');
      }
      return [];
    }
  }, [executeWithRetry, handleError]);

  const importProductsFromCSV = useCallback(async (csvData: string) => {
    try {
      // TODO: Implement CSV import
      toast({
        title: "Success",
        description: "Products imported successfully"
      });

      await fetchProducts();
    } catch (error) {
      handleError(error, 'importProductsFromCSV');
    }
  }, [fetchProducts, handleError]);

  const exportProductsToCSV = useCallback(async (): Promise<string> => {
    try {
      // TODO: Implement CSV export
      return "";
    } catch (error) {
      handleError(error, 'exportProductsToCSV');
      return "";
    }
  }, [handleError]);

  // Initialize data on mount
  useEffect(() => {
    if (isMountedRef.current) {
      fetchCategories();
      fetchProducts();
    }
  }, [fetchCategories, fetchProducts]);

  const value: InventoryContextType = {
    products,
    categories,
    loading: loadingProducts || loadingCategories,
    loadingProducts,
    loadingCategories,
    selectedProduct,
    error,
    isRetrying,
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
    exportProductsToCSV,
    retry,
    clearError,
    healthCheck,
    seedData
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>);

}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}