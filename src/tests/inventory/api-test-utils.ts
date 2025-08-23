
import { beforeEach, afterEach, vi } from 'vitest';

// Test data generators
export const generateTestProduct = (overrides = {}) => ({
  id: Math.floor(Math.random() * 10000),
  name: 'Test Product',
  description: 'Test Description',
  brand: 'Test Brand',
  category_id: 1,
  cost_cents: 5000,
  price_cents: 10000,
  tax_exempt: false,
  barcode: `TEST${Date.now()}`,
  sku: `SKU${Date.now()}`,
  images: [],
  ...overrides
});

export const generateTestStockMovement = (overrides = {}) => ({
  variant_id: 1,
  delta: 10,
  type: 'receipt',
  reason: 'test movement',
  ref_id: null,
  created_by: 1,
  ...overrides
});

export const generateTestFilters = (overrides = {}) => ({
  search: '',
  category_id: null,
  brand: '',
  min_price: null,
  max_price: null,
  low_stock: false,
  out_of_stock: false,
  order_by: 'name',
  order_dir: 'asc',
  limit: 50,
  offset: 0,
  ...overrides
});

// Network simulation utilities
export class NetworkSimulator {
  private originalFetch: typeof fetch;
  private isOffline = false;
  private latency = 0;
  private errorRate = 0;

  constructor() {
    this.originalFetch = global.fetch;
  }

  setOffline(offline: boolean) {
    this.isOffline = offline;
  }

  setLatency(ms: number) {
    this.latency = ms;
  }

  setErrorRate(rate: number) {
    this.errorRate = rate;
  }

  install() {
    global.fetch = vi.fn(async (...args) => {
      // Simulate offline
      if (this.isOffline) {
        throw new TypeError('Failed to fetch');
      }

      // Simulate random errors
      if (Math.random() < this.errorRate) {
        throw new Error('Simulated network error');
      }

      // Simulate latency
      if (this.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, this.latency));
      }

      return this.originalFetch(...args);
    });
  }

  restore() {
    global.fetch = this.originalFetch;
  }
}

// API response validators
export const validateProductResponse = (product: any) => {
  const requiredFields = ['id', 'name', 'category_id', 'selling_price', 'cost_price'];
  const errors: string[] = [];

  requiredFields.forEach(field => {
    if (product[field] === undefined || product[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  if (typeof product.id !== 'number' || product.id <= 0) {
    errors.push('Invalid product ID');
  }

  if (typeof product.selling_price !== 'number' || product.selling_price < 0) {
    errors.push('Invalid selling price');
  }

  if (typeof product.cost_price !== 'number' || product.cost_price < 0) {
    errors.push('Invalid cost price');
  }

  if (!Array.isArray(product.images)) {
    errors.push('Images should be an array');
  }

  return errors;
};

export const validateStockMovementResponse = (movement: any) => {
  const requiredFields = ['id', 'variant_id', 'delta', 'type', 'created_at'];
  const errors: string[] = [];

  requiredFields.forEach(field => {
    if (movement[field] === undefined || movement[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  const validTypes = ['receipt', 'adjustment', 'sale', 'return'];
  if (!validTypes.includes(movement.type)) {
    errors.push('Invalid movement type');
  }

  if (typeof movement.delta !== 'number') {
    errors.push('Delta must be a number');
  }

  return errors;
};

// Database consistency validators
export const validateStockConsistency = async (variantId: number) => {
  try {
    // Get all stock movements for this variant
    const { data: movements } = await window.ezsite.apis.run({
      path: "getStockMovements",
      param: [variantId, null, 1000]
    });

    if (!movements || !movements.movements) {
      return { valid: false, error: 'Failed to fetch stock movements' };
    }

    // Calculate expected stock from movements
    const expectedStock = movements.movements.reduce((total: number, movement: any) => {
      return total + (movement.delta || 0);
    }, 0);

    // Get current inventory lot
    const { data: inventoryData } = await window.ezsite.apis.tablePage(36850, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "variant_id", op: "Equal", value: variantId }]
    });

    const currentStock = inventoryData?.List?.[0]?.qty_on_hand || 0;

    return {
      valid: currentStock === expectedStock,
      expectedStock,
      actualStock: currentStock,
      difference: currentStock - expectedStock
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// Performance monitoring
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  recordMetric(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  getMetrics() {
    const results: Record<string, any> = {};
    this.metrics.forEach((durations, operation) => {
      const sorted = durations.sort((a, b) => a - b);
      results[operation] = {
        count: durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    });
    return results;
  }

  reset() {
    this.metrics.clear();
  }
}

// Test result aggregator
export class TestResultAggregator {
  private results: any[] = [];

  addResult(test: string, result: any) {
    this.results.push({
      test,
      result,
      timestamp: new Date().toISOString()
    });
  }

  getResults() {
    return this.results;
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.result.success).length;
    const failed = total - passed;

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      results: this.results
    };
  }

  generateReport() {
    const summary = this.getSummary();
    return {
      ...summary,
      generatedAt: new Date().toISOString(),
      details: this.results.map(r => ({
        test: r.test,
        passed: r.result.success,
        duration: r.result.duration,
        error: r.result.error,
        timestamp: r.timestamp
      }))
    };
  }
}
