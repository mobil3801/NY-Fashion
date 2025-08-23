import { z } from 'zod';
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';

// Base validation helpers
const sanitizeString = (value: string): string => {
  if (!PRODUCTION_CONFIG.security.sanitizeInputs) return value;
  
  return value
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
};

const createStringSchema = (min = 1, max = 255, pattern?: RegExp) => {
  let schema = z.string()
    .min(min, `Must be at least ${min} characters`)
    .max(max, `Must be at most ${max} characters`)
    .transform(sanitizeString);
    
  if (pattern) {
    schema = schema.regex(pattern, 'Invalid format');
  }
  
  return schema;
};

const createEmailSchema = () => 
  z.string()
    .email('Invalid email address')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must be at most 255 characters')
    .transform(sanitizeString)
    .transform(val => val.toLowerCase());

const createPasswordSchema = () => 
  z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

const createPriceSchema = () => 
  z.number()
    .min(0, 'Price cannot be negative')
    .max(1000000, 'Price cannot exceed $1,000,000')
    .multipleOf(0.01, 'Price can have at most 2 decimal places');

const createQuantitySchema = () => 
  z.number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .max(1000000, 'Quantity cannot exceed 1,000,000');

// Product Schema
export const ProductSchema = z.object({
  name: createStringSchema(2, 255).describe('Product name'),
  description: createStringSchema(0, 2000).optional().describe('Product description'),
  price: createPriceSchema().describe('Selling price'),
  cost: createPriceSchema().describe('Cost price'),
  sku: createStringSchema(1, 50, /^[A-Za-z0-9\-_]+$/).describe('Stock keeping unit'),
  barcode: createStringSchema(8, 50, /^[0-9]+$/).optional().describe('Product barcode'),
  category_id: z.number().int().positive().optional().describe('Category ID'),
  stock_quantity: createQuantitySchema().describe('Current stock quantity'),
  reorder_level: createQuantitySchema().describe('Reorder level'),
  reorder_quantity: createQuantitySchema().describe('Reorder quantity'),
  unit: createStringSchema(1, 50).describe('Unit of measurement'),
  status: z.enum(['active', 'inactive']).default('active').describe('Product status'),
  images: z.array(z.string().url()).max(10).optional().describe('Product images')
}).refine(data => data.price >= data.cost, {
  message: 'Selling price must be greater than or equal to cost price',
  path: ['price']
}).refine(data => data.reorder_quantity > 0, {
  message: 'Reorder quantity must be greater than 0',
  path: ['reorder_quantity']
});

// Category Schema
export const CategorySchema = z.object({
  name: createStringSchema(2, 255).describe('Category name'),
  description: createStringSchema(0, 1000).optional().describe('Category description'),
  parent_id: z.number().int().positive().optional().describe('Parent category ID'),
  status: z.enum(['active', 'inactive']).default('active').describe('Category status')
});

// Customer Schema
export const CustomerSchema = z.object({
  name: createStringSchema(2, 255).describe('Customer name'),
  email: createEmailSchema().optional().describe('Customer email'),
  phone: createStringSchema(10, 20, /^[+]?[0-9\s\-\(\)]+$/).optional().describe('Customer phone'),
  address: createStringSchema(0, 500).optional().describe('Customer address'),
  city: createStringSchema(0, 100).optional().describe('Customer city'),
  country: createStringSchema(0, 100).optional().describe('Customer country'),
  status: z.enum(['active', 'inactive']).default('active').describe('Customer status'),
  credit_limit: createPriceSchema().optional().describe('Credit limit'),
  tax_exempt: z.boolean().default(false).describe('Tax exempt status')
});

// Employee Schema
export const EmployeeSchema = z.object({
  name: createStringSchema(2, 255).describe('Employee name'),
  email: createEmailSchema().describe('Employee email'),
  phone: createStringSchema(10, 20, /^[+]?[0-9\s\-\(\)]+$/).describe('Employee phone'),
  position: createStringSchema(2, 100).describe('Employee position'),
  department: createStringSchema(2, 100).describe('Employee department'),
  hire_date: z.string().datetime().describe('Hire date'),
  salary: createPriceSchema().optional().describe('Employee salary'),
  status: z.enum(['active', 'inactive', 'terminated']).default('active').describe('Employee status'),
  manager_id: z.number().int().positive().optional().describe('Manager ID'),
  address: createStringSchema(0, 500).optional().describe('Employee address'),
  emergency_contact: createStringSchema(0, 255).optional().describe('Emergency contact'),
  emergency_phone: createStringSchema(10, 20, /^[+]?[0-9\s\-\(\)]+$/).optional().describe('Emergency phone')
});

// Stock Movement Schema
export const StockMovementSchema = z.object({
  product_id: z.number().int().positive().describe('Product ID'),
  movement_type: z.enum(['in', 'out', 'adjustment', 'transfer']).describe('Movement type'),
  quantity: z.number().int().min(1).max(1000000).describe('Movement quantity'),
  reason: createStringSchema(5, 255).describe('Movement reason'),
  reference: createStringSchema(0, 100).optional().describe('Reference number'),
  notes: createStringSchema(0, 1000).optional().describe('Additional notes'),
  created_by: z.number().int().positive().describe('Created by user ID')
});

// Sale Schema
export const SaleSchema = z.object({
  customer_id: z.number().int().positive().optional().describe('Customer ID'),
  sale_date: z.string().datetime().describe('Sale date'),
  subtotal: createPriceSchema().describe('Subtotal amount'),
  tax_amount: createPriceSchema().describe('Tax amount'),
  discount_amount: createPriceSchema().default(0).describe('Discount amount'),
  total_amount: createPriceSchema().describe('Total amount'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'other']).describe('Payment method'),
  payment_status: z.enum(['pending', 'paid', 'partial', 'refunded']).default('paid').describe('Payment status'),
  notes: createStringSchema(0, 1000).optional().describe('Sale notes'),
  created_by: z.number().int().positive().describe('Created by user ID')
}).refine(data => data.total_amount === data.subtotal + data.tax_amount - data.discount_amount, {
  message: 'Total amount must equal subtotal + tax - discount',
  path: ['total_amount']
});

// Sale Item Schema
export const SaleItemSchema = z.object({
  sale_id: z.number().int().positive().describe('Sale ID'),
  product_id: z.number().int().positive().describe('Product ID'),
  quantity: createQuantitySchema().min(1).describe('Item quantity'),
  unit_price: createPriceSchema().describe('Unit price'),
  discount_amount: createPriceSchema().default(0).describe('Item discount'),
  total_amount: createPriceSchema().describe('Item total')
}).refine(data => data.total_amount === (data.quantity * data.unit_price) - data.discount_amount, {
  message: 'Total amount must equal (quantity × unit price) - discount',
  path: ['total_amount']
});

// File Upload Schema
export const FileUploadSchema = z.object({
  filename: createStringSchema(1, 255).describe('Filename'),
  size: z.number().int().min(1).max(PRODUCTION_CONFIG.fileUpload.maxFileSize).describe('File size'),
  type: z.string().refine(
    (type) => PRODUCTION_CONFIG.fileUpload.allowedTypes.includes(type),
    { message: 'File type not allowed' }
  ).describe('File type')
});

// Authentication Schemas
export const LoginSchema = z.object({
  email: createEmailSchema().describe('User email'),
  password: z.string().min(1, 'Password is required').max(128).describe('User password'),
  remember_me: z.boolean().optional().default(false).describe('Remember login')
});

export const RegisterSchema = z.object({
  name: createStringSchema(2, 255).describe('Full name'),
  email: createEmailSchema().describe('Email address'),
  password: createPasswordSchema().describe('Password'),
  confirm_password: z.string().describe('Confirm password'),
  role: z.enum(['GeneralUser', 'Administrator']).default('GeneralUser').describe('User role'),
  terms_accepted: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  }).describe('Terms acceptance')
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password']
});

// Query Parameters Schema
export const QueryParamsSchema = z.object({
  page: z.number().int().min(1).default(1).describe('Page number'),
  pageSize: z.number().int().min(1).max(PRODUCTION_CONFIG.ui.maxPageSize).default(PRODUCTION_CONFIG.ui.defaultPageSize).describe('Page size'),
  search: createStringSchema(0, 255).optional().describe('Search query'),
  sortBy: createStringSchema(0, 50).optional().describe('Sort field'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('Sort order')
});

// Validation helper functions
export const validateProduct = (data: any) => {
  try {
    const result = ProductSchema.safeParse(data);
    logger.logInfo('Product validation', { success: result.success, data });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Product validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateCategory = (data: any) => {
  try {
    const result = CategorySchema.safeParse(data);
    logger.logInfo('Category validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Category validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateCustomer = (data: any) => {
  try {
    const result = CustomerSchema.safeParse(data);
    logger.logInfo('Customer validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Customer validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateEmployee = (data: any) => {
  try {
    const result = EmployeeSchema.safeParse(data);
    logger.logInfo('Employee validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Employee validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateStockMovement = (data: any) => {
  try {
    const result = StockMovementSchema.safeParse(data);
    logger.logInfo('Stock movement validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Stock movement validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateSale = (data: any) => {
  try {
    const result = SaleSchema.safeParse(data);
    logger.logInfo('Sale validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Sale validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateSaleItem = (data: any) => {
  try {
    const result = SaleItemSchema.safeParse(data);
    logger.logInfo('Sale item validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Sale item validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateFileUpload = (data: any) => {
  try {
    const result = FileUploadSchema.safeParse(data);
    logger.logInfo('File upload validation', { success: result.success });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('File upload validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateLogin = (data: any) => {
  try {
    const result = LoginSchema.safeParse(data);
    logger.logSecurityEvent('Login validation', { success: result.success, email: data.email });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Login validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateRegister = (data: any) => {
  try {
    const result = RegisterSchema.safeParse(data);
    logger.logSecurityEvent('Registration validation', { success: result.success, email: data.email });
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Registration validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

export const validateQueryParams = (data: any) => {
  try {
    const result = QueryParamsSchema.safeParse(data);
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error.errors.map(e => e.message).join(', ') };
  } catch (error) {
    logger.logError('Query params validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

// Generic validation function
export const validateWithSchema = <T>(schema: z.ZodSchema<T>, data: any): { success: boolean; data?: T; error?: string } => {
  try {
    const result = schema.safeParse(data);
    return result.success 
      ? { success: true, data: result.data }
      : { success: false, error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
  } catch (error) {
    logger.logError('Generic validation error', error);
    return { success: false, error: 'Validation failed' };
  }
};

// Export all schemas for external use
export const schemas = {
  ProductSchema,
  CategorySchema,
  CustomerSchema,
  EmployeeSchema,
  StockMovementSchema,
  SaleSchema,
  SaleItemSchema,
  FileUploadSchema,
  LoginSchema,
  RegisterSchema,
  QueryParamsSchema
};

export default schemas;