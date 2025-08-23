
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkErrorClassifier } from '../error-classifier';
import { createApiError } from '../client';
import { ApiError } from '../../errors';

describe('Network Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NetworkErrorClassifier', () => {
    describe('error classification', () => {
      it('should classify TypeError as network error', () => {
        const error = new TypeError('Failed to fetch');
        const classification = NetworkErrorClassifier.classifyError(error);

        expect(classification.isNetworkError).toBe(true);
        expect(classification.isTimeoutError).toBe(false);
        expect(classification.isServerError).toBe(false);
        expect(classification.isRetryable).toBe(true);
        expect(classification.severity).toBe('high');
      });

      it('should classify AbortError as timeout error', () => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        const classification = NetworkErrorClassifier.classifyError(error);

        expect(classification.isNetworkError).toBe(false);
        expect(classification.isTimeoutError).toBe(true);
        expect(classification.isRetryable).toBe(true);
        expect(classification.severity).toBe('medium');
      });

      it('should classify 5xx status as server error', () => {
        const error = { status: 500, statusText: 'Internal Server Error' };
        const classification = NetworkErrorClassifier.classifyError(error);

        expect(classification.isServerError).toBe(true);
        expect(classification.isRetryable).toBe(true);
        expect(classification.severity).toBe('high');
      });

      it('should classify 4xx status as client error (non-retryable)', () => {
        const error = { status: 404, statusText: 'Not Found' };
        const classification = NetworkErrorClassifier.classifyError(error);

        expect(classification.isClientError).toBe(true);
        expect(classification.isRetryable).toBe(false);
        expect(classification.severity).toBe('low');
      });

      it('should classify timeout status codes as timeout errors', () => {
        const timeoutCodes = [408, 429, 503, 504];

        timeoutCodes.forEach((status) => {
          const error = { status };
          const classification = NetworkErrorClassifier.classifyError(error);

          expect(classification.isTimeoutError).toBe(true);
          expect(classification.isRetryable).toBe(true);
        });
      });

      it('should handle network-related error messages', () => {
        const networkMessages = [
        'Network request failed',
        'Connection timeout',
        'DNS resolution failed',
        'Connection reset',
        'Connection refused'];


        networkMessages.forEach((message) => {
          const error = new Error(message);
          const classification = NetworkErrorClassifier.classifyError(error);

          expect(classification.isNetworkError).toBe(true);
          expect(classification.isRetryable).toBe(true);
        });
      });

      it('should provide appropriate retry delays', () => {
        const networkError = new TypeError('Failed to fetch');
        const classification = NetworkErrorClassifier.classifyError(networkError);

        expect(classification.retryDelay).toBeGreaterThan(0);
        expect(classification.retryDelay).toBeLessThanOrEqual(5000);
      });
    });

    describe('error context extraction', () => {
      it('should extract comprehensive error context', () => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n  at test.js:1:1';

        const context = NetworkErrorClassifier.getErrorContext(error);

        expect(context).toHaveProperty('timestamp');
        expect(context).toHaveProperty('userAgent');
        expect(context).toHaveProperty('url');
        expect(context).toHaveProperty('connectionType');
        expect(context).toHaveProperty('onlineStatus');
        expect(context.message).toBe('Test error');
        expect(context.stack).toContain('test.js');
      });

      it('should handle missing navigator properties gracefully', () => {
        // Mock missing navigator properties
        const originalConnection = (navigator as any).connection;
        delete (navigator as any).connection;

        const error = new Error('Test error');
        const context = NetworkErrorClassifier.getErrorContext(error);

        expect(context.connectionType).toBe('unknown');

        // Restore
        (navigator as any).connection = originalConnection;
      });
    });

    describe('recovery suggestions', () => {
      it('should provide network error recovery suggestions', () => {
        const error = new TypeError('Failed to fetch');
        const suggestions = NetworkErrorClassifier.getRecoverySuggestions(error);

        expect(suggestions).toContain('Check your internet connection');
        expect(suggestions).toContain('Try refreshing the page');
        expect(suggestions.length).toBeGreaterThan(0);
      });

      it('should provide server error recovery suggestions', () => {
        const error = { status: 500 };
        const suggestions = NetworkErrorClassifier.getRecoverySuggestions(error);

        expect(suggestions).toContain('The server is experiencing issues');
        expect(suggestions).toContain('Please try again in a few minutes');
      });

      it('should provide client error recovery suggestions', () => {
        const error = { status: 404 };
        const suggestions = NetworkErrorClassifier.getRecoverySuggestions(error);

        expect(suggestions).toContain('The requested resource was not found');
        expect(suggestions).toContain('Please check the URL and try again');
      });

      it('should provide timeout error recovery suggestions', () => {
        const error = { status: 408 };
        const suggestions = NetworkErrorClassifier.getRecoverySuggestions(error);

        expect(suggestions).toContain('The request took too long to complete');
        expect(suggestions).toContain('Try again with a more stable connection');
      });
    });
  });

  describe('ApiError creation and handling', () => {
    it('should create ApiError with all properties', () => {
      const error = createApiError(
        'Test error',
        'TEST_CODE',
        true,
        { extra: 'data' }
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.retryable).toBe(true);
      expect(error.details).toEqual({ extra: 'data' });
    });

    it('should create ApiError with default values', () => {
      const error = createApiError('Default error');

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.retryable).toBe(false);
      expect(error.details).toBeUndefined();
    });

    it('should preserve error stack trace', () => {
      const error = createApiError('Stack test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack test');
    });
  });

  describe('Error categorization for monitoring', () => {
    it('should categorize errors by frequency and impact', () => {
      const errors = [
      new TypeError('Failed to fetch'),
      { status: 500 },
      { status: 404 },
      new Error('AbortError')];


      const categories = errors.map((error) => NetworkErrorClassifier.classifyError(error));

      const highSeverity = categories.filter((c) => c.severity === 'high');
      const mediumSeverity = categories.filter((c) => c.severity === 'medium');
      const lowSeverity = categories.filter((c) => c.severity === 'low');

      expect(highSeverity.length).toBeGreaterThan(0);
      expect(mediumSeverity.length).toBeGreaterThan(0);
      expect(lowSeverity.length).toBeGreaterThan(0);
    });

    it('should provide error fingerprints for deduplication', () => {
      const error1 = new TypeError('Failed to fetch');
      const error2 = new TypeError('Failed to fetch');
      const error3 = new Error('Different error');

      const fingerprint1 = NetworkErrorClassifier.getErrorFingerprint(error1);
      const fingerprint2 = NetworkErrorClassifier.getErrorFingerprint(error2);
      const fingerprint3 = NetworkErrorClassifier.getErrorFingerprint(error3);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).not.toBe(fingerprint3);
    });
  });

  describe('Error reporting and telemetry', () => {
    it('should sanitize sensitive data from error reports', () => {
      const error = new Error('Authentication failed for user@example.com');
      const sanitized = NetworkErrorClassifier.sanitizeErrorMessage(error.message);

      expect(sanitized).not.toContain('user@example.com');
      expect(sanitized).toContain('Authentication failed');
    });

    it('should generate structured error reports', () => {
      const error = new TypeError('Network error');
      const report = NetworkErrorClassifier.generateErrorReport(error);

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('error');
      expect(report).toHaveProperty('classification');
      expect(report).toHaveProperty('context');
      expect(report).toHaveProperty('suggestions');
      expect(report.id).toMatch(/^error-\d{13}-[a-f0-9]{8}$/);
    });
  });

  describe('Error recovery strategies', () => {
    it('should provide appropriate retry strategies for different error types', () => {
      const networkError = new TypeError('Failed to fetch');
      const serverError = { status: 500 };
      const rateLimitError = { status: 429 };

      const networkStrategy = NetworkErrorClassifier.getRetryStrategy(networkError);
      const serverStrategy = NetworkErrorClassifier.getRetryStrategy(serverError);
      const rateLimitStrategy = NetworkErrorClassifier.getRetryStrategy(rateLimitError);

      expect(networkStrategy.shouldRetry).toBe(true);
      expect(networkStrategy.maxAttempts).toBeGreaterThan(1);
      expect(networkStrategy.backoffMultiplier).toBeGreaterThan(1);

      expect(serverStrategy.shouldRetry).toBe(true);
      expect(serverStrategy.backoffMultiplier).toBeGreaterThan(1);

      expect(rateLimitStrategy.shouldRetry).toBe(true);
      expect(rateLimitStrategy.initialDelay).toBeGreaterThan(1000);
    });

    it('should recommend circuit breaker for persistent errors', () => {
      const errors = Array(10).fill(new TypeError('Failed to fetch'));
      const shouldBreak = NetworkErrorClassifier.shouldTriggerCircuitBreaker(errors);

      expect(shouldBreak).toBe(true);
    });
  });
});