
/**
 * Enhanced API Error Classification System
 * Provides strict TypeScript interfaces and error classification for retry logic
 */

export interface BaseApiError {
  message: string;
  timestamp: number;
  operation?: string;
}

export interface NetworkError extends BaseApiError {
  type: 'network';
  code?: string;
  cause?: Error;
}

export interface HttpError extends BaseApiError {
  type: 'http';
  statusCode: number;
  statusText: string;
  responseBody?: string;
}

export interface BusinessError extends BaseApiError {
  type: 'business';
  code?: string;
  context?: Record<string, unknown>;
}

export interface TimeoutError extends BaseApiError {
  type: 'timeout';
  timeoutMs: number;
}

export interface AbortError extends BaseApiError {
  type: 'abort';
  reason?: string;
}

export type ApiErrorType = NetworkError | HttpError | BusinessError | TimeoutError | AbortError;

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ERROR_CODES = {
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  TIMEOUT: 'TIMEOUT',
  CLIENT_ERROR: 'CLIENT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  QUEUED_OFFLINE: 'QUEUED_OFFLINE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Error classification patterns for non-retryable business errors
 */
const NON_RETRYABLE_PATTERNS = [
/reminder:\s*please\s+retry\s+it\s+or\s+send\s+email\s+to\s+support\s+for\s+help/i,
/validation\s+error/i,
/authentication\s+failed/i,
/authorization\s+denied/i,
/access\s+denied/i,
/forbidden/i,
/not\s+found/i,
/bad\s+request/i,
/invalid\s+request/i,
/malformed\s+request/i];


/**
 * HTTP status codes that are retryable
 */
const RETRYABLE_HTTP_CODES = new Set([
408, // Request Timeout
429, // Too Many Requests
500, // Internal Server Error
502, // Bad Gateway
503, // Service Unavailable
504, // Gateway Timeout
507, // Insufficient Storage
508, // Loop Detected
510, // Not Extended
511 // Network Authentication Required
]);

/**
 * Network error codes that are retryable
 */
const RETRYABLE_NETWORK_CODES = new Set([
'ECONNRESET',
'ECONNREFUSED',
'ENOTFOUND',
'ETIMEDOUT',
'EHOSTUNREACH',
'ENETUNREACH',
'EAI_AGAIN']
);

/**
 * Normalizes any error to a typed ApiError
 */
export function normalizeError(error: unknown, operation?: string): ApiError {
  const timestamp = Date.now();
  const baseError = { timestamp, operation };

  // Handle already normalized errors
  if (isApiError(error)) {
    return { ...error, operation: operation || error.operation };
  }

  // Handle AbortError
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      ...baseError,
      type: 'abort',
      message: 'Request was aborted',
      reason: error.message
    };
  }

  // Handle TypeError (usually network errors)
  if (error instanceof TypeError) {
    return {
      ...baseError,
      type: 'network',
      message: error.message || 'Network error occurred',
      cause: error
    };
  }

  // Handle Response-like objects (fetch errors)
  if (error && typeof error === 'object' && 'status' in error) {
    const response = error as any;
    return {
      ...baseError,
      type: 'http',
      message: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`,
      statusCode: response.status,
      statusText: response.statusText || '',
      responseBody: response.body || ''
    };
  }

  // Handle timeout errors
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return {
      ...baseError,
      type: 'timeout',
      message: error.message,
      timeoutMs: 0 // Unknown timeout value
    };
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    const message = error.message;

    // Check if it's a business error based on message patterns
    const isBusinessError = NON_RETRYABLE_PATTERNS.some((pattern) =>
    pattern.test(message)
    );

    if (isBusinessError) {
      return {
        ...baseError,
        type: 'business',
        message
      };
    }

    // Default to network error for generic Error objects
    return {
      ...baseError,
      type: 'network',
      message,
      cause: error
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    const isBusinessError = NON_RETRYABLE_PATTERNS.some((pattern) =>
    pattern.test(error)
    );

    if (isBusinessError) {
      return {
        ...baseError,
        type: 'business',
        message: error
      };
    }

    return {
      ...baseError,
      type: 'network',
      message: error
    };
  }

  // Fallback for unknown error types
  return {
    ...baseError,
    type: 'network',
    message: 'Unknown error occurred',
    context: { originalError: error }
  };
}

/**
 * Type guard to check if an object is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'type' in error &&
    'message' in error &&
    'timestamp' in error);

}

/**
 * Determines if an error is retryable based on its type and content
 */
export function isRetryable(error: unknown): boolean {
  const normalizedError = normalizeError(error);

  switch (normalizedError.type) {
    case 'abort':
      return false; // Never retry aborted requests

    case 'business':
      return false; // Business logic errors should not be retried

    case 'network':
      // Check for specific network error codes
      if (normalizedError.code && RETRYABLE_NETWORK_CODES.has(normalizedError.code)) {
        return true;
      }
      // Generic network errors are usually retryable
      return true;

    case 'timeout':
      return true; // Timeouts are retryable

    case 'http':
      return RETRYABLE_HTTP_CODES.has(normalizedError.statusCode);

    default:
      return false;
  }
}

/**
 * Gets a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const normalizedError = normalizeError(error);

  switch (normalizedError.type) {
    case 'abort':
      return 'Request was cancelled';

    case 'business':
      // Clean up business error messages
      return normalizedError.message.
      replace(/reminder:\s*please\s+retry\s+it\s+or\s+send\s+email\s+to\s+support\s+for\s+help\.?/i,
      'Operation completed with warnings').
      trim();

    case 'network':
      return 'Network connection issue. Please check your internet connection.';

    case 'timeout':
      return 'Request timed out. Please try again.';

    case 'http':
      if (normalizedError.statusCode >= 400 && normalizedError.statusCode < 500) {
        return `Request failed: ${normalizedError.statusText || 'Client error'}`;
      }
      if (normalizedError.statusCode >= 500) {
        return 'Server temporarily unavailable. Please try again.';
      }
      return normalizedError.message;

    default:
      return 'An unexpected error occurred';
  }
}

/**
 * Enhanced logging helper for API events
 */
export interface ApiEventLog {
  operation: string;
  attempt: number;
  statusCode?: number;
  retryable: boolean;
  message: string;
  error?: ApiError;
}

export function logApiEvent(event: ApiEventLog): void {
  const { operation, attempt, statusCode, retryable, message, error } = event;

  const logLevel = error?.type === 'business' || !retryable ? 'warn' : 'info';
  const prefix = `[API:${operation}] Attempt ${attempt}`;
  const status = statusCode ? ` (${statusCode})` : '';
  const retryInfo = retryable ? ' [RETRYABLE]' : ' [FINAL]';

  console[logLevel](`${prefix}${status}: ${message}${retryInfo}`, {
    error: error ? {
      type: error.type,
      message: error.message,
      ...(error.type === 'http' && { statusCode: (error as HttpError).statusCode })
    } : undefined
  });
}

/**
 * Enhanced network diagnostics for error reports
 */
interface NetworkDiagnostics {
  isOnline: boolean;
  connectionType?: string;
  downlink?: number;
  rtt?: number;
  dnsResolution?: {
    success: boolean;
    time: number;
  };
  pingTest?: {
    success: boolean;
    latency: number;
  };
}

/**
 * Perform DNS resolution test
 */
async function testDnsResolution(): Promise<{success: boolean;time: number;}> {
  const startTime = performance.now();
  try {
    // Use a simple image request to test DNS resolution
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = `https://www.google.com/favicon.ico?${Date.now()}`;

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('DNS timeout')), 5000);
    });

    return {
      success: true,
      time: performance.now() - startTime
    };
  } catch {
    return {
      success: false,
      time: performance.now() - startTime
    };
  }
}

/**
 * Perform ping test to measure latency
 */
async function testPing(): Promise<{success: boolean;latency: number;}> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${window.location.origin}/favicon.ico`, {
      method: 'HEAD',
      cache: 'no-cache'
    });

    return {
      success: response.ok,
      latency: performance.now() - startTime
    };
  } catch {
    return {
      success: false,
      latency: performance.now() - startTime
    };
  }
}

/**
 * Gather comprehensive network diagnostics
 */
async function gatherNetworkDiagnostics(): Promise<NetworkDiagnostics> {
  const connection = (navigator as any).connection;

  const diagnostics: NetworkDiagnostics = {
    isOnline: navigator.onLine,
    connectionType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt
  };

  // Run diagnostic tests
  try {
    const [dnsTest, pingTest] = await Promise.allSettled([
    testDnsResolution(),
    testPing()]
    );

    if (dnsTest.status === 'fulfilled') {
      diagnostics.dnsResolution = dnsTest.value;
    }

    if (pingTest.status === 'fulfilled') {
      diagnostics.pingTest = pingTest.value;
    }
  } catch (error) {
    console.warn('Failed to gather network diagnostics:', error);
  }

  return diagnostics;
}

/**
 * Browser compatibility check
 */
function getBrowserCompatibility(): Record<string, boolean> {
  return {
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    websocket: typeof WebSocket !== 'undefined',
    localStorage: (() => {
      try {
        return typeof localStorage !== 'undefined' && localStorage !== null;
      } catch {
        return false;
      }
    })(),
    serviceWorker: 'serviceWorker' in navigator,
    navigator: typeof navigator !== 'undefined',
    connection: typeof (navigator as any).connection !== 'undefined'
  };
}

/**
 * Creates a detailed error report for debugging with enhanced diagnostics
 */
export function createErrorReport(error: unknown, context: Record<string, unknown> = {}): Record<string, unknown> {
  const normalizedError = normalizeError(error);

  const report = {
    ...normalizedError,
    context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
    retryable: isRetryable(error),
    userFriendlyMessage: getUserFriendlyMessage(error),

    // Enhanced diagnostics
    viewport: typeof window !== 'undefined' ? {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    } : null,

    browserCompatibility: getBrowserCompatibility(),

    memory: (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
    } : null,

    timing: typeof performance !== 'undefined' ? {
      navigationStart: performance.timeOrigin,
      now: performance.now()
    } : null
  };

  return report;
}

/**
 * Creates an enhanced error report with network diagnostics (async)
 */
export async function createEnhancedErrorReport(
error: unknown,
context: Record<string, unknown> = {})
: Promise<Record<string, unknown>> {
  const baseReport = createErrorReport(error, context);

  try {
    const networkDiagnostics = await gatherNetworkDiagnostics();
    return {
      ...baseReport,
      networkDiagnostics
    };
  } catch (diagnosticError) {
    return {
      ...baseReport,
      diagnosticError: String(diagnosticError)
    };
  }
}