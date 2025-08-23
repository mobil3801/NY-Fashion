
import { centralizedErrorService, NetworkErrorType } from './centralized-error-service';
import { logger } from '@/utils/production-logger';

interface NetworkRequestConfig {
  url: string;
  method: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface NetworkResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Headers;
}

interface NetworkError extends Error {
  config?: NetworkRequestConfig;
  response?: {
    status: number;
    statusText: string;
    data?: any;
  };
  isNetworkError?: boolean;
  isTimeout?: boolean;
}

class EnhancedNetworkErrorHandler {
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultRetries = 3;
  private readonly defaultRetryDelay = 1000; // 1 second

  async makeRequest(config: NetworkRequestConfig): Promise<NetworkResponse> {
    const { url, method, timeout = this.defaultTimeout, retries = this.defaultRetries } = config;
    let lastError: NetworkError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const startTime = performance.now();
      const isRetry = attempt > 0;

      try {
        logger.logInfo(`Network request attempt ${attempt + 1}/${retries + 1}`, {
          url,
          method,
          timeout,
          isRetry
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...this.getDefaultHeaders()
          }
        });

        clearTimeout(timeoutId);
        const responseTime = performance.now() - startTime;

        // Log successful request
        logger.logPerformance('api', `${method} ${url}`, responseTime, true, {
          status: response.status,
          attempt: attempt + 1,
          isRetry
        });

        if (!response.ok) {
          throw this.createHttpError(response, config, responseTime);
        }

        const data = await response.json();

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        };

      } catch (error) {
        const responseTime = performance.now() - startTime;
        lastError = this.enhanceError(error as Error, config, responseTime, attempt);

        // Log the error
        const errorId = centralizedErrorService.logNetworkError(
          url,
          method,
          this.determineNetworkErrorType(lastError),
          lastError.message,
          lastError.response?.status,
          attempt,
          responseTime
        );

        logger.logError(
          `Network request failed (attempt ${attempt + 1}/${retries + 1})`,
          lastError,
          { errorId, url, method, attempt, responseTime }
        );

        // Don't retry on certain error types
        if (!this.shouldRetry(lastError, attempt, retries)) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = this.calculateRetryDelay(attempt, config.retryDelay);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed, throw the last error
    if (lastError) {
      throw lastError;
    }

    throw new Error('Network request failed with unknown error');
  }

  private createHttpError(response: Response, config: NetworkRequestConfig, responseTime: number): NetworkError {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as NetworkError;
    error.name = 'HttpError';
    error.config = config;
    error.response = {
      status: response.status,
      statusText: response.statusText
    };
    error.isNetworkError = true;
    return error;
  }

  private enhanceError(error: Error, config: NetworkRequestConfig, responseTime: number, attempt: number): NetworkError {
    const networkError = error as NetworkError;
    networkError.config = config;
    networkError.isNetworkError = true;

    // Categorize the error
    if (error.name === 'AbortError') {
      networkError.isTimeout = true;
      networkError.message = `Request timeout after ${config.timeout}ms`;
    } else if (error.message.includes('Failed to fetch')) {
      networkError.message = 'Network connection failed - please check your internet connection';
    } else if (error.message.includes('DNS')) {
      networkError.message = 'DNS resolution failed - unable to reach server';
    }

    return networkError;
  }

  private determineNetworkErrorType(error: NetworkError): NetworkErrorType {
    if (error.isTimeout) {
      return NetworkErrorType.TIMEOUT;
    }

    if (error.response?.status) {
      const status = error.response.status;
      if (status >= 500) return NetworkErrorType.SERVER_ERROR;
      if (status >= 400) return NetworkErrorType.CLIENT_ERROR;
    }

    if (error.message.includes('DNS') || error.message.includes('resolve')) {
      return NetworkErrorType.DNS_ERROR;
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return NetworkErrorType.CONNECTION_ERROR;
    }

    return NetworkErrorType.NETWORK_ERROR;
  }

  private shouldRetry(error: NetworkError, attempt: number, maxRetries: number): boolean {
    // Don't retry if we've reached max attempts
    if (attempt >= maxRetries) return false;

    // Don't retry on certain HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      // Don't retry on 4xx client errors (except 429 Too Many Requests and 408 Timeout)
      if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
        return false;
      }
    }

    // Don't retry on certain error types
    if (error.name === 'SyntaxError') {// JSON parse errors
      return false;
    }

    return true;
  }

  private calculateRetryDelay(attempt: number, baseDelay = this.defaultRetryDelay): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
    return Math.min(exponentialDelay + jitter, 10000); // Max 10 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getDefaultHeaders(): Record<string, string> {
    return {
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      'User-Agent': navigator.userAgent
    };
  }

  // Convenience methods for common HTTP methods
  async get(url: string, config?: Partial<NetworkRequestConfig>): Promise<NetworkResponse> {
    return this.makeRequest({ url, method: 'GET', ...config });
  }

  async post(url: string, data?: any, config?: Partial<NetworkRequestConfig>): Promise<NetworkResponse> {
    // For POST requests, we'd typically include the data in the request body
    return this.makeRequest({ url, method: 'POST', ...config });
  }

  async put(url: string, data?: any, config?: Partial<NetworkRequestConfig>): Promise<NetworkResponse> {
    return this.makeRequest({ url, method: 'PUT', ...config });
  }

  async delete(url: string, config?: Partial<NetworkRequestConfig>): Promise<NetworkResponse> {
    return this.makeRequest({ url, method: 'DELETE', ...config });
  }

  // Method to get network error statistics
  async getNetworkErrorStatistics(timeRange: number = 24): Promise<any> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeRange * 60 * 60 * 1000);

      const { data, error } = await window.ezsite.apis.tablePage(37299, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: [
        {
          name: 'timestamp',
          op: 'GreaterThanOrEqual',
          value: startTime.toISOString()
        }]

      });

      if (error) throw new Error(error);

      const networkErrors = data?.List || [];

      // Analyze error patterns
      const errorsByType = networkErrors.reduce((acc: any, err: any) => {
        acc[err.error_type] = (acc[err.error_type] || 0) + 1;
        return acc;
      }, {});

      const errorsByUrl = networkErrors.reduce((acc: any, err: any) => {
        const url = new URL(err.request_url).pathname;
        acc[url] = (acc[url] || 0) + 1;
        return acc;
      }, {});

      const avgRetryCount = networkErrors.length > 0 ?
      networkErrors.reduce((sum: number, err: any) => sum + err.retry_count, 0) / networkErrors.length :
      0;

      return {
        totalNetworkErrors: networkErrors.length,
        errorsByType,
        errorsByUrl,
        avgRetryCount: avgRetryCount.toFixed(2),
        mostProblematicEndpoints: Object.entries(errorsByUrl).
        sort(([, a], [, b]) => (b as number) - (a as number)).
        slice(0, 5),
        timeRange: `${timeRange} hours`
      };
    } catch (error) {
      logger.logError('Failed to get network error statistics', error);
      return null;
    }
  }
}

// Export singleton instance
export const enhancedNetworkErrorHandler = new EnhancedNetworkErrorHandler();
export default enhancedNetworkErrorHandler;