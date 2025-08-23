import { enhancedToast } from '@/utils/enhanced-toast';
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import { normalizeError, isRetryable } from '@/lib/errors';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export interface ApiOptions {
  retry?: boolean;
  retryCount?: number;
  showError?: boolean;
  showLoading?: boolean;
  loadingMessage?: string;
  timeout?: number;
  validateResponse?: (data: any) => boolean;
}

class ProductionApiService {
  private baseUrl: string;
  private defaultTimeout: number = 30000;
  private maxRetries: number = 3;

  constructor() {
    this.baseUrl = window.location.origin;
  }

  // EasySite Authentication APIs
  async register(credentials: {email: string;password: string;name?: string;}): Promise<ApiResponse> {
    try {
      logger.logUserAction('Registration attempt', { email: credentials.email });

      const response = await window.ezsite.apis.register(credentials);

      if (response.error) {
        logger.logError('Registration failed', response.error);
        enhancedToast.showErrorToast('Registration failed', { error: response.error });
        return { error: response.error };
      }

      logger.logUserAction('Registration successful', { email: credentials.email });
      enhancedToast.showSuccessToast('Registration successful! Please check your email to verify your account.');

      return { data: response };
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.logError('Registration error', normalizedError);
      enhancedToast.showErrorToast('Registration failed', { error: normalizedError });
      return { error: normalizedError.message };
    }
  }

  async login(credentials: {email: string;password: string;}): Promise<ApiResponse> {
    try {
      logger.logUserAction('Login attempt', { email: credentials.email });

      const response = await window.ezsite.apis.login(credentials);

      if (response.error) {
        logger.logError('Login failed', response.error);
        enhancedToast.showErrorToast('Login failed', { error: response.error });
        return { error: response.error };
      }

      logger.logUserAction('Login successful', { email: credentials.email });
      enhancedToast.showSuccessToast('Login successful!');

      return { data: response };
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.logError('Login error', normalizedError);
      enhancedToast.showErrorToast('Login failed', { error: normalizedError });
      return { error: normalizedError.message };
    }
  }

  async logout(): Promise<ApiResponse> {
    try {
      logger.logUserAction('Logout attempt');

      const response = await window.ezsite.apis.logout();

      if (response.error) {
        logger.logError('Logout failed', response.error);
        return { error: response.error };
      }

      logger.logUserAction('Logout successful');
      enhancedToast.showInfoToast('You have been logged out.');

      return { data: response };
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.logError('Logout error', normalizedError);
      return { error: normalizedError.message };
    }
  }

  async getUserInfo(): Promise<ApiResponse> {
    try {
      const response = await window.ezsite.apis.getUserInfo();

      if (response.error) {
        logger.logError('Get user info failed', response.error);
        return { error: response.error };
      }

      return { data: response.data };
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.logError('Get user info error', normalizedError);
      return { error: normalizedError.message };
    }
  }

  // EasySite Database Operations
  async tablePage(tableId: string, params: any, options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Loading data...') : null;

    try {
      logger.logDatabaseOperation('Table page query', { tableId, params });

      const response = await window.ezsite.apis.tablePage(tableId, params);

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('Table page query failed', response.error, { tableId, params });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Failed to load data', { error: response.error });
        }
        return { error: response.error };
      }

      // Validate response if validator provided
      if (options.validateResponse && !options.validateResponse(response.data)) {
        const error = 'Invalid response format';
        logger.logError('Table page validation failed', error, { tableId, response: response.data });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Data validation failed');
        }
        return { error };
      }

      logger.logDatabaseOperation('Table page query successful', {
        tableId,
        count: response.data?.VirtualCount || 0
      });

      return { data: response.data };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Table page query error', normalizedError, { tableId, params });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  async tableCreate(tableId: string, data: any, options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Creating record...') : null;

    try {
      logger.logDatabaseOperation('Table create', { tableId, data });

      const response = await window.ezsite.apis.tableCreate(tableId, data);

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('Table create failed', response.error, { tableId, data });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Failed to create record', { error: response.error });
        }
        return { error: response.error };
      }

      logger.logDatabaseOperation('Table create successful', { tableId });

      if (options.showError !== false) {
        enhancedToast.showSuccessToast('Record created successfully');
      }

      return { data: response };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Table create error', normalizedError, { tableId, data });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  async tableUpdate(tableId: string, data: any, options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Updating record...') : null;

    try {
      logger.logDatabaseOperation('Table update', { tableId, id: data.id });

      const response = await window.ezsite.apis.tableUpdate(tableId, data);

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('Table update failed', response.error, { tableId, data });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Failed to update record', { error: response.error });
        }
        return { error: response.error };
      }

      logger.logDatabaseOperation('Table update successful', { tableId, id: data.id });

      if (options.showError !== false) {
        enhancedToast.showSuccessToast('Record updated successfully');
      }

      return { data: response };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Table update error', normalizedError, { tableId, data });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  async tableDelete(tableId: string, params: any, options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Deleting record...') : null;

    try {
      logger.logDatabaseOperation('Table delete', { tableId, params });

      const response = await window.ezsite.apis.tableDelete(tableId, params);

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('Table delete failed', response.error, { tableId, params });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Failed to delete record', { error: response.error });
        }
        return { error: response.error };
      }

      logger.logDatabaseOperation('Table delete successful', { tableId, params });

      if (options.showError !== false) {
        enhancedToast.showSuccessToast('Record deleted successfully');
      }

      return { data: response };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Table delete error', normalizedError, { tableId, params });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  // File Upload
  async uploadFile(file: File, options: ApiOptions = {}): Promise<ApiResponse<number>> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Uploading file...') : null;

    try {
      logger.logUserAction('File upload started', {
        filename: file.name,
        size: file.size,
        type: file.type
      });

      const response = await window.ezsite.apis.upload({
        filename: file.name,
        file: file
      });

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('File upload failed', response.error, { filename: file.name });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('File upload failed', { error: response.error });
        }
        return { error: response.error };
      }

      logger.logUserAction('File upload successful', {
        filename: file.name,
        fileId: response.data
      });

      if (options.showError !== false) {
        enhancedToast.showSuccessToast('File uploaded successfully');
      }

      return { data: response.data };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('File upload error', normalizedError, { filename: file.name });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  async getUploadUrl(fileId: number): Promise<ApiResponse<string>> {
    try {
      const response = await window.ezsite.apis.getUploadUrl(fileId);

      if (response.error) {
        logger.logError('Get upload URL failed', response.error, { fileId });
        return { error: response.error };
      }

      return { data: response.data };
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.logError('Get upload URL error', normalizedError, { fileId });
      return { error: normalizedError.message };
    }
  }

  // Node.js Function Execution
  async runFunction(path: string, params: any[] = [], options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Processing...') : null;

    try {
      logger.logApiCall('Node function execution', { path, params });

      const response = await window.ezsite.apis.run({
        path,
        param: params
      });

      loadingToast?.dismiss();

      if (response.error) {
        logger.logError('Node function failed', response.error, { path, params });
        if (options.showError !== false) {
          enhancedToast.showErrorToast('Operation failed', { error: response.error });
        }
        return { error: response.error };
      }

      logger.logApiCall('Node function successful', { path });

      return { data: response.data };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Node function error', normalizedError, { path, params });

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }

  // Batch operations with transaction-like behavior
  async batchOperations(operations: Array<() => Promise<ApiResponse>>, options: ApiOptions = {}): Promise<ApiResponse> {
    const loadingToast = options.showLoading ?
    enhancedToast.showLoadingToast(options.loadingMessage || 'Processing batch operations...') : null;

    try {
      logger.logDatabaseOperation('Batch operations started', { count: operations.length });

      const results = [];
      const errors = [];

      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]();
          if (result.error) {
            errors.push({ index: i, error: result.error });
          } else {
            results.push({ index: i, data: result.data });
          }
        } catch (error) {
          const normalizedError = normalizeError(error);
          errors.push({ index: i, error: normalizedError.message });
        }
      }

      loadingToast?.dismiss();

      if (errors.length > 0) {
        logger.logError('Batch operations had errors', errors);

        if (options.showError !== false) {
          enhancedToast.showWarningToast(
            `${errors.length} of ${operations.length} operations failed`,
            {
              description: 'Some operations could not be completed',
              persistent: true
            }
          );
        }

        return {
          data: { results, errors },
          error: `${errors.length} operations failed`
        };
      }

      logger.logDatabaseOperation('Batch operations completed successfully', {
        count: operations.length
      });

      if (options.showError !== false) {
        enhancedToast.showSuccessToast(`${operations.length} operations completed successfully`);
      }

      return { data: { results } };
    } catch (error) {
      loadingToast?.dismiss();
      const normalizedError = normalizeError(error);
      logger.logError('Batch operations error', normalizedError);

      if (options.showError !== false) {
        enhancedToast.showApiErrorToast(normalizedError);
      }

      return { error: normalizedError.message };
    }
  }
}

// Create singleton instance
export const productionApi = new ProductionApiService();

// Export as default for backward compatibility
export default productionApi;