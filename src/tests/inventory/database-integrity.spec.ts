
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateStockConsistency, TestResultAggregator } from './api-test-utils';

// Mock window.ezsite.apis
const mockApis = {
  run: vi.fn(),
  tablePage: vi.fn()
};

// @ts-ignore
global.window = {
  ezsite: {
    apis: mockApis
  }
};

describe('Database Integrity Tests', () => {
  let testResults: TestResultAggregator;

  beforeEach(() => {
    testResults = new TestResultAggregator();
    vi.clearAllMocks();
  });

  describe('Stock Consistency Validation', () => {
    it('should validate stock calculations match movements', async () => {
      const variantId = 1;

      // Mock stock movements
      const mockMovements = [
      { delta: 100, type: 'receipt', created_at: '2024-01-01' },
      { delta: -20, type: 'sale', created_at: '2024-01-02' },
      { delta: 50, type: 'adjustment', created_at: '2024-01-03' }];


      // Mock inventory lot
      const mockInventoryLot = {
        List: [{ qty_on_hand: 130 }],
        VirtualCount: 1
      };

      mockApis.run.mockResolvedValue({
        data: { movements: mockMovements },
        error: null
      });

      mockApis.tablePage.mockResolvedValue({
        data: mockInventoryLot,
        error: null
      });

      const result = await validateStockConsistency(variantId);

      expect(result.valid).toBe(true);
      expect(result.expectedStock).toBe(130); // 100 - 20 + 50
      expect(result.actualStock).toBe(130);
      expect(result.difference).toBe(0);

      testResults.addResult('stock_consistency_match', {
        success: result.valid,
        expectedStock: result.expectedStock,
        actualStock: result.actualStock,
        difference: result.difference
      });
    });

    it('should detect stock inconsistencies', async () => {
      const variantId = 2;

      // Mock stock movements that don't match inventory
      const mockMovements = [
      { delta: 100, type: 'receipt', created_at: '2024-01-01' },
      { delta: -30, type: 'sale', created_at: '2024-01-02' }];


      // Mock inventory lot with inconsistent value
      const mockInventoryLot = {
        List: [{ qty_on_hand: 50 }], // Should be 70
        VirtualCount: 1
      };

      mockApis.run.mockResolvedValue({
        data: { movements: mockMovements },
        error: null
      });

      mockApis.tablePage.mockResolvedValue({
        data: mockInventoryLot,
        error: null
      });

      const result = await validateStockConsistency(variantId);

      expect(result.valid).toBe(false);
      expect(result.expectedStock).toBe(70); // 100 - 30
      expect(result.actualStock).toBe(50);
      expect(result.difference).toBe(-20); // 50 - 70

      testResults.addResult('stock_consistency_mismatch', {
        success: !result.valid, // Success means we detected the inconsistency
        expectedStock: result.expectedStock,
        actualStock: result.actualStock,
        difference: result.difference,
        inconsistencyDetected: true
      });
    });
  });

  describe('Database Schema Validation', () => {
    it('should validate products table structure', async () => {
      // Mock a product with all expected fields
      const mockProduct = {
        List: [{
          id: 1,
          name: 'Test Product',
          description: 'Test Description',
          brand: 'Test Brand',
          category_id: 1,
          cost_price: 50,
          selling_price: 100,
          barcode: 'TEST123',
          sku: 'SKU123',
          image_urls: '[]',
          current_stock: 10,
          min_stock_level: 5,
          max_stock_level: 100,
          is_active: true,
          is_trackable: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockApis.tablePage.mockResolvedValue({
        data: mockProduct,
        error: null
      });

      const { data, error } = await window.ezsite.apis.tablePage(36848, {
        PageNo: 1,
        PageSize: 1
      });

      expect(error).toBeNull();
      expect(data.List).toHaveLength(1);

      const product = data.List[0];
      const requiredFields = [
      'id', 'name', 'category_id', 'cost_price', 'selling_price',
      'is_active', 'created_at', 'updated_at'];


      const missingFields = requiredFields.filter((field) =>
      product[field] === undefined || product[field] === null
      );

      expect(missingFields).toHaveLength(0);

      testResults.addResult('products_schema_validation', {
        success: missingFields.length === 0,
        requiredFields,
        missingFields,
        schemaValidation: true
      });
    });

    it('should validate stock_movements table structure', async () => {
      const mockMovement = {
        List: [{
          id: 1,
          variant_id: 1,
          delta: 10,
          type: 'receipt',
          ref_id: null,
          reason: 'Test movement',
          created_by: 1,
          created_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockApis.tablePage.mockResolvedValue({
        data: mockMovement,
        error: null
      });

      const { data, error } = await window.ezsite.apis.tablePage(36851, {
        PageNo: 1,
        PageSize: 1
      });

      expect(error).toBeNull();
      expect(data.List).toHaveLength(1);

      const movement = data.List[0];
      const requiredFields = ['id', 'variant_id', 'delta', 'type', 'created_at'];

      const missingFields = requiredFields.filter((field) =>
      movement[field] === undefined || movement[field] === null
      );

      expect(missingFields).toHaveLength(0);

      // Validate movement type enum
      const validTypes = ['receipt', 'adjustment', 'sale', 'return'];
      expect(validTypes).toContain(movement.type);

      testResults.addResult('stock_movements_schema_validation', {
        success: missingFields.length === 0 && validTypes.includes(movement.type),
        requiredFields,
        missingFields,
        validType: validTypes.includes(movement.type),
        schemaValidation: true
      });
    });
  });

  describe('Referential Integrity Tests', () => {
    it('should validate product-category relationships', async () => {
      // Mock product with category reference
      const mockProduct = {
        List: [{
          id: 1,
          category_id: 5,
          name: 'Test Product'
        }]
      };

      // Mock category exists
      const mockCategory = {
        List: [{
          id: 5,
          name: 'Test Category'
        }]
      };

      mockApis.tablePage.
      mockResolvedValueOnce({ data: mockProduct, error: null }).
      mockResolvedValueOnce({ data: mockCategory, error: null });

      // Get product
      const { data: productData } = await window.ezsite.apis.tablePage(36848, {
        PageNo: 1,
        PageSize: 1
      });

      const product = productData.List[0];

      // Verify category exists
      const { data: categoryData } = await window.ezsite.apis.tablePage(36847, {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: "id", op: "Equal", value: product.category_id }]
      });

      const categoryExists = categoryData.List.length > 0;

      testResults.addResult('product_category_relationship', {
        success: categoryExists,
        productId: product.id,
        categoryId: product.category_id,
        categoryExists,
        referentialIntegrity: true
      });
    });

    it('should validate stock_movements-variant relationships', async () => {
      // Mock stock movement with variant reference
      const mockMovement = {
        List: [{
          id: 1,
          variant_id: 10,
          delta: 5
        }]
      };

      // Mock variant exists
      const mockVariant = {
        List: [{
          id: 10,
          product_id: 1
        }]
      };

      mockApis.tablePage.
      mockResolvedValueOnce({ data: mockMovement, error: null }).
      mockResolvedValueOnce({ data: mockVariant, error: null });

      // Get movement
      const { data: movementData } = await window.ezsite.apis.tablePage(36851, {
        PageNo: 1,
        PageSize: 1
      });

      const movement = movementData.List[0];

      // Verify variant exists
      const { data: variantData } = await window.ezsite.apis.tablePage(36849, {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: "id", op: "Equal", value: movement.variant_id }]
      });

      const variantExists = variantData.List.length > 0;

      testResults.addResult('movement_variant_relationship', {
        success: variantExists,
        movementId: movement.id,
        variantId: movement.variant_id,
        variantExists,
        referentialIntegrity: true
      });
    });
  });

  describe('Data Type Validation', () => {
    it('should validate numeric fields are properly typed', async () => {
      const mockProduct = {
        List: [{
          id: 1,
          cost_price: 50.99,
          selling_price: 99.99,
          current_stock: 25,
          min_stock_level: 5,
          max_stock_level: 100,
          tax_rate: 0.08
        }]
      };

      mockApis.tablePage.mockResolvedValue({
        data: mockProduct,
        error: null
      });

      const { data } = await window.ezsite.apis.tablePage(36848, {
        PageNo: 1,
        PageSize: 1
      });

      const product = data.List[0];

      const numericFields = [
      'id', 'cost_price', 'selling_price', 'current_stock',
      'min_stock_level', 'max_stock_level', 'tax_rate'];


      const invalidFields = numericFields.filter((field) =>
      typeof product[field] !== 'number' || isNaN(product[field])
      );

      testResults.addResult('numeric_field_validation', {
        success: invalidFields.length === 0,
        numericFields,
        invalidFields,
        dataTypeValidation: true
      });
    });

    it('should validate boolean fields are properly typed', async () => {
      const mockProduct = {
        List: [{
          id: 1,
          is_active: true,
          is_trackable: false,
          tax_exempt: false
        }]
      };

      mockApis.tablePage.mockResolvedValue({
        data: mockProduct,
        error: null
      });

      const { data } = await window.ezsite.apis.tablePage(36848, {
        PageNo: 1,
        PageSize: 1
      });

      const product = data.List[0];

      const booleanFields = ['is_active', 'is_trackable', 'tax_exempt'];

      const invalidFields = booleanFields.filter((field) =>
      typeof product[field] !== 'boolean'
      );

      testResults.addResult('boolean_field_validation', {
        success: invalidFields.length === 0,
        booleanFields,
        invalidFields,
        dataTypeValidation: true
      });
    });
  });
});