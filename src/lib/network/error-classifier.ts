
export interface ErrorClassification {
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isServerError: boolean;
  isClientError: boolean;
  isRetryable: boolean;
  severity: 'low' | 'medium' | 'high';
  retryDelay: number;
}

export interface ErrorContext {
  timestamp: string;
  userAgent: string;
  url: string;
  connectionType: string;
  onlineStatus: boolean;
  message: string;
  stack?: string;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: any;
  classification: ErrorClassification;
  context: ErrorContext;
  suggestions: string[];
}

export interface RetryStrategy {
  shouldRetry: boolean;
  maxAttempts: number;
  initialDelay: number;
  backoffMultiplier: number;
}

export class NetworkErrorClassifier {
  static classifyError(error: any): ErrorClassification {
    const isNetworkError = this.isNetworkError(error);
    const isTimeoutError = this.isTimeoutError(error);
    const isServerError = this.isServerError(error);
    const isClientError = this.isClientError(error);

    const isRetryable = isNetworkError || isTimeoutError || isServerError;
    const severity = this.determineSeverity(error, isNetworkError, isServerError);
    const retryDelay = this.calculateRetryDelay(error, severity);

    return {
      isNetworkError,
      isTimeoutError,
      isServerError,
      isClientError,
      isRetryable,
      severity,
      retryDelay
    };
  }

  private static isNetworkError(error: any): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    if (error.message) {
      const networkMessages = [
      'network request failed',
      'connection timeout',
      'dns resolution failed',
      'connection reset',
      'connection refused',
      'network is unreachable'];


      return networkMessages.some((msg) =>
      error.message.toLowerCase().includes(msg)
      );
    }

    return false;
  }

  private static isTimeoutError(error: any): boolean {
    if (error.name === 'AbortError') return true;

    const timeoutStatuses = [408, 429, 503, 504];
    if (error.status && timeoutStatuses.includes(error.status)) {
      return true;
    }

    if (error.message) {
      return error.message.toLowerCase().includes('timeout');
    }

    return false;
  }

  private static isServerError(error: any): boolean {
    if (error.status) {
      return error.status >= 500 && error.status < 600;
    }
    return false;
  }

  private static isClientError(error: any): boolean {
    if (error.status) {
      return error.status >= 400 && error.status < 500 &&
      ![408, 429].includes(error.status); // Exclude timeout errors
    }
    return false;
  }

  private static determineSeverity(
  error: any,
  isNetworkError: boolean,
  isServerError: boolean)
  : 'low' | 'medium' | 'high' {
    if (isNetworkError || isServerError) return 'high';
    if (this.isTimeoutError(error)) return 'medium';
    return 'low';
  }

  private static calculateRetryDelay(error: any, severity: string): number {
    const baseDelay = {
      high: 1000,
      medium: 500,
      low: 250
    }[severity] || 1000;

    // Add jitter
    return baseDelay + Math.random() * baseDelay;
  }

  static getErrorContext(error: any): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      onlineStatus: navigator.onLine,
      message: error.message || String(error),
      stack: error.stack
    };
  }

  static getRecoverySuggestions(error: any): string[] {
    const classification = this.classifyError(error);

    if (classification.isNetworkError) {
      return [
      'Check your internet connection',
      'Try refreshing the page',
      'Switch to a different network if available',
      'Contact support if the problem persists'];

    }

    if (classification.isServerError) {
      return [
      'The server is experiencing issues',
      'Please try again in a few minutes',
      'Contact support if the problem continues'];

    }

    if (classification.isClientError) {
      if (error.status === 404) {
        return [
        'The requested resource was not found',
        'Please check the URL and try again',
        'Navigate back to the home page'];

      }

      if (error.status === 401 || error.status === 403) {
        return [
        'You are not authorized to perform this action',
        'Please log in again',
        'Contact an administrator for access'];

      }

      return [
      'There was an issue with your request',
      'Please check your input and try again'];

    }

    if (classification.isTimeoutError) {
      return [
      'The request took too long to complete',
      'Try again with a more stable connection',
      'Reduce the amount of data being sent'];

    }

    return [
    'An unexpected error occurred',
    'Please try again',
    'Contact support if the issue continues'];

  }

  static getErrorFingerprint(error: any): string {
    const message = error.message || String(error);
    const status = error.status || 0;
    const name = error.name || 'Error';

    return `${name}-${status}-${this.hashString(message)}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).slice(0, 8);
  }

  static sanitizeErrorMessage(message: string): string {
    // Remove email addresses
    message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]');

    // Remove phone numbers
    message = message.replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[phone]');

    // Remove IP addresses
    message = message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]');

    // Remove URLs
    message = message.replace(/https?:\/\/[^\s]+/g, '[url]');

    return message;
  }

  static generateErrorReport(error: any): ErrorReport {
    const timestamp = Date.now();
    const id = `error-${timestamp}-${this.hashString(JSON.stringify(error)).slice(0, 8)}`;

    return {
      id,
      timestamp: new Date(timestamp).toISOString(),
      error,
      classification: this.classifyError(error),
      context: this.getErrorContext(error),
      suggestions: this.getRecoverySuggestions(error)
    };
  }

  static getRetryStrategy(error: any): RetryStrategy {
    const classification = this.classifyError(error);

    if (!classification.isRetryable) {
      return {
        shouldRetry: false,
        maxAttempts: 0,
        initialDelay: 0,
        backoffMultiplier: 1
      };
    }

    if (classification.isNetworkError) {
      return {
        shouldRetry: true,
        maxAttempts: 5,
        initialDelay: 1000,
        backoffMultiplier: 2
      };
    }

    if (classification.isTimeoutError) {
      return {
        shouldRetry: true,
        maxAttempts: 3,
        initialDelay: error.status === 429 ? 5000 : 2000, // Rate limiting needs longer delay
        backoffMultiplier: 1.5
      };
    }

    if (classification.isServerError) {
      return {
        shouldRetry: true,
        maxAttempts: 3,
        initialDelay: 1500,
        backoffMultiplier: 2
      };
    }

    return {
      shouldRetry: false,
      maxAttempts: 0,
      initialDelay: 0,
      backoffMultiplier: 1
    };
  }

  static shouldTriggerCircuitBreaker(errors: any[]): boolean {
    if (errors.length < 5) return false;

    const recentErrors = errors.slice(-10); // Last 10 errors
    const networkErrors = recentErrors.filter((error) =>
    this.classifyError(error).isNetworkError
    );

    // If more than 80% of recent errors are network errors, trigger circuit breaker
    return networkErrors.length / recentErrors.length > 0.8;
  }
}