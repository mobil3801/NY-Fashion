
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeError,
  isApiError,
  isRetryable,
  getUserFriendlyMessage,
  createErrorReport,
  createEnhancedErrorReport,
  ERROR_CODES,
  logApiEvent } from
'../../errors';
import { createApiError } from '../client';

describe('Error Normalization and Classification Tests', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Network Error Normalization', () => {
    it('should normalize TypeError (fetch failures) correctly', () => {
      const networkError = new TypeError('Failed to fetch');
      const normalized = normalizeError(networkError);

      expect(normalized.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(normalized.retryable).toBe(true);
      expect(normalized.message).toContain('network connection');
    });

    it('should normalize DNS resolution errors', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
      const normalized = normalizeError(dnsError);

      expect(normalized.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(normalized.retryable).toBe(true);
      expect(normalized.message).toContain('network connection');
    });

    it('should normalize connection refused errors', () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:443');
      const normalized = normalizeError(connError);

      expect(normalized.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(normalized.retryable).toBe(true);
    });

    it('should normalize timeout errors correctly', () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';
      const normalized = normalizeError(timeoutError);

      expect(normalized.code).toBe(ERROR_CODES.TIMEOUT);
      expect(normalized.retryable).toBe(true);
      expect(normalized.message).toContain('request timed out');
    });

    it('should normalize HTTP status errors', () => {
      const httpError = { status: 500, statusText: 'Internal Server Error' };
      const normalized = normalizeError(httpError);

      expect(normalized.code).toBe(ERROR_CODES.SERVER_ERROR);
      expect(normalized.retryable).toBe(true);
      expect(normalized.details).toEqual({ status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle mixed error types in sequence', () => {
      const errors = [
      new TypeError('Failed to fetch'),
      { status: 404, statusText: 'Not Found' },
      new Error('Rate limit exceeded'),
      'String error message'];


      const normalized = errors.map(normalizeError);

      expect(normalized[0].code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(normalized[1].code).toBe(ERROR_CODES.CLIENT_ERROR);
      expect(normalized[2].code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(normalized[3].code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });
  });

  describe('HTTP Status Code Classification', () => {
    const statusCodes = [
    // Success
    { status: 200, expectedCode: null, retryable: false },
    { status: 201, expectedCode: null, retryable: false },

    // Client errors (4xx) - mostly non-retryable
    { status: 400, expectedCode: ERROR_CODES.CLIENT_ERROR, retryable: false },
    { status: 401, expectedCode: ERROR_CODES.CLIENT_ERROR, retryable: false },
    { status: 403, expectedCode: ERROR_CODES.CLIENT_ERROR, retryable: false },
    { status: 404, expectedCode: ERROR_CODES.CLIENT_ERROR, retryable: false },

    // Retryable client errors
    { status: 408, expectedCode: ERROR_CODES.TIMEOUT, retryable: true },
    { status: 429, expectedCode: ERROR_CODES.RATE_LIMITED, retryable: true },

    // Server errors (5xx) - retryable
    { status: 500, expectedCode: ERROR_CODES.SERVER_ERROR, retryable: true },
    { status: 502, expectedCode: ERROR_CODES.SERVER_ERROR, retryable: true },
    { status: 503, expectedCode: ERROR_CODES.SERVER_ERROR, retryable: true },
    { status: 504, expectedCode: ERROR_CODES.TIMEOUT, retryable: true }];


    statusCodes.forEach(({ status, expectedCode, retryable }) => {
      if (expectedCode) {
        it(`should classify ${status} as ${expectedCode} (retryable: ${retryable})`, () => {
          const error = { status, statusText: `HTTP ${status}` };
          const normalized = normalizeError(error);

          expect(normalized.code).toBe(expectedCode);
          expect(normalized.retryable).toBe(retryable);
        });
      }
    });
  });

  describe('Error Chain Analysis', () => {
    it('should analyze nested error causes', () => {
      const rootCause = new TypeError('Failed to fetch');
      const wrapperError = new Error('Request failed');
      wrapperError.cause = rootCause;

      const normalized = normalizeError(wrapperError);

      expect(normalized.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(normalized.retryable).toBe(true);
      expect(normalized.details).toEqual({
        originalError: wrapperError.message,
        cause: rootCause.message
      });
    });

    it('should handle circular error references', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      error1.cause = error2;
      error2.cause = error1; // Circular reference

      expect(() => normalizeError(error1)).not.toThrow();

      const normalized = normalizeError(error1);
      expect(normalized.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it('should preserve error metadata through normalization', () => {
      const error = new Error('Test error');
      (error as any).metadata = { requestId: '123', userId: 'user-456' };
      (error as any).timestamp = '2024-01-01T00:00:00Z';

      const normalized = normalizeError(error);

      expect(normalized.details).toMatchObject({
        metadata: { requestId: '123', userId: 'user-456' },
        timestamp: '2024-01-01T00:00:00Z'
      });
    });
  });

  describe('Retry Decision Logic', () => {
    it('should correctly identify retryable vs non-retryable errors', () => {
      const retryableErrors = [
      normalizeError(new TypeError('Network error')),
      normalizeError({ status: 500 }),
      normalizeError({ status: 502 }),
      normalizeError({ status: 429 }),
      normalizeError({ status: 408 })];


      const nonRetryableErrors = [
      normalizeError({ status: 400 }),
      normalizeError({ status: 401 }),
      normalizeError({ status: 403 }),
      normalizeError({ status: 404 }),
      normalizeError(new Error('Authentication failed'))];


      retryableErrors.forEach((error) => {
        expect(isRetryable(error)).toBe(true);
      });

      nonRetryableErrors.forEach((error) => {
        expect(isRetryable(error)).toBe(false);
      });
    });

    it('should handle edge cases in retry logic', () => {
      // Null/undefined
      expect(isRetryable(null)).toBe(false);
      expect(isRetryable(undefined)).toBe(false);

      // Non-error objects
      expect(isRetryable('string')).toBe(false);
      expect(isRetryable(123)).toBe(false);
      expect(isRetryable({})).toBe(false);

      // Plain objects with retryable property
      expect(isRetryable({ retryable: true })).toBe(true);
      expect(isRetryable({ retryable: false })).toBe(false);
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide appropriate user messages for common errors', () => {
      const testCases = [
      {
        error: normalizeError(new TypeError('Failed to fetch')),
        expectedMessage: /network connection/i
      },
      {
        error: normalizeError({ status: 404 }),
        expectedMessage: /not found/i
      },
      {
        error: normalizeError({ status: 401 }),
        expectedMessage: /unauthorized/i
      },
      {
        error: normalizeError({ status: 500 }),
        expectedMessage: /server error/i
      },
      {
        error: normalizeError({ status: 429 }),
        expectedMessage: /too many requests/i
      }];


      testCases.forEach(({ error, expectedMessage }) => {
        const message = getUserFriendlyMessage(error);
        expect(message).toMatch(expectedMessage);
      });
    });

    it('should handle localization context in error messages', () => {
      const error = normalizeError({ status: 500 });

      // Test with different contexts
      const defaultMessage = getUserFriendlyMessage(error);
      const contextualMessage = getUserFriendlyMessage(error, {
        operation: 'saving your data'
      });

      expect(defaultMessage).toBeTruthy();
      expect(contextualMessage).toContain('saving your data');
    });

    it('should provide fallback messages for unknown errors', () => {
      const unknownError = { weirdProperty: 'value' };
      const normalized = normalizeError(unknownError);
      const message = getUserFriendlyMessage(normalized);

      expect(message).toMatch(/unexpected error/i);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('Error Reporting and Logging', () => {
    it('should create comprehensive error reports', () => {
      const error = new TypeError('Failed to fetch');
      const report = createErrorReport(error, {
        url: '/api/test',
        method: 'POST',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(report).toMatchObject({
        error: expect.objectContaining({
          code: ERROR_CODES.NETWORK_OFFLINE,
          retryable: true
        }),
        context: {
          url: '/api/test',
          method: 'POST',
          timestamp: '2024-01-01T00:00:00Z'
        },
        reportId: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should create enhanced error reports with stack traces', () => {
      const error = new Error('Test error');
      const enhancedReport = createEnhancedErrorReport(error, {
        userAgent: 'Test/1.0',
        url: window.location?.href || 'http://localhost'
      });

      expect(enhancedReport).toMatchObject({
        error: expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String)
        }),
        environment: {
          userAgent: 'Test/1.0',
          url: expect.any(String),
          timestamp: expect.any(String)
        },
        reportId: expect.any(String)
      });
    });

    it('should log API events with proper categorization', () => {
      logApiEvent('REQUEST_START', { url: '/api/test', method: 'GET' });
      logApiEvent('REQUEST_ERROR', {
        url: '/api/test',
        error: normalizeError(new TypeError('Network error')),
        duration: 1500
      });
      logApiEvent('REQUEST_SUCCESS', {
        url: '/api/test',
        method: 'GET',
        status: 200,
        duration: 250
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // START and SUCCESS
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // ERROR
    });

    it('should handle logging errors gracefully', () => {
      // Mock console.log to throw
      consoleLogSpy.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      expect(() => {
        logApiEvent('REQUEST_START', { url: '/api/test' });
      }).not.toThrow();
    });
  });

  describe('API Error Detection', () => {
    it('should correctly identify API errors', () => {
      const apiError = createApiError('Test error', ERROR_CODES.CLIENT_ERROR);
      const regularError = new Error('Regular error');
      const normalized = normalizeError(regularError);

      expect(isApiError(apiError)).toBe(true);
      expect(isApiError(regularError)).toBe(false);
      expect(isApiError(normalized)).toBe(true); // Normalized errors are API errors
    });

    it('should handle edge cases in API error detection', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError('string')).toBe(false);
      expect(isApiError(123)).toBe(false);
      expect(isApiError({})).toBe(false);

      // Object with some API error properties
      expect(isApiError({ code: 'TEST', message: 'Test' })).toBe(false);
      expect(isApiError({ code: 'TEST', message: 'Test', retryable: true })).toBe(true);
    });
  });

  describe('Error Code Constants', () => {
    it('should have all required error codes defined', () => {
      const requiredCodes = [
      'NETWORK_OFFLINE',
      'TIMEOUT',
      'SERVER_ERROR',
      'CLIENT_ERROR',
      'RATE_LIMITED',
      'UNKNOWN_ERROR',
      'QUEUED_OFFLINE'];


      requiredCodes.forEach((code) => {
        expect(ERROR_CODES).toHaveProperty(code);
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have unique error code values', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle error normalization in rapid succession', () => {
      const errors = Array.from({ length: 100 }, (_, i) =>
      new Error(`Error ${i}`)
      );

      const normalized = errors.map(normalizeError);

      normalized.forEach((error, index) => {
        expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
        expect(error.message).toContain(`Error ${index}`);
        expect(error.retryable).toBe(false);
      });
    });

    it('should preserve error context through multiple normalizations', () => {
      const original = new TypeError('Network error');
      (original as any).context = { attempt: 1, url: '/api/test' };

      const normalized1 = normalizeError(original);
      const normalized2 = normalizeError(normalized1);

      expect(normalized2.details).toEqual(normalized1.details);
      expect(normalized2.code).toBe(normalized1.code);
      expect(normalized2.retryable).toBe(normalized1.retryable);
    });

    it('should handle errors with custom properties', () => {
      const error = new Error('Custom error');
      (error as any).customProp = 'custom value';
      (error as any).statusCode = 418; // I'm a teapot
      (error as any).headers = { 'X-Custom': 'header' };

      const normalized = normalizeError(error);

      expect(normalized.details).toMatchObject({
        customProp: 'custom value',
        statusCode: 418,
        headers: { 'X-Custom': 'header' }
      });
    });
  });
});