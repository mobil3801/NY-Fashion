
// Enhanced validation utilities for inventory components
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning extends ValidationError {
  severity: 'warning';
  suggestion?: string;
}

export interface ProductValidationRules {
  name: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  };
  sku: {
    required: boolean;
    unique: boolean;
    pattern?: RegExp;
  };
  price: {
    required: boolean;
    min?: number;
    max?: number;
  };
  stock: {
    required: boolean;
    min?: number;
    max?: number;
  };
}

export interface StockMovementValidationRules {
  quantity: {
    required: boolean;
    min: number;
    max?: number;
  };
  movementType: {
    required: boolean;
    allowedTypes: string[];
  };
  reason: {
    required: boolean;
    minLength?: number;
  };
}

export interface AdjustmentValidationRules {
  reason: {
    required: boolean;
    allowedReasons: string[];
  };
  items: {
    minItems: number;
    maxItems?: number;
  };
  approval: {
    required: boolean;
    threshold?: number;
  };
}

class InventoryValidator {
  private static instance: InventoryValidator;
  
  static getInstance(): InventoryValidator {
    if (!this.instance) {
      this.instance = new InventoryValidator();
    }
    return this.instance;
  }

  // Product validation
  validateProduct(product: any, rules: ProductValidationRules, existingProducts: any[] = []): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Name validation
    if (rules.name.required && !product.name?.trim()) {
      errors.push({
        field: 'name',
        code: 'REQUIRED',
        message: 'Product name is required',
        severity: 'error'
      });
    }

    if (product.name?.trim()) {
      if (rules.name.minLength && product.name.trim().length < rules.name.minLength) {
        errors.push({
          field: 'name',
          code: 'MIN_LENGTH',
          message: `Product name must be at least ${rules.name.minLength} characters`,
          severity: 'error'
        });
      }

      if (rules.name.maxLength && product.name.trim().length > rules.name.maxLength) {
        errors.push({
          field: 'name',
          code: 'MAX_LENGTH',
          message: `Product name must not exceed ${rules.name.maxLength} characters`,
          severity: 'error'
        });
      }

      if (rules.name.pattern && !rules.name.pattern.test(product.name.trim())) {
        warnings.push({
          field: 'name',
          code: 'PATTERN',
          message: 'Product name format may not be optimal',
          severity: 'warning',
          suggestion: 'Consider using alphanumeric characters and common symbols'
        });
      }
    }

    // SKU validation
    if (rules.sku.required && !product.sku?.trim()) {
      errors.push({
        field: 'sku',
        code: 'REQUIRED',
        message: 'SKU is required',
        severity: 'error'
      });
    }

    if (product.sku?.trim() && rules.sku.unique) {
      const duplicate = existingProducts.find(p => 
        p.sku === product.sku.trim() && p.id !== product.id
      );
      if (duplicate) {
        errors.push({
          field: 'sku',
          code: 'DUPLICATE',
          message: 'SKU must be unique',
          severity: 'error'
        });
      }
    }

    if (product.sku?.trim() && rules.sku.pattern && !rules.sku.pattern.test(product.sku.trim())) {
      warnings.push({
        field: 'sku',
        code: 'PATTERN',
        message: 'SKU format may not follow company standards',
        severity: 'warning',
        suggestion: 'Consider using a consistent SKU format like CATEGORY-XXXX'
      });
    }

    // Price validation
    const price = parseFloat(product.selling_price || product.price || 0);
    
    if (rules.price.required && (isNaN(price) || price <= 0)) {
      errors.push({
        field: 'price',
        code: 'REQUIRED',
        message: 'Valid price is required',
        severity: 'error'
      });
    }

    if (!isNaN(price)) {
      if (rules.price.min !== undefined && price < rules.price.min) {
        errors.push({
          field: 'price',
          code: 'MIN_VALUE',
          message: `Price must be at least ${rules.price.min}`,
          severity: 'error'
        });
      }

      if (rules.price.max !== undefined && price > rules.price.max) {
        warnings.push({
          field: 'price',
          code: 'MAX_VALUE',
          message: `Price seems unusually high (${price})`,
          severity: 'warning',
          suggestion: 'Please verify the price is correct'
        });
      }

      // Cost vs selling price validation
      const cost = parseFloat(product.cost_price || 0);
      if (!isNaN(cost) && cost > 0 && price < cost) {
        warnings.push({
          field: 'price',
          code: 'BELOW_COST',
          message: 'Selling price is below cost price',
          severity: 'warning',
          suggestion: 'This will result in a loss on each sale'
        });
      }
    }

    // Stock validation
    const stock = parseInt(product.total_stock || product.current_stock || 0);
    
    if (rules.stock.required && (isNaN(stock) || stock < 0)) {
      errors.push({
        field: 'stock',
        code: 'INVALID',
        message: 'Valid stock quantity is required',
        severity: 'error'
      });
    }

    if (!isNaN(stock)) {
      if (rules.stock.min !== undefined && stock < rules.stock.min) {
        warnings.push({
          field: 'stock',
          code: 'LOW_STOCK',
          message: `Stock level is below recommended minimum (${rules.stock.min})`,
          severity: 'warning',
          suggestion: 'Consider restocking this item'
        });
      }

      if (rules.stock.max !== undefined && stock > rules.stock.max) {
        warnings.push({
          field: 'stock',
          code: 'HIGH_STOCK',
          message: `Stock level is very high (${stock})`,
          severity: 'warning',
          suggestion: 'Consider if this much stock is necessary'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Stock movement validation
  validateStockMovement(movement: any, rules: StockMovementValidationRules, currentStock: number = 0): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Quantity validation
    const quantity = parseInt(movement.quantity || 0);
    
    if (rules.quantity.required && (isNaN(quantity) || quantity <= rules.quantity.min)) {
      errors.push({
        field: 'quantity',
        code: 'INVALID',
        message: `Quantity must be greater than ${rules.quantity.min}`,
        severity: 'error'
      });
    }

    if (rules.quantity.max && quantity > rules.quantity.max) {
      warnings.push({
        field: 'quantity',
        code: 'HIGH_QUANTITY',
        message: `Quantity is unusually high (${quantity})`,
        severity: 'warning',
        suggestion: 'Please verify this quantity is correct'
      });
    }

    // Movement type validation
    if (rules.movementType.required && !movement.movement_type) {
      errors.push({
        field: 'movement_type',
        code: 'REQUIRED',
        message: 'Movement type is required',
        severity: 'error'
      });
    }

    if (movement.movement_type && !rules.movementType.allowedTypes.includes(movement.movement_type)) {
      errors.push({
        field: 'movement_type',
        code: 'INVALID',
        message: 'Invalid movement type',
        severity: 'error'
      });
    }

    // Stock level validation for outbound movements
    if (['sale', 'adjustment'].includes(movement.movement_type) && quantity > currentStock) {
      if (movement.movement_type === 'sale') {
        errors.push({
          field: 'quantity',
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`,
          severity: 'error'
        });
      } else {
        warnings.push({
          field: 'quantity',
          code: 'NEGATIVE_STOCK',
          message: `This adjustment will result in negative stock (${currentStock - quantity})`,
          severity: 'warning',
          suggestion: 'Consider if this adjustment is correct'
        });
      }
    }

    // Large quantity warnings
    if (quantity > currentStock * 2) {
      warnings.push({
        field: 'quantity',
        code: 'LARGE_MOVEMENT',
        message: 'This is a large stock movement relative to current stock',
        severity: 'warning',
        suggestion: 'Please double-check the quantity'
      });
    }

    // Reason validation
    if (rules.reason.required && !movement.notes?.trim()) {
      warnings.push({
        field: 'notes',
        code: 'MISSING_REASON',
        message: 'Adding a reason helps with audit trails',
        severity: 'warning',
        suggestion: 'Consider adding a brief explanation'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Adjustment validation
  validateAdjustment(adjustment: any, rules: AdjustmentValidationRules): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Reason validation
    if (rules.reason.required && !adjustment.reason) {
      errors.push({
        field: 'reason',
        code: 'REQUIRED',
        message: 'Adjustment reason is required',
        severity: 'error'
      });
    }

    if (adjustment.reason && !rules.reason.allowedReasons.includes(adjustment.reason)) {
      warnings.push({
        field: 'reason',
        code: 'UNUSUAL_REASON',
        message: 'This reason is not commonly used',
        severity: 'warning',
        suggestion: 'Ensure this is the most appropriate reason'
      });
    }

    // Items validation
    const items = adjustment.items || [];
    
    if (items.length < rules.items.minItems) {
      errors.push({
        field: 'items',
        code: 'INSUFFICIENT_ITEMS',
        message: `At least ${rules.items.minItems} item(s) required`,
        severity: 'error'
      });
    }

    if (rules.items.maxItems && items.length > rules.items.maxItems) {
      warnings.push({
        field: 'items',
        code: 'TOO_MANY_ITEMS',
        message: `Large number of items (${items.length})`,
        severity: 'warning',
        suggestion: 'Consider splitting into multiple adjustments'
      });
    }

    // Individual item validation
    let totalAdjustmentValue = 0;
    
    items.forEach((item: any, index: number) => {
      const difference = Math.abs(item.difference || 0);
      const value = difference * (item.unit_cost || 0);
      totalAdjustmentValue += value;

      if (difference > (item.current_stock || 0) * 0.5) {
        warnings.push({
          field: `items.${index}`,
          code: 'LARGE_ADJUSTMENT',
          message: `Large adjustment for item ${item.product_name || 'Unknown'}`,
          severity: 'warning',
          suggestion: 'Please verify this adjustment is correct'
        });
      }

      if (!item.reason?.trim()) {
        warnings.push({
          field: `items.${index}`,
          code: 'MISSING_ITEM_REASON',
          message: `No specific reason provided for ${item.product_name || 'item'}`,
          severity: 'warning',
          suggestion: 'Adding item-specific reasons improves audit trails'
        });
      }
    });

    // Approval threshold validation
    if (rules.approval.required && rules.approval.threshold && totalAdjustmentValue > rules.approval.threshold) {
      warnings.push({
        field: 'approval',
        code: 'REQUIRES_APPROVAL',
        message: `Total adjustment value (${totalAdjustmentValue.toFixed(2)}) exceeds threshold`,
        severity: 'warning',
        suggestion: 'This adjustment will require managerial approval'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Business rules validation
  validateBusinessRules(operation: string, data: any, context: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    switch (operation) {
      case 'delete_product':
        if (data.total_stock && data.total_stock > 0) {
          warnings.push({
            field: 'stock',
            code: 'HAS_STOCK',
            message: 'Deleting product with remaining stock',
            severity: 'warning',
            suggestion: 'Consider adjusting stock to zero first'
          });
        }

        if (data.has_pending_orders) {
          errors.push({
            field: 'orders',
            code: 'PENDING_ORDERS',
            message: 'Cannot delete product with pending orders',
            severity: 'error'
          });
        }
        break;

      case 'price_change':
        const oldPrice = data.oldPrice || 0;
        const newPrice = data.newPrice || 0;
        const changePercent = oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 : 0;

        if (changePercent > 20) {
          warnings.push({
            field: 'price',
            code: 'LARGE_PRICE_CHANGE',
            message: `Price change of ${changePercent.toFixed(1)}% detected`,
            severity: 'warning',
            suggestion: 'Large price changes may affect sales'
          });
        }
        break;

      case 'stock_below_minimum':
        warnings.push({
          field: 'stock',
          code: 'LOW_STOCK_WARNING',
          message: 'Stock level is below minimum threshold',
          severity: 'warning',
          suggestion: 'Consider reordering this item'
        });
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const inventoryValidator = InventoryValidator.getInstance();

// Default validation rules
export const defaultProductRules: ProductValidationRules = {
  name: { required: true, minLength: 2, maxLength: 100 },
  sku: { required: true, unique: true, pattern: /^[A-Z0-9-]+$/i },
  price: { required: true, min: 0.01, max: 999999 },
  stock: { required: false, min: 0, max: 99999 }
};

export const defaultStockMovementRules: StockMovementValidationRules = {
  quantity: { required: true, min: 1, max: 9999 },
  movementType: { required: true, allowedTypes: ['receipt', 'sale', 'adjustment', 'return', 'transfer'] },
  reason: { required: false, minLength: 5 }
};

export const defaultAdjustmentRules: AdjustmentValidationRules = {
  reason: { 
    required: true, 
    allowedReasons: [
      'Physical Count Discrepancy',
      'Damaged Goods',
      'Expired Items',
      'Theft/Loss',
      'System Error',
      'Supplier Return',
      'Quality Issues',
      'Warehouse Transfer',
      'Other'
    ]
  },
  items: { minItems: 1, maxItems: 50 },
  approval: { required: true, threshold: 1000 }
};

// Validation helper functions
export const hasErrors = (result: ValidationResult): boolean => result.errors.length > 0;
export const hasWarnings = (result: ValidationResult): boolean => result.warnings.length > 0;
export const getErrorMessages = (result: ValidationResult): string[] => 
  result.errors.map(error => error.message);
export const getWarningMessages = (result: ValidationResult): string[] => 
  result.warnings.map(warning => warning.message);
