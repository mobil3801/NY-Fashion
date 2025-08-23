import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { inventoryService, Product, Category, StockMovement, InventoryFilter } from '@/services/inventory-service';
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import { useLoadingState } from '@/hooks/use-loading-state';

interface InventoryContextType {
  products: Product[];
  categories: Category[];
  stockMovements: StockMovement[];
  lowStockProducts: Product[];
  isLoading: boolean;
  error: string | null;
  totalProducts: number;
  hasMoreProducts: boolean;
  currentPage: number;

  // Product operations
  fetchProducts: (params?: {
    page?: number;
    pageSize?: number;
    filters?: InventoryFilter;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    append?: boolean;
  }) => Promise<void>;
  createProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (product: Product) => Promise<Product>;
  deleteProduct: (id: number) => Promise<void>;
  getProduct: (id: number) => Promise<Product>;
  getProductById: (id: number) => Product | undefined;
  bulkUpdateProducts: (products: Array<Partial<Product> & {id: number;}>) => Promise<void>;

  // Category operations
  fetchCategories: () => Promise<void>;
  createCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (category: Category) => Promise<Category>;
  deleteCategory: (id: number) => Promise<void>;

  // Stock operations
  fetchStockMovements: (params?: {
    page?: number;
    pageSize?: number;
    productId?: number;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  createStockMovement: (movement: Omit<StockMovement, 'id'>) => Promise<StockMovement>;
  getLowStockProducts: () => Promise<void>;

  // Image operations
  loadProductImages: (productId: number) => Promise<any[]>;

  // Utility functions
  refreshData: () => Promise<void>;
  clearError: () => void;
  resetPagination: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

interface InventoryProviderProps {
  children: ReactNode;
}

export const InventoryProvider: React.FC<InventoryProviderProps> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { isLoading, withLoading } = useLoadingState();
  const { toast } = useToast();

  // Initialize data on mount
  useEffect(() => {
    initializeInventoryData();
  }, []);

  const initializeInventoryData = async () => {
    await withLoading(async () => {
      try {
        logger.logInfo('Initializing inventory data');

        // Load initial data in parallel - wrap each in its own try-catch to prevent one failure from stopping all
        const promises = [
        fetchProducts({ page: 1 }).catch((error) => {
          logger.logError('Failed to fetch products during initialization', error);
          return null;
        }),
        fetchCategories().catch((error) => {
          logger.logError('Failed to fetch categories during initialization', error);
          return null;
        }),
        getLowStockProducts().catch((error) => {
          logger.logError('Failed to fetch low stock products during initialization', error);
          return null;
        })];


        await Promise.allSettled(promises);

        logger.logInfo('Inventory data initialized successfully');
      } catch (error: any) {
        logger.logError('Failed to initialize inventory data', error);
        setError('Failed to load inventory data');
        toast({
          title: 'Error',
          description: 'Failed to load inventory data. Please try again.',
          variant: 'destructive'
        });
      }
    });
  };

  // Product operations
  const fetchProducts = async (params: {
    page?: number;
    pageSize?: number;
    filters?: InventoryFilter;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    append?: boolean;
  } = {}) => {
    try {
      const { append = false, ...otherParams } = params;

      logger.logDatabaseOperation('fetch', 'products', otherParams);

      const result = await inventoryService.getProducts(otherParams);

      if (append) {
        setProducts((prev) => [...prev, ...result.products]);
      } else {
        setProducts(result.products);
      }

      setTotalProducts(result.total);
      setHasMoreProducts(result.hasMore);
      setCurrentPage(params.page || 1);
      setError(null);

    } catch (error: any) {
      logger.logError('Failed to fetch products', error);
      setError(error.message || 'Failed to fetch products');
      throw error;
    }
  };

  const createProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('create', 'products', { name: product.name });

        const newProduct = await inventoryService.saveProduct(product);

        // Add to local state
        setProducts((prev) => [newProduct, ...prev]);
        setError(null);

        logger.logDatabaseOperation('created', 'products', {
          id: newProduct.id,
          name: product.name
        });

        return newProduct;
      } catch (error: any) {
        logger.logError('Failed to create product', error);
        setError(error.message || 'Failed to create product');
        throw error;
      }
    });
  };

  const updateProduct = async (product: Product): Promise<Product> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('update', 'products', {
          id: product.id,
          name: product.name
        });

        const updatedProduct = await inventoryService.saveProduct(product);

        // Update in local state
        setProducts((prev) =>
        prev.map((p) => p.id === product.id ? updatedProduct : p)
        );
        setError(null);

        logger.logDatabaseOperation('updated', 'products', {
          id: product.id,
          name: product.name
        });

        return updatedProduct;
      } catch (error: any) {
        logger.logError('Failed to update product', error);
        setError(error.message || 'Failed to update product');
        throw error;
      }
    });
  };

  const deleteProduct = async (id: number): Promise<void> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('delete', 'products', { id });

        await inventoryService.deleteProduct(id);

        // Remove from local state
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setError(null);

        logger.logDatabaseOperation('deleted', 'products', { id });
      } catch (error: any) {
        logger.logError('Failed to delete product', error);
        setError(error.message || 'Failed to delete product');
        throw error;
      }
    });
  };

  const getProduct = async (id: number): Promise<Product> => {
    try {
      logger.logDatabaseOperation('fetch', 'products', { id });

      const product = await inventoryService.getProduct(id);

      logger.logDatabaseOperation('fetched', 'products', {
        id,
        name: product.name
      });

      return product;
    } catch (error: any) {
      logger.logError('Failed to fetch product', error);
      throw error;
    }
  };

  const getProductById = (id: number): Product | undefined => {
    return products.find((p) => p.id === id);
  };

  const bulkUpdateProducts = async (productsToUpdate: Array<Partial<Product> & {id: number;}>): Promise<void> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('bulk_update', 'products', {
          count: productsToUpdate.length
        });

        const result = await inventoryService.bulkUpdateProducts(productsToUpdate);

        // Refresh products list to get updated data
        await fetchProducts({ page: 1 });

        setError(null);

        logger.logDatabaseOperation('bulk_updated', 'products', {
          total: productsToUpdate.length,
          successful: result.results?.length || 0,
          failed: result.errors?.length || 0
        });
      } catch (error: any) {
        logger.logError('Bulk update failed', error);
        setError(error.message || 'Bulk update failed');
        throw error;
      }
    });
  };

  // Category operations
  const fetchCategories = async (): Promise<void> => {
    try {
      logger.logDatabaseOperation('fetch', 'categories');

      const categoriesList = await inventoryService.getCategories();

      setCategories(categoriesList);
      setError(null);

      logger.logDatabaseOperation('fetched', 'categories', {
        count: categoriesList.length
      });
    } catch (error: any) {
      logger.logError('Failed to fetch categories', error);
      setError(error.message || 'Failed to fetch categories');
      throw error;
    }
  };

  const createCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('create', 'categories', { name: category.name });

        const newCategory = await inventoryService.saveCategory(category);

        // Add to local state
        setCategories((prev) => [...prev, newCategory]);
        setError(null);

        logger.logDatabaseOperation('created', 'categories', {
          id: newCategory.id,
          name: category.name
        });

        return newCategory;
      } catch (error: any) {
        logger.logError('Failed to create category', error);
        setError(error.message || 'Failed to create category');
        throw error;
      }
    });
  };

  const updateCategory = async (category: Category): Promise<Category> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('update', 'categories', {
          id: category.id,
          name: category.name
        });

        const updatedCategory = await inventoryService.saveCategory(category);

        // Update in local state
        setCategories((prev) =>
        prev.map((c) => c.id === category.id ? updatedCategory : c)
        );
        setError(null);

        logger.logDatabaseOperation('updated', 'categories', {
          id: category.id,
          name: category.name
        });

        return updatedCategory;
      } catch (error: any) {
        logger.logError('Failed to update category', error);
        setError(error.message || 'Failed to update category');
        throw error;
      }
    });
  };

  const deleteCategory = async (id: number): Promise<void> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('delete', 'categories', { id });

        // Note: You might want to check if category has products before deleting
        await inventoryService.deleteCategory(id);

        // Remove from local state
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setError(null);

        logger.logDatabaseOperation('deleted', 'categories', { id });
      } catch (error: any) {
        logger.logError('Failed to delete category', error);
        setError(error.message || 'Failed to delete category');
        throw error;
      }
    });
  };

  // Stock operations
  const fetchStockMovements = async (params: {
    page?: number;
    pageSize?: number;
    productId?: number;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<void> => {
    try {
      logger.logDatabaseOperation('fetch', 'stock_movements', params);

      const result = await inventoryService.getStockMovements(params);

      setStockMovements(result.movements);
      setError(null);

      logger.logDatabaseOperation('fetched', 'stock_movements', {
        count: result.movements.length
      });
    } catch (error: any) {
      logger.logError('Failed to fetch stock movements', error);
      setError(error.message || 'Failed to fetch stock movements');
      throw error;
    }
  };

  const createStockMovement = async (movement: Omit<StockMovement, 'id'>): Promise<StockMovement> => {
    return withLoading(async () => {
      try {
        logger.logDatabaseOperation('create', 'stock_movements', {
          product_id: movement.product_id,
          movement_type: movement.movement_type,
          quantity: movement.quantity
        });

        const newMovement = await inventoryService.createStockMovement(movement);

        // Add to local state
        setStockMovements((prev) => [newMovement, ...prev]);

        // Refresh products to update stock quantities
        await fetchProducts({ page: currentPage });

        setError(null);

        logger.logDatabaseOperation('created', 'stock_movements', {
          id: newMovement.id,
          product_id: movement.product_id
        });

        return newMovement;
      } catch (error: any) {
        logger.logError('Failed to create stock movement', error);
        setError(error.message || 'Failed to create stock movement');
        throw error;
      }
    });
  };

  const getLowStockProducts = async (): Promise<void> => {
    try {
      logger.logDatabaseOperation('fetch', 'products', { filter: 'low_stock' });

      const lowStock = await inventoryService.getLowStockProducts();

      setLowStockProducts(lowStock);
      setError(null);

      logger.logDatabaseOperation('fetched', 'products', {
        filter: 'low_stock',
        count: lowStock.length
      });
    } catch (error: any) {
      logger.logError('Failed to fetch low stock products', error);
      setError(error.message || 'Failed to fetch low stock products');
      throw error;
    }
  };

  // Image operations
  const loadProductImages = async (productId: number): Promise<any[]> => {
    try {
      logger.logDatabaseOperation('fetch', 'product_images', { productId });

      const result = await window.ezsite.apis.run({
        path: 'getProductImages',
        param: [productId]
      });

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation('fetched', 'product_images', {
        productId,
        count: result.data.count
      });

      return result.data.images || [];
    } catch (error: any) {
      logger.logError('Failed to load product images', error);
      throw error;
    }
  };

  // Utility functions
  const refreshData = async (): Promise<void> => {
    await withLoading(async () => {
      try {
        logger.logInfo('Refreshing inventory data');

        await Promise.all([
        fetchProducts({ page: 1 }),
        fetchCategories(),
        getLowStockProducts()]
        );

        logger.logInfo('Inventory data refreshed successfully');
      } catch (error: any) {
        logger.logError('Failed to refresh inventory data', error);
        setError(error.message || 'Failed to refresh inventory data');
        throw error;
      }
    });
  };

  const clearError = () => {
    setError(null);
  };

  const resetPagination = () => {
    setCurrentPage(1);
    setTotalProducts(0);
    setHasMoreProducts(false);
  };

  const contextValue: InventoryContextType = {
    products,
    categories,
    stockMovements,
    lowStockProducts,
    isLoading,
    error,
    totalProducts,
    hasMoreProducts,
    currentPage,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    getProductById,
    bulkUpdateProducts,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchStockMovements,
    createStockMovement,
    getLowStockProducts,
    loadProductImages,
    refreshData,
    clearError,
    resetPagination
  };

  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>);

};

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export default InventoryProvider;