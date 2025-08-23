import { productionApi } from './production-api';

// Re-export the production API as default
export default productionApi;

// Also export specific methods for backward compatibility
export const {
  register,
  login,
  logout,
  getUserInfo,
  tablePage,
  tableCreate,
  tableUpdate,
  tableDelete,
  uploadFile,
  getUploadUrl,
  runFunction,
  batchOperations
} = productionApi;

// Legacy API compatibility layer
export const legacyApi = {
  async getProducts(params = {}) {
    const result = await productionApi.tablePage('products', {
      PageNo: 1,
      PageSize: 50,
      OrderByField: 'name',
      IsAsc: true,
      Filters: [],
      ...params
    }, { showLoading: true });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data?.List || [];
  },

  async saveProduct(product: any) {
    let result;
    if (product.id) {
      result = await productionApi.tableUpdate('products', product, { showLoading: true });
    } else {
      result = await productionApi.tableCreate('products', product, { showLoading: true });
    }

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  },

  async deleteProduct(id: number) {
    const result = await productionApi.tableDelete('products', { id }, { showLoading: true });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  },

  async uploadFile(file: File) {
    const result = await productionApi.uploadFile(file, { showLoading: true });

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  },

  async getFileUrl(fileId: number) {
    const result = await productionApi.getUploadUrl(fileId);

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  },

  // Authentication wrapper methods
  async login(credentials: {email: string;password: string;}) {
    const result = await productionApi.login(credentials);

    if (result.error) {
      throw new Error(result.error);
    }

    return { success: true };
  },

  async register(userData: {name: string;email: string;password: string;role?: string;}) {
    const result = await productionApi.register(userData);

    if (result.error) {
      throw new Error(result.error);
    }

    return { success: true };
  },

  async logout() {
    const result = await productionApi.logout();

    if (result.error) {
      throw new Error(result.error);
    }

    return { success: true };
  },

  async getUserInfo() {
    const result = await productionApi.getUserInfo();

    if (result.error) {
      throw new Error(result.error);
    }

    return result.data;
  }
};