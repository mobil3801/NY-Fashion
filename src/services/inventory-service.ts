import { productionApi } from './production-api';
import { logger } from '@/utils/production-logger';
import { validateProduct, validateStockMovement } from '@/utils/validation-schemas';
import { enhancedToast } from '@/utils/enhanced-toast';

export interface Product {
  id?: number;
  name: string;
  description?: string;
  barcode?: string;
  category_id?: number;
  supplier_id?: number;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level?: number;
  unit_of_measure: string;
  location?: string;
  status: 'active' | 'inactive' | 'discontinued';
  created_at?: string;
  updated_at?: string;
  images?: string[];
}

export interface Category {
  id?: number;
  name: string;
  description?: string;
  parent_id?: number;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface StockMovement {
  id?: number;
  product_id: number;
  movement_type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reference_number?: string;
  reason?: string;
  cost_per_unit?: number;
  supplier_id?: number;
  employee_id?: number;
  created_at?: string;
  notes?: string;
}

export interface InventoryFilter {
  search?: string;
  category_id?: number;
  status?: string;
  low_stock?: boolean;
  price_min?: number;
  price_max?: number;
  stock_min?: number;
  stock_max?: number;
}

class InventoryService {
  // Products
  async getProducts(params: {
    page?: number;
    pageSize?: number;
    filters?: InventoryFilter;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    try {
      const {
        page = 1,
        pageSize = 50,
        filters = {},
        sortField = 'name',
        sortOrder = 'asc'
      } = params;

      logger.logDatabaseOperation('Fetching products', { page, pageSize, filters });

      const queryFilters = [];

      if (filters.search) {
        queryFilters.push({
          name: 'name',
          op: 'StringContains',
          value: filters.search
        });
      }

      if (filters.category_id) {
        queryFilters.push({
          name: 'category_id',
          op: 'Equal',
          value: filters.category_id
        });
      }

      if (filters.status) {
        queryFilters.push({
          name: 'status',
          op: 'Equal',
          value: filters.status
        });
      }

      if (filters.low_stock) {
        queryFilters.push({
          name: 'stock_quantity',
          op: 'LessThanOrEqual',
          value: 'min_stock_level' // This would need custom handling
        });
      }

      if (filters.price_min !== undefined) {
        queryFilters.push({
          name: 'selling_price',
          op: 'GreaterThanOrEqual',
          value: filters.price_min
        });
      }

      if (filters.price_max !== undefined) {
        queryFilters.push({
          name: 'selling_price',
          op: 'LessThanOrEqual',
          value: filters.price_max
        });
      }

      const result = await productionApi.tablePage('products', {
        PageNo: page,
        PageSize: pageSize,
        OrderByField: sortField,
        IsAsc: sortOrder === 'asc',
        Filters: queryFilters
      }, {
        showLoading: true,
        loadingMessage: 'Loading products...'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation('Products fetched successfully', {
        count: result.data?.List?.length || 0,
        total: result.data?.VirtualCount || 0
      });

      return {
        products: result.data?.List || [],
        total: result.data?.VirtualCount || 0,
        hasMore: page * pageSize < (result.data?.VirtualCount || 0)
      };

    } catch (error: any) {
      logger.logError('Failed to fetch products', error);
      enhancedToast.showApiErrorToast(error);
      throw error;
    }
  }

  async getProduct(id: number) {
    try {
      logger.logDatabaseOperation('Fetching product', { id });

      const result = await productionApi.tablePage('products', {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: 'id', op: 'Equal', value: id }]
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const product = result.data?.List?.[0];
      if (!product) {
        throw new Error('Product not found');
      }

      logger.logDatabaseOperation('Product fetched successfully', { id, name: product.name });
      return product;

    } catch (error: any) {
      logger.logError('Failed to fetch product', error, { id });
      enhancedToast.showApiErrorToast(error);
      throw error;
    }
  }

  async saveProduct(product: Omit<Product, 'id'> & {id?: number;}) {
    try {
      // Validate product data
      const validation = validateProduct(product);
      if (!validation.success) {
        const errorMessages = validation.error.errors.map((err) => err.message);
        enhancedToast.showValidationErrorToast(errorMessages);
        throw new Error(errorMessages.join(', '));
      }

      const isUpdate = !!product.id;
      logger.logDatabaseOperation(isUpdate ? 'Updating product' : 'Creating product', {
        id: product.id,
        name: product.name
      });

      let result;
      if (isUpdate) {
        result = await productionApi.tableUpdate('products', product, {
          showLoading: true,
          loadingMessage: 'Updating product...'
        });
      } else {
        result = await productionApi.tableCreate('products', product, {
          showLoading: true,
          loadingMessage: 'Creating product...'
        });
      }

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation(`Product ${isUpdate ? 'updated' : 'created'} successfully`, {
        id: product.id,
        name: product.name
      });

      return result.data;

    } catch (error: any) {
      logger.logError(`Failed to ${product.id ? 'update' : 'create'} product`, error);
      throw error;
    }
  }

  async deleteProduct(id: number) {
    try {
      logger.logDatabaseOperation('Deleting product', { id });

      const result = await productionApi.tableDelete('products', { id }, {
        showLoading: true,
        loadingMessage: 'Deleting product...'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation('Product deleted successfully', { id });
      return result.data;

    } catch (error: any) {
      logger.logError('Failed to delete product', error, { id });
      throw error;
    }
  }

  // Categories
  async getCategories() {
    try {
      logger.logDatabaseOperation('Fetching categories');

      const result = await productionApi.tablePage('categories', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'name',
        IsAsc: true,
        Filters: []
      });

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation('Categories fetched successfully', {
        count: result.data?.List?.length || 0
      });

      return result.data?.List || [];

    } catch (error: any) {
      logger.logError('Failed to fetch categories', error);
      enhancedToast.showApiErrorToast(error);
      throw error;
    }
  }

  async saveCategory(category: Omit<Category, 'id'> & {id?: number;}) {
    try {
      const isUpdate = !!category.id;
      logger.logDatabaseOperation(isUpdate ? 'Updating category' : 'Creating category', {
        id: category.id,
        name: category.name
      });

      let result;
      if (isUpdate) {
        result = await productionApi.tableUpdate('categories', category, {
          showLoading: true,
          loadingMessage: 'Updating category...'
        });
      } else {
        result = await productionApi.tableCreate('categories', category, {
          showLoading: true,
          loadingMessage: 'Creating category...'
        });
      }

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation(`Category ${isUpdate ? 'updated' : 'created'} successfully`, {
        id: category.id,
        name: category.name
      });

      return result.data;

    } catch (error: any) {
      logger.logError(`Failed to ${category.id ? 'update' : 'create'} category`, error);
      throw error;
    }
  }

  // Stock Movements
  async getStockMovements(params: {
    page?: number;
    pageSize?: number;
    productId?: number;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    try {
      const {
        page = 1,
        pageSize = 50,
        productId,
        movementType,
        startDate,
        endDate
      } = params;

      logger.logDatabaseOperation('Fetching stock movements', { page, pageSize, productId });

      const queryFilters = [];

      if (productId) {
        queryFilters.push({
          name: 'product_id',
          op: 'Equal',
          value: productId
        });
      }

      if (movementType) {
        queryFilters.push({
          name: 'movement_type',
          op: 'Equal',
          value: movementType
        });
      }

      if (startDate) {
        queryFilters.push({
          name: 'created_at',
          op: 'GreaterThanOrEqual',
          value: startDate
        });
      }

      if (endDate) {
        queryFilters.push({
          name: 'created_at',
          op: 'LessThanOrEqual',
          value: endDate
        });
      }

      const result = await productionApi.tablePage('stock_movements', {
        PageNo: page,
        PageSize: pageSize,
        OrderByField: 'created_at',
        IsAsc: false,
        Filters: queryFilters
      });

      if (result.error) {
        throw new Error(result.error);
      }

      logger.logDatabaseOperation('Stock movements fetched successfully', {
        count: result.data?.List?.length || 0,
        total: result.data?.VirtualCount || 0
      });

      return {
        movements: result.data?.List || [],
        total: result.data?.VirtualCount || 0,
        hasMore: page * pageSize < (result.data?.VirtualCount || 0)
      };

    } catch (error: any) {
      logger.logError('Failed to fetch stock movements', error);
      enhancedToast.showApiErrorToast(error);
      throw error;
    }
  }

  async createStockMovement(movement: Omit<StockMovement, 'id'>) {
    try {
      // Validate movement data
      const validation = validateStockMovement(movement);
      if (!validation.success) {
        const errorMessages = validation.error.errors.map((err) => err.message);
        enhancedToast.showValidationErrorToast(errorMessages);
        throw new Error(errorMessages.join(', '));
      }

      logger.logDatabaseOperation('Creating stock movement', {
        product_id: movement.product_id,
        movement_type: movement.movement_type,
        quantity: movement.quantity
      });

      const result = await productionApi.tableCreate('stock_movements', movement, {
        showLoading: true,
        loadingMessage: 'Recording stock movement...'
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Update product stock quantity
      if (movement.movement_type === 'in' || movement.movement_type === 'out' || movement.movement_type === 'adjustment') {
        await this.updateProductStock(movement.product_id, movement.quantity, movement.movement_type);
      }

      logger.logDatabaseOperation('Stock movement created successfully', {
        id: result.data?.id,
        product_id: movement.product_id
      });

      return result.data;

    } catch (error: any) {
      logger.logError('Failed to create stock movement', error);
      throw error;
    }
  }

  private async updateProductStock(productId: number, quantity: number, movementType: string) {
    try {
      // Get current product data
      const product = await this.getProduct(productId);

      let newQuantity = product.stock_quantity;

      switch (movementType) {
        case 'in':
          newQuantity += quantity;
          break;
        case 'out':
          newQuantity -= quantity;
          break;
        case 'adjustment':
          // For adjustment, quantity represents the new total
          newQuantity = quantity;
          break;
      }

      // Ensure quantity doesn't go negative
      newQuantity = Math.max(0, newQuantity);

      await productionApi.tableUpdate('products', {
        ...product,
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString()
      });

      logger.logDatabaseOperation('Product stock updated', {
        product_id: productId,
        old_quantity: product.stock_quantity,
        new_quantity: newQuantity,
        movement_type: movementType
      });

    } catch (error: any) {
      logger.logError('Failed to update product stock', error, { productId, quantity, movementType });
      throw error;
    }
  }

  // Low Stock Alerts
  async getLowStockProducts() {
    try {
      logger.logDatabaseOperation('Fetching low stock products');

      // This would need to be handled with a custom query or view
      // For now, we'll get all products and filter on the frontend
      const result = await productionApi.tablePage('products', {
        PageNo: 1,
        PageSize: 1000, // Get all products for low stock check
        OrderByField: 'name',
        IsAsc: true,
        Filters: [
        { name: 'status', op: 'Equal', value: 'active' }]

      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Filter products where stock_quantity <= min_stock_level
      const lowStockProducts = (result.data?.List || []).filter(
        (product: any) => product.stock_quantity <= product.min_stock_level
      );

      logger.logDatabaseOperation('Low stock products fetched', {
        total_products: result.data?.List?.length || 0,
        low_stock_count: lowStockProducts.length
      });

      return lowStockProducts;

    } catch (error: any) {
      logger.logError('Failed to fetch low stock products', error);
      enhancedToast.showApiErrorToast(error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkUpdateProducts(products: Array<Partial<Product> & {id: number;}>) {
    try {
      logger.logDatabaseOperation('Bulk updating products', { count: products.length });

      const operations = products.map((product) =>
      () => productionApi.tableUpdate('products', product)
      );

      const result = await productionApi.batchOperations(operations, {
        showLoading: true,
        loadingMessage: `Updating ${products.length} products...`
      });

      if (result.error && result.data?.errors?.length === products.length) {
        throw new Error('All bulk updates failed');
      }

      logger.logDatabaseOperation('Bulk product update completed', {
        total: products.length,
        successful: result.data?.results?.length || 0,
        failed: result.data?.errors?.length || 0
      });

      return result.data;

    } catch (error: any) {
      logger.logError('Bulk product update failed', error);
      throw error;
    }
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;