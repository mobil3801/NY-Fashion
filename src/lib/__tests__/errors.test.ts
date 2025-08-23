
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiError,
  ERROR_CODES,
  normalizeError,
  isApiError,
  isRetryable,
  getUserFriendlyMessage,
  logApiEvent,
  createErrorReport,
  createEnhancedErrorReport,
} from '../errors';

// Mock console methods
const mockConsoleInfo = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock window and navigator
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com/test',
  },
  writable: true,
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Test Browser',
  },
  writable: true,
});

Object.defineProperty(window, 'innerWidth', {
  value: 1920,
  writable: true,
});

Object.defineProperty(window, 'innerHeight', {
  value: 1080,
  writable: true,
});

Object.defineProperty(window, 'devicePixelRatio', {
  value: 2,
  writable: true,
});

Object.defineProperty(window, 'performance', {
  value: {
    timeOrigin: 1000,
    now: () => 2000,
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
  writable: true,
});

describe('ApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create ApiError with default values', () => {
    const error = new ApiError('Test error');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.retryable).toBe(false);
    expect(error.timestamp).toBeTypeOf('number');
    expect(error.type).toBe('unknown');
  });

  it('should create ApiError with custom values', () => {
    const details = { statusCode: 500, extra: 'data' };
    const error = new ApiError('Server error', 'SERVER_ERROR', true, details);
    
    expect(error.message).toBe('Server error');
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual(details);
    expect(error.type).toBe('http');
  });

  it('should determine correct error types', () => {
    expect(new ApiError('Network error', 'NETWORK_OFFLINE').type).toBe('network');
    expect(new ApiError('Timeout error', 'TIMEOUT').type).toBe('timeout');
    expect(new ApiError('Abort error', 'ABORT').type).toBe('abort');
    expect(new ApiError('Client error', 'CLIENT_ERROR').type).toBe('http');
    expect(new ApiError('Server error', 'SERVER_ERROR').type).toBe('http');
    expect(new ApiError('Validation error', 'VALIDATION_ERROR').type).toBe('business');
    expect(new ApiError('Permission error', 'PERMISSION_DENIED').type).toBe('business');
  });
});

describe('normalizeError', () => {
  it('should pass through existing ApiError', () => {
    const originalError = new ApiError('Original error', 'CUSTOM_CODE', true, { data: 'test' });
    const normalized = normalizeError(originalError, 'test-operation');
    
    expect(normalized).toBeInstanceOf(ApiError);
    expect(normalized.message).toBe('Original error');
    expect(normalized.code).toBe('CUSTOM_CODE');
    expect(normalized.retryable).toBe(true);
    expect(normalized.details.operation).toBe('test-operation');
  });

  it('should normalize AbortError', () => {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    
    const normalized = normalizeError(abortError);
    
    expect(normalized.code).toBe('ABORT');
    expect(normalized.retryable).toBe(false);
    expect(normalized.message).toBe('Request was cancelled');
  });

  it('should normalize TypeError as network error', () => {
    const typeError = new TypeError('Failed to fetch');
    
    const normalized = normalizeError(typeError);
    
    expect(normalized.code).toBe('NETWORK_OFFLINE');
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).toBe('Network connection issue');
  });

  it('should normalize network-related errors', () => {
    const networkErrors = [
      new Error('ERR_NETWORK'),
      new Error('NetworkError occurred'),
      new Error('Failed to fetch data'),
    ];
    
    networkErrors.forEach(error => {
      const normalized = normalizeError(error);
      expect(normalized.code).toBe('NETWORK_OFFLINE');
      expect(normalized.retryable).toBe(true);
    });
  });

  it('should normalize HTTP response objects', () => {
    const responses = [
      { status: 400, statusText: 'Bad Request' },
      { status: 404, statusText: 'Not Found' },
      { status: 500, statusText: 'Internal Server Error' },
      { status: 502, statusText: 'Bad Gateway' },
    ];
    
    responses.forEach(response => {
      const normalized = normalizeError(response);
      
      if (response.status >= 400 && response.status < 500) {
        expect(normalized.code).toBe('CLIENT_ERROR');
        expect(normalized.retryable).toBe(response.status === 408 || response.status === 429);
      } else {
        expect(normalized.code).toBe('SERVER_ERROR');
        expect(normalized.retryable).toBe(true);
      }
    });
  });

  it('should normalize timeout errors', () => {
    const timeoutError = new Error('Request timeout occurred');
    
    const normalized = normalizeError(timeoutError);
    
    expect(normalized.code).toBe('TIMEOUT');
    expect(normalized.retryable).toBe(true);
  });

  it('should classify business errors from message patterns', () => {
    const businessErrors = [
      'Validation error: invalid input',
      'Authentication failed',
      'Access denied to resource',
      'reminder: please retry it or send email to support for help',
    ];
    
    businessErrors.forEach(errorMessage => {
      const normalized = normalizeError(new Error(errorMessage));
      expect(normalized.code).toBe('VALIDATION_ERROR');
      expect(normalized.retryable).toBe(false);
    });
  });

  it('should handle string errors', () => {
    const stringError = 'Something went wrong';
    const normalized = normalizeError(stringError);
    
    expect(normalized.message).toBe(stringError);
    expect(normalized.code).toBe('NETWORK_OFFLINE');
    expect(normalized.retryable).toBe(true);
  });

  it('should handle business string errors', () => {
    const businessStringError = 'Validation error: field required';
    const normalized = normalizeError(businessStringError);
    
    expect(normalized.code).toBe('VALIDATION_ERROR');
    expect(normalized.retryable).toBe(false);
  });

  it('should handle unknown error types', () => {
    const unknownError = { weird: 'object' };
    const normalized = normalizeError(unknownError);
    
    expect(normalized.message).toBe('An unexpected error occurred');
    expect(normalized.code).toBe('UNKNOWN_ERROR');
    expect(normalized.retryable).toBe(false);
    expect(normalized.details.originalError).toBe(unknownError);
  });
});

describe('isApiError', () => {
  it('should identify ApiError instances', () => {
    const apiError = new ApiError('Test error');
    const regularError = new Error('Regular error');
    const notError = { message: 'Not an error' };
    
    expect(isApiError(apiError)).toBe(true);
    expect(isApiError(regularError)).toBe(false);
    expect(isApiError(notError)).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe('isRetryable', () => {
  it('should determine retryability correctly', () => {
    expect(isRetryable(new ApiError('Error', 'SERVER_ERROR', true))).toBe(true);
    expect(isRetryable(new ApiError('Error', 'CLIENT_ERROR', false))).toBe(false);
    expect(isRetryable(new TypeError('Network error'))).toBe(true);
    expect(isRetryable(new Error('Validation error'))).toBe(false);
  });
});

describe('getUserFriendlyMessage', () => {
  it('should return friendly messages for different error types', () => {
    const testCases = [
      {
        error: new ApiError('Cancelled', 'ABORT'),
        expected: 'Request was cancelled',
      },
      {
        error: new ApiError('Validation failed', 'VALIDATION_ERROR'),
        expected: 'Validation failed',
      },
      {
        error: new ApiError('Connection lost', 'NETWORK_OFFLINE'),
        expected: 'Connection lost. Please check your internet connection.',
      },
      {
        error: new ApiError('Saved offline', 'QUEUED_OFFLINE'),
        expected: 'Saved offline. Will sync automatically when connection returns.',
      },
      {
        error: new ApiError('Timeout', 'TIMEOUT'),
        expected: 'Request timed out. Please try again or check your connection.',
      },
      {
        error: new ApiError('Forbidden', 'CLIENT_ERROR', false, { statusCode: 403 }),
        expected: "You don't have permission to perform this action.",
      },
      {
        error: new ApiError('Not Found', 'CLIENT_ERROR', false, { statusCode: 404 }),
        expected: 'The requested item could not be found.',
      },
      {
        error: new ApiError('Validation', 'CLIENT_ERROR', false, { statusCode: 422 }),
        expected: 'Please check your input and ensure all required fields are filled.',
      },
      {
        error: new ApiError('Server Error', 'SERVER_ERROR'),
        expected: 'Server temporarily unavailable. Your changes are saved and will sync automatically.',
      },
    ];
    
    testCases.forEach(({ error, expected }) => {
      expect(getUserFriendlyMessage(error)).toBe(expected);
    });
  });

  it('should clean up business error messages', () => {
    const businessError = new ApiError(
      'Operation failed. reminder: please retry it or send email to support for help',
      'VALIDATION_ERROR'
    );
    
    const message = getUserFriendlyMessage(businessError);
    expect(message).toBe('Operation completed with warnings');
  });

  it('should handle unknown errors', () => {
    const unknownError = { weird: 'error' };
    const message = getUserFriendlyMessage(unknownError);
    expect(message).toBe('An unexpected error occurred');
  });
});

describe('logApiEvent', () => {
  beforeEach(() => {
    // Mock console methods
    console.info = mockConsoleInfo;
    console.warn = mockConsoleWarn;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  it('should log info for retryable errors', () => {
    const error = new ApiError('Server error', 'SERVER_ERROR', true);
    
    logApiEvent({
      operation: 'test-op',
      attempt: 1,
      statusCode: 500,
      retryable: true,
      message: 'Request failed',
      error,
    });
    
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      '[API:test-op] Attempt 1 (500): Request failed [RETRYABLE]',
      expect.objectContaining({
        error: expect.objectContaining({
          type: 'http',
          code: 'SERVER_ERROR',
          retryable: true,
        }),
      })
    );
  });

  it('should log warn for non-retryable errors', () => {
    const error = new ApiError('Validation error', 'VALIDATION_ERROR', false);
    
    logApiEvent({
      operation: 'test-op',
      attempt: 3,
      retryable: false,
      message: 'Validation failed',
      error,
    });
    
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      '[API:test-op] Attempt 3: Validation failed [FINAL]',
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          retryable: false,
        }),
      })
    );
  });

  it('should handle events without errors', () => {
    logApiEvent({
      operation: 'test-op',
      attempt: 1,
      retryable: false,
      message: 'Success',
    });
    
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      '[API:test-op] Attempt 1: Success [FINAL]',
      { error: undefined }
    );
  });
});

describe('createErrorReport', () => {
  it('should create comprehensive error report', () => {
    const error = new ApiError('Test error', 'TEST_CODE', true, { extra: 'data' });
    const context = { operation: 'test', userId: '123' };
    
    const report = createErrorReport(error, context);
    
    expect(report).toMatchObject({
      message: 'Test error',
      code: 'TEST_CODE',
      retryable: true,
      context,
      userAgent: 'Test Browser',
      url: 'https://example.com/test',
      userFriendlyMessage: expect.any(String),
      viewport: {
        width: 1920,
        height: 1080,
        devicePixelRatio: 2,
      },
      browserCompatibility: expect.objectContaining({
        fetch: true,
        promise: true,
        localStorage: expect.any(Boolean),
      }),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000,
      },
      timing: {
        navigationStart: 1000,
        now: 2000,
      },
    });
  });

  it('should handle missing global objects gracefully', () => {
    // Temporarily remove window
    const originalWindow = global.window;
    delete (global as any).window;
    
    const error = new Error('Test error');
    const report = createErrorReport(error);
    
    expect(report.userAgent).toBe('Unknown');
    expect(report.url).toBe('Unknown');
    expect(report.viewport).toBe(null);
    
    // Restore window
    (global as any).window = originalWindow;
  });

  it('should handle missing performance API', () => {
    const originalPerformance = window.performance;
    delete (window as any).performance;
    
    const error = new Error('Test error');
    const report = createErrorReport(error);
    
    expect(report.timing).toBe(null);
    expect(report.memory).toBe(null);
    
    // Restore performance
    (window as any).performance = originalPerformance;
  });
});

describe('createEnhancedErrorReport', () => {
  it('should create enhanced report with network diagnostics', async () => {
    const error = new ApiError('Network error', 'NETWORK_OFFLINE');
    
    // Mock Image constructor for DNS test
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
    };
    
    global.Image = vi.fn(() => mockImage) as any;
    
    // Mock fetch for ping test
    global.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    
    const reportPromise = createEnhancedErrorReport(error);
    
    // Simulate image load success for DNS test
    setTimeout(() => {
      if (mockImage.onload) mockImage.onload();
    }, 10);
    
    const report = await reportPromise;
    
    expect(report).toHaveProperty('networkDiagnostics');
    expect(report.networkDiagnostics).toMatchObject({
      isOnline: true,
      dnsResolution: {
        success: true,
        time: expect.any(Number),
      },
      pingTest: {
        success: true,
        latency: expect.any(Number),
      },
    });
  });

  it('should handle network diagnostic failures gracefully', async () => {
    const error = new Error('Test error');
    
    // Mock failing diagnostics
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));
    
    const report = await createEnhancedErrorReport(error);
    
    expect(report).toHaveProperty('networkDiagnostics');
    expect(report.networkDiagnostics.pingTest.success).toBe(false);
  });

  it('should handle diagnostic errors', async () => {
    const error = new Error('Test error');
    
    // Force diagnostic error by breaking performance
    const originalPerformance = window.performance;
    delete (window as any).performance;
    
    const report = await createEnhancedErrorReport(error);
    
    expect(report).toHaveProperty('diagnosticError');
    
    // Restore performance
    (window as any).performance = originalPerformance;
  });
});

describe('ERROR_CODES', () => {
  it('should have all expected error codes', () => {
    expect(ERROR_CODES).toEqual({
      NETWORK_OFFLINE: 'NETWORK_OFFLINE',
      TIMEOUT: 'TIMEOUT',
      CLIENT_ERROR: 'CLIENT_ERROR',
      SERVER_ERROR: 'SERVER_ERROR',
      QUEUED_OFFLINE: 'QUEUED_OFFLINE',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
      CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
      RATE_LIMITED: 'RATE_LIMITED',
    });
  });
});
