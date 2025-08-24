
import DOMPurify from 'dompurify';

export interface ValidationRule {
  type: 'string' | 'number' | 'email' | 'url' | 'phone' | 'date' | 'boolean' | 'array' | 'object' | 'custom';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
  sanitize?: boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
  sanitizedData?: any;
}

class SecurityValidator {
  private sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
    /(\b(OR|AND)\s+\w+\s*=\s*\w+)/i,
    /(\b\d+\s*=\s*\d+)/i,
    /(INFORMATION_SCHEMA|sysobjects|syscolumns)/i
  ];

  private xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi
  ];

  private commandInjectionPatterns = [
    /[;&|`$(){}[\]\\]/g,
    /(rm|wget|curl|nc|telnet|ssh|ftp|scp)/i,
    /(\.\.|\/etc\/|\/bin\/|\/usr\/)/i
  ];

  sanitizeString(input: string, options: { allowHtml?: boolean; maxLength?: number } = {}): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // HTML sanitization
    if (options.allowHtml) {
      // Use DOMPurify for safe HTML
      if (typeof window !== 'undefined' && window.DOMPurify) {
        sanitized = window.DOMPurify.sanitize(sanitized, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
          ALLOWED_ATTR: []
        });
      }
    } else {
      // Escape HTML characters
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    return sanitized;
  }

  detectSQLInjection(input: string): boolean {
    return this.sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  detectXSS(input: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(input));
  }

  detectCommandInjection(input: string): boolean {
    return this.commandInjectionPatterns.some(pattern => pattern.test(input));
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone);
  }

  validateDate(date: string): boolean {
    const parsed = Date.parse(date);
    return !isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === date.slice(0, 10);
  }

  sanitizeField(value: any, rule: ValidationRule): any {
    if (!rule.sanitize) return value;

    switch (rule.type) {
      case 'string':
        return this.sanitizeString(String(value), { maxLength: rule.max });
      
      case 'email':
        return this.sanitizeString(String(value), { maxLength: 254 }).toLowerCase();
      
      case 'number':
        const num = Number(value);
        if (isNaN(num)) return 0;
        if (rule.min !== undefined && num < rule.min) return rule.min;
        if (rule.max !== undefined && num > rule.max) return rule.max;
        return num;
      
      case 'boolean':
        return Boolean(value);
      
      case 'array':
        return Array.isArray(value) ? value : [];
      
      case 'object':
        return typeof value === 'object' && value !== null ? value : {};
      
      default:
        return value;
    }
  }

  validateField(value: any, rule: ValidationRule, fieldName: string): string | null {
    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      return `${fieldName} is required`;
    }

    // Skip further validation if optional and empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return null;
    }

    // Type validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`;
        }
        if (rule.min && value.length < rule.min) {
          return `${fieldName} must be at least ${rule.min} characters`;
        }
        if (rule.max && value.length > rule.max) {
          return `${fieldName} must be no more than ${rule.max} characters`;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          return `${fieldName} format is invalid`;
        }
        
        // Security checks
        if (this.detectSQLInjection(value)) {
          return `${fieldName} contains potentially dangerous content`;
        }
        if (this.detectXSS(value)) {
          return `${fieldName} contains potentially dangerous content`;
        }
        if (this.detectCommandInjection(value)) {
          return `${fieldName} contains potentially dangerous content`;
        }
        break;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          return `${fieldName} must be a number`;
        }
        if (rule.min !== undefined && num < rule.min) {
          return `${fieldName} must be at least ${rule.min}`;
        }
        if (rule.max !== undefined && num > rule.max) {
          return `${fieldName} must be no more than ${rule.max}`;
        }
        break;

      case 'email':
        if (!this.validateEmail(String(value))) {
          return `${fieldName} must be a valid email address`;
        }
        break;

      case 'url':
        if (!this.validateURL(String(value))) {
          return `${fieldName} must be a valid URL`;
        }
        break;

      case 'phone':
        if (!this.validatePhone(String(value))) {
          return `${fieldName} must be a valid phone number`;
        }
        break;

      case 'date':
        if (!this.validateDate(String(value))) {
          return `${fieldName} must be a valid date`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${fieldName} must be a boolean`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`;
        }
        if (rule.min && value.length < rule.min) {
          return `${fieldName} must contain at least ${rule.min} items`;
        }
        if (rule.max && value.length > rule.max) {
          return `${fieldName} must contain no more than ${rule.max} items`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `${fieldName} must be an object`;
        }
        break;

      case 'custom':
        if (rule.customValidator) {
          const result = rule.customValidator(value);
          if (result !== true) {
            return typeof result === 'string' ? result : `${fieldName} is invalid`;
          }
        }
        break;
    }

    return null;
  }

  validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: { field: string; message: string }[] = [];
    const sanitizedData: any = {};

    // Validate each field in schema
    for (const [fieldName, rule] of Object.entries(schema)) {
      const value = data?.[fieldName];
      const error = this.validateField(value, rule, fieldName);
      
      if (error) {
        errors.push({ field: fieldName, message: error });
      }

      // Sanitize the field
      sanitizedData[fieldName] = this.sanitizeField(value, rule);
    }

    // Check for unexpected fields (potential injection attempts)
    if (typeof data === 'object' && data !== null) {
      const allowedFields = new Set(Object.keys(schema));
      const providedFields = Object.keys(data);
      
      for (const field of providedFields) {
        if (!allowedFields.has(field)) {
          errors.push({ 
            field, 
            message: `Unexpected field: ${field}` 
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  // Predefined schemas for common use cases
  static schemas = {
    login: {
      email: { type: 'email' as const, required: true, sanitize: true },
      password: { type: 'string' as const, required: true, min: 8, max: 128 }
    },
    
    register: {
      email: { type: 'email' as const, required: true, sanitize: true },
      password: { type: 'string' as const, required: true, min: 8, max: 128 },
      name: { type: 'string' as const, required: true, min: 2, max: 100, sanitize: true },
      phone: { type: 'phone' as const, required: false, sanitize: true }
    },

    product: {
      name: { type: 'string' as const, required: true, min: 1, max: 255, sanitize: true },
      description: { type: 'string' as const, required: false, max: 2000, sanitize: true },
      price: { type: 'number' as const, required: true, min: 0 },
      category: { type: 'string' as const, required: true, sanitize: true },
      sku: { type: 'string' as const, required: true, pattern: /^[A-Z0-9\-_]+$/, sanitize: true }
    },

    customer: {
      name: { type: 'string' as const, required: true, min: 2, max: 100, sanitize: true },
      email: { type: 'email' as const, required: false, sanitize: true },
      phone: { type: 'phone' as const, required: false, sanitize: true },
      address: { type: 'string' as const, required: false, max: 500, sanitize: true }
    }
  };
}

export const securityValidator = new SecurityValidator();

// React hook for validation
export const useValidation = () => {
  const validate = (data: any, schema: ValidationSchema) => {
    return securityValidator.validate(data, schema);
  };

  const sanitize = (value: any, rule: ValidationRule) => {
    return securityValidator.sanitizeField(value, rule);
  };

  return { validate, sanitize, schemas: SecurityValidator.schemas };
};

// Utility functions
export const sanitizeInput = (input: string, options?: { allowHtml?: boolean; maxLength?: number }) => {
  return securityValidator.sanitizeString(input, options);
};

export const isSecureInput = (input: string): boolean => {
  return !securityValidator.detectSQLInjection(input) &&
         !securityValidator.detectXSS(input) &&
         !securityValidator.detectCommandInjection(input);
};
