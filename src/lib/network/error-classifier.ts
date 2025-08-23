
import { ConnectionErrorType, NetworkErrorDetails } from '@/types/network';

export class NetworkErrorClassifier {
  static classifyError(error: unknown): NetworkErrorDetails {
    if (error instanceof TypeError) {
      // Network connectivity issues
      const message = error.message.toLowerCase();
      if (message.includes('failed to fetch')) {
        return {
          type: 'network_unavailable',
          message: error.message,
          userMessage: 'Network connection unavailable. Please check your internet connection.',
          isRetryable: true,
          suggestedAction: 'Check your internet connection and try again.'
        };
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('timed out')) {
        return {
          type: 'timeout',
          message: error.message,
          userMessage: 'Connection timed out. The server is taking too long to respond.',
          isRetryable: true,
          suggestedAction: 'Wait a moment and try again.'
        };
      }

      if (message.includes('dns') || message.includes('name resolution')) {
        return {
          type: 'dns_error',
          message: error.message,
          userMessage: 'Cannot reach the server. There may be a DNS issue.',
          isRetryable: true,
          suggestedAction: 'Check your network settings or try again later.'
        };
      }

      if (message.includes('network') || message.includes('connection')) {
        return {
          type: 'network_unavailable',
          message: error.message,
          userMessage: 'Network connection lost. Please check your internet connection.',
          isRetryable: true,
          suggestedAction: 'Verify your internet connection and retry.'
        };
      }
    }

    // Check for HTTP status codes
    if (typeof error === 'object' && error !== null) {
      const status = (error as any).status || (error as any).statusCode;
      
      if (status >= 500 && status < 600) {
        return {
          type: 'server_error',
          message: `Server error: ${status}`,
          userMessage: 'The server is experiencing issues. Please try again later.',
          isRetryable: true,
          suggestedAction: 'The server is temporarily unavailable. Please try again in a few minutes.'
        };
      }

      if (status === 408) {
        return {
          type: 'timeout',
          message: 'Request timeout',
          userMessage: 'Request timed out. The server took too long to respond.',
          isRetryable: true,
          suggestedAction: 'Try again with a stable connection.'
        };
      }
    }

    // Default unknown error
    return {
      type: 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      userMessage: 'Connection issue detected. Please try again.',
      isRetryable: true,
      suggestedAction: 'Check your connection and try again.'
    };
  }

  static getRetryDelay(errorType: ConnectionErrorType, attempt: number): number {
    const baseDelays = {
      network_unavailable: 2000,
      server_error: 5000,
      timeout: 3000,
      dns_error: 10000,
      unknown: 2000
    };

    const baseDelay = baseDelays[errorType] || 2000;
    const maxDelay = 30000; // 30 seconds max
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    
    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    return Math.floor(exponentialDelay + jitter);
  }

  static shouldShowBanner(errorType: ConnectionErrorType, consecutiveFailures: number): boolean {
    // Always show banner for network unavailable after first failure
    if (errorType === 'network_unavailable') return true;
    
    // Show banner for server errors after 2 consecutive failures
    if (errorType === 'server_error') return consecutiveFailures >= 2;
    
    // Show banner for timeouts after 3 consecutive failures
    if (errorType === 'timeout') return consecutiveFailures >= 3;
    
    // Show banner for DNS errors immediately
    if (errorType === 'dns_error') return true;
    
    // Show for unknown errors after 2 failures
    return consecutiveFailures >= 2;
  }
}
