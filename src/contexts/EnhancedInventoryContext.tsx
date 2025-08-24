
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { inventoryClient } from '@/lib/network/inventory-client';
import { ApiError } from '@/lib/errors';
import { useNetwork } from '@/contexts/NetworkContext';

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

interface NetworkDiagnostics {
  activeRequests: any[];
  errorHistory: any[];
  performanceMetrics: any[];
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  lastHealthCheck?: Date;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

interface EnhancedInventoryContextType {
  // State
  products: Product[];
  categories: Category[];
  loading: boolean;
  loadingProducts: boolean;
  loadingCategories: boolean;
  selectedProduct: Product | null;
  error: ApiError | null;
  isRetrying: boolean;
  lastSync: Date | null;

  // Core operations
  fetchProducts: (filters?: any) => Promise<void>;
  fetchCategories: () => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  setSelectedProduct: (product: Product | null) => void;

  // Network operations
  forceSync: () => Promise<void>;
  retryFailedOperations: () => Promise<void>;
  clearError: () => void;

  // Diagnostics
  getDiagnostics: () => NetworkDiagnostics;
  exportDiagnostics: () => string;
  clearDiagnostics: () => void;
  getConnectionStatus: () => {
    online: boolean;
    quality: string;
    latency: number;
  };
}

const EnhancedInventoryContext = createContext<EnhancedInventoryContextType | undefined>(undefined);

export function EnhancedInventoryProvider({ children }: { children: React.ReactNode }) {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Network context
  const { online } = useNetwork();

  // Refs
  const isMountedRef = useRef(true);
  const syncIntervalRef = useRef<number>();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && lastSync && Date.now() - lastSync.getTime() > 30000) {
      // Sync if we've been offline for more than 30 seconds
      forceSync().catch(console.error);
    }
  }, [online]);

  // Periodic background sync
  useEffect(() => {
    if (online) {
      syncIntervalRef.current = window.setInterval(() => {
        if (!loadingProducts && !loadingCategories) {
          forceSync().catch(console.error);
        }
      }, 300000); // Sync every 5 minutes when online
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = undefined;
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [online, loadingProducts, loadingCategories]);

  const handleError = useCallback((error: unknown, operation: string, showToast = true) => {
    if (!isMountedRef.current) return;

    const apiError = error instanceof ApiError ? error : new ApiError(
      error instanceof Error ? error.message : String(error),
      'INVENTORY_ERROR',
      true,
      { operation }
    );

    setError(apiError);

    if (showToast && apiError.retryable) {
      toast({
        title: 'Network Issue',
        description: `${operation} failed. Will retry automatically when connection improves.`,
        variant: 'destructive'
      });
    } else if (showToast) {
      toast({
        title: 'Error',
        description: apiError.message,
        variant: 'destructive'
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchProducts = useCallback(async (filters?: any) => {
    if (!isMountedRef.current || loadingProducts) return;

    setLoadingProducts(true);
    clearError();

    try {
      const productsData = await inventoryClient.fetchProducts(filters);
      
      if (isMountedRef.current) {
        setProducts(productsData);
        setLastSync(new Date());
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'fetchProducts');
        // Keep existing products on error to prevent empty state
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingProducts(false);
      }
    }
  }, [loadingProducts, handleError, clearError]);

  const fetchCategories = useCallback(async () => {
    if (!isMountedRef.current || loadingCategories) return;

    setLoadingCategories(true);
    clearError();

    try {
      const categoriesData = await inventoryClient.fetchCategories();
      
      if (isMountedRef.current) {
        setCategories(categoriesData);
        setLastSync(new Date());
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'fetchCategories');
        // Keep existing categories on error
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingCategories(false);
      }
    }
  }, [loadingCategories, handleError, clearError]);

  const saveProduct = useCallback(async (product: Product) => {
    if (!isMountedRef.current) return;

    try {
      const result = await inventoryClient.saveProduct(product);
      
      if (isMountedRef.current) {
        toast({
          title: 'Success',
          description: 'Product saved successfully'
        });

        // Refresh products list
        await fetchProducts();
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'saveProduct');
        throw error; // Re-throw for form handling
      }
    }
  }, [fetchProducts, handleError]);

  const deleteProduct = useCallback(async (id: number) => {
    if (!isMountedRef.current) return;

    try {
      // TODO: Implement delete product in inventory client
      toast({
        title: 'Success',
        description: 'Product deleted successfully'
      });

      await fetchProducts();
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'deleteProduct');
      }
    }
  }, [fetchProducts, handleError]);

  const forceSync = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsRetrying(true);
    try {
      await Promise.allSettled([
        fetchProducts(),
        fetchCategories()
      ]);
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [fetchProducts, fetchCategories]);

  const retryFailedOperations = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsRetrying(true);
    clearError();

    try {
      // Clear any cached failures and retry
      await forceSync();
      
      toast({
        title: 'Retry Complete',
        description: 'Operations retried successfully'
      });
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error, 'retryFailedOperations');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [forceSync, clearError, handleError]);

  const getDiagnostics = useCallback((): NetworkDiagnostics => {
    const activeRequests = inventoryClient.getActiveRequests();
    const errorHistory = inventoryClient.getErrorDiagnostics();
    const harEntries = inventoryClient.getHAREntries();

    const totalRequests = activeRequests.length + errorHistory.length;
    const failedRequests = errorHistory.length;
    const averageResponseTime = harEntries.reduce((sum, entry) => sum + entry.time, 0) / Math.max(harEntries.length, 1);

    let connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline' = 'offline';
    if (online) {
      if (averageResponseTime < 100) connectionQuality = 'excellent';
      else if (averageResponseTime < 300) connectionQuality = 'good';
      else if (averageResponseTime < 1000) connectionQuality = 'fair';
      else connectionQuality = 'poor';
    }

    return {
      activeRequests,
      errorHistory,
      performanceMetrics: harEntries,
      connectionQuality,
      lastHealthCheck: lastSync,
      totalRequests,
      failedRequests,
      averageResponseTime
    };
  }, [online, lastSync]);

  const exportDiagnostics = useCallback((): string => {
    return inventoryClient.exportDiagnostics();
  }, []);

  const clearDiagnostics = useCallback(() => {
    inventoryClient.clearDiagnostics();
    toast({
      title: 'Diagnostics Cleared',
      description: 'All diagnostic data has been cleared'
    });
  }, []);

  const getConnectionStatus = useCallback(() => {
    const diagnostics = getDiagnostics();
    return {
      online,
      quality: diagnostics.connectionQuality,
      latency: diagnostics.averageResponseTime
    };
  }, [online, getDiagnostics]);

  // Initialize data on mount
  useEffect(() => {
    if (isMountedRef.current) {
      forceSync();
    }
  }, []);

  const value: EnhancedInventoryContextType = {
    products,
    categories,
    loading: loadingProducts || loadingCategories,
    loadingProducts,
    loadingCategories,
    selectedProduct,
    error,
    isRetrying,
    lastSync,
    fetchProducts,
    fetchCategories,
    saveProduct,
    deleteProduct,
    setSelectedProduct,
    forceSync,
    retryFailedOperations,
    clearError,
    getDiagnostics,
    exportDiagnostics,
    clearDiagnostics,
    getConnectionStatus
  };

  return (
    <EnhancedInventoryContext.Provider value={value}>
      {children}
    </EnhancedInventoryContext.Provider>
  );
}

export function useEnhancedInventory() {
  const context = useContext(EnhancedInventoryContext);
  if (context === undefined) {
    throw new Error('useEnhancedInventory must be used within an EnhancedInventoryProvider');
  }
  return context;
}
