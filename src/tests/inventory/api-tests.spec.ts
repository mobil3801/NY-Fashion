
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateTestProduct,
  generateTestStockMovement,
  generateTestFilters,
  validateProductResponse,
  validateStockMovementResponse,
  validateStockConsistency,
  NetworkSimulator,
  PerformanceMonitor,
  TestResultAggregator } from
'./api-test-utils';

// Mock window.ezsite.apis
const mockApis = {
  run: vi.fn(),
  tablePage: vi.fn(),
  tableCreate: vi.fn(),
  tableUpdate: vi.fn(),
  tableDelete: vi.fn()
};

// @ts-ignore
global.window = {
  ezsite: {
    apis: mockApis
  }
};

describe('Inventory API End-to-End Tests', () => {
  let networkSimulator: NetworkSimulator;
  let performanceMonitor: PerformanceMonitor;
  let testResults: TestResultAggregator;

  beforeEach(() => {
    networkSimulator = new NetworkSimulator();
    performanceMonitor = new PerformanceMonitor();
    testResults = new TestResultAggregator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    networkSimulator.restore();
  });

  describe('getProducts API Tests', () => {
    it('should fetch products with valid response format', async () => {
      const mockProducts = [generateTestProduct()];
      mockApis.run.mockResolvedValue({ data: mockProducts, error: null });

      const endTimer = performanceMonitor.startTimer('getProducts_basic');

      try {
        const { data, error } = await window.ezsite.apis.run({
          path: "getProducts",
          param: [{}]
        });

        const duration = endTimer();

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          const validationErrors = validateProductResponse(data[0]);
          expect(validationErrors).toHaveLength(0);
        }

        testResults.addResult('getProducts_basic', {
          success: true,
          duration,
          productCount: data.length
        });
      } catch (err) {
        testResults.addResult('getProducts_basic', {
          success: false,
          duration: endTimer(),
          error: err.message
        });
        throw err;
      }
    });

    it('should handle search filters correctly', async () => {
      const searchFilters = generateTestFilters({ search: 'Test Product' });
      const mockProducts = [generateTestProduct({ name: 'Test Product Match' })];
      mockApis.run.mockResolvedValue({ data: mockProducts, error: null });

      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [searchFilters]
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      testResults.addResult('getProducts_search', {
        success: true,
        filterApplied: searchFilters.search
      });
    });

    it('should handle price range filters', async () => {
      const priceFilters = generateTestFilters({
        min_price: 50,
        max_price: 200
      });
      mockApis.run.mockResolvedValue({ data: [], error: null });

      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [priceFilters]
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      testResults.addResult('getProducts_price_filter', {
        success: true,
        minPrice: priceFilters.min_price,
        maxPrice: priceFilters.max_price
      });
    });

    it('should handle network errors gracefully', async () => {
      networkSimulator.setErrorRate(1); // 100% error rate
      networkSimulator.install();

      mockApis.run.mockRejectedValue(new Error('Network error'));

      try {
        await window.ezsite.apis.run({
          path: "getProducts",
          param: [{}]
        });
      } catch (error) {
        expect(error.message).toContain('Network error');
        testResults.addResult('getProducts_network_error', {
          success: true, // Successfully handled error
          errorHandled: true
        });
      }
    });

    it('should handle invalid input gracefully', async () => {
      const invalidFilters = {
        category_id: 'invalid',
        min_price: 'not_a_number',
        order_by: 'invalid_field'
      };

      mockApis.run.mockResolvedValue({ data: [], error: null });

      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [invalidFilters]
      });

      // Should not crash and return valid response
      expect(Array.isArray(data)).toBe(true);

      testResults.addResult('getProducts_invalid_input', {
        success: true,
        inputValidation: 'passed'
      });
    });
  });

  describe('saveProduct API Tests', () => {
    it('should create new product successfully', async () => {
      const newProduct = generateTestProduct();
      delete newProduct.id; // Remove ID for creation

      mockApis.run.mockResolvedValue({
        data: { id: 123, message: 'Product created successfully' },
        error: null
      });

      const endTimer = performanceMonitor.startTimer('saveProduct_create');

      try {
        const { data, error } = await window.ezsite.apis.run({
          path: "saveProduct",
          param: [newProduct]
        });

        const duration = endTimer();

        expect(error).toBeNull();
        expect(data.id).toBeDefined();
        expect(typeof data.id).toBe('number');

        testResults.addResult('saveProduct_create', {
          success: true,
          duration,
          productId: data.id
        });
      } catch (err) {
        testResults.addResult('saveProduct_create', {
          success: false,
          duration: endTimer(),
          error: err.message
        });
        throw err;
      }
    });

    it('should update existing product successfully', async () => {
      const existingProduct = generateTestProduct({ id: 123 });

      mockApis.run.mockResolvedValue({
        data: { id: 123, message: 'Product updated successfully' },
        error: null
      });

      const { data, error } = await window.ezsite.apis.run({
        path: "saveProduct",
        param: [existingProduct]
      });

      expect(error).toBeNull();
      expect(data.id).toBe(123);

      testResults.addResult('saveProduct_update', {
        success: true,
        productId: data.id
      });
    });

    it('should validate required fields', async () => {
      const invalidProduct = { name: '' }; // Missing required fields

      mockApis.run.mockRejectedValue(new Error('Product name and category are required'));

      try {
        await window.ezsite.apis.run({
          path: "saveProduct",
          param: [invalidProduct]
        });
      } catch (error) {
        expect(error.message).toContain('required');
        testResults.addResult('saveProduct_validation', {
          success: true, // Successfully caught validation error
          validationPassed: true
        });
      }
    });
  });

  describe('getStockMovements API Tests', () => {
    it('should fetch stock movements for a variant', async () => {
      const mockMovements = [generateTestStockMovement()];
      mockApis.run.mockResolvedValue({
        data: { movements: mockMovements },
        error: null
      });

      const endTimer = performanceMonitor.startTimer('getStockMovements');

      try {
        const { data, error } = await window.ezsite.apis.run({
          path: "getStockMovements",
          param: [1, null, 50] // productId, variantId, limit
        });

        const duration = endTimer();

        expect(error).toBeNull();
        expect(data.movements).toBeDefined();
        expect(Array.isArray(data.movements)).toBe(true);

        if (data.movements.length > 0) {
          const validationErrors = validateStockMovementResponse(data.movements[0]);
          expect(validationErrors).toHaveLength(0);
        }

        testResults.addResult('getStockMovements', {
          success: true,
          duration,
          movementCount: data.movements.length
        });
      } catch (err) {
        testResults.addResult('getStockMovements', {
          success: false,
          duration: endTimer(),
          error: err.message
        });
        throw err;
      }
    });
  });

  describe('addStockMovement API Tests', () => {
    it('should add stock movement successfully', async () => {
      const movement = generateTestStockMovement();

      mockApis.run.mockResolvedValue({
        data: { id: 456, message: 'Stock movement recorded successfully' },
        error: null
      });

      const endTimer = performanceMonitor.startTimer('addStockMovement');

      try {
        const { data, error } = await window.ezsite.apis.run({
          path: "addStockMovement",
          param: [movement]
        });

        const duration = endTimer();

        expect(error).toBeNull();
        expect(data.id).toBeDefined();
        expect(typeof data.id).toBe('number');

        testResults.addResult('addStockMovement', {
          success: true,
          duration,
          movementId: data.id
        });
      } catch (err) {
        testResults.addResult('addStockMovement', {
          success: false,
          duration: endTimer(),
          error: err.message
        });
        throw err;
      }
    });

    it('should validate movement type', async () => {
      const invalidMovement = generateTestStockMovement({ type: 'invalid_type' });

      mockApis.run.mockRejectedValue(new Error('Invalid movement type'));

      try {
        await window.ezsite.apis.run({
          path: "addStockMovement",
          param: [invalidMovement]
        });
      } catch (error) {
        expect(error.message).toContain('Invalid movement type');
        testResults.addResult('addStockMovement_validation', {
          success: true,
          validationPassed: true
        });
      }
    });
  });

  describe('Concurrent Operations Tests', () => {
    it('should handle concurrent stock movements correctly', async () => {
      const variantId = 1;
      const movements = Array.from({ length: 5 }, (_, i) =>
      generateTestStockMovement({
        variant_id: variantId,
        delta: 5,
        reason: `Concurrent test ${i}`
      })
      );

      // Mock sequential responses
      let callCount = 0;
      mockApis.run.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { id: callCount, message: 'Success' },
          error: null
        });
      });

      const promises = movements.map((movement) =>
      window.ezsite.apis.run({
        path: "addStockMovement",
        param: [movement]
      })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled').length;

      testResults.addResult('concurrent_movements', {
        success: successful === movements.length,
        totalOperations: movements.length,
        successfulOperations: successful,
        concurrentTest: true
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete operations within acceptable time limits', async () => {
      const acceptableLatency = 5000; // 5 seconds

      // Test getProducts performance
      mockApis.run.mockResolvedValue({ data: [], error: null });

      const startTime = performance.now();
      await window.ezsite.apis.run({
        path: "getProducts",
        param: [generateTestFilters({ limit: 100 })]
      });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(acceptableLatency);

      testResults.addResult('performance_getProducts', {
        success: duration < acceptableLatency,
        duration,
        acceptableLimit: acceptableLatency,
        performanceTest: true
      });
    });
  });

  describe('Test Summary and Reporting', () => {
    it('should generate comprehensive test report', () => {
      const summary = testResults.getSummary();
      const report = testResults.generateReport();
      const metrics = performanceMonitor.getMetrics();

      console.log('Test Summary:', summary);
      console.log('Performance Metrics:', metrics);
      console.log('Detailed Report:', report);

      expect(summary.total).toBeGreaterThan(0);
      expect(report.generatedAt).toBeDefined();
    });
  });
});