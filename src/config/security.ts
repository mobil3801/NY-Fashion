
export interface SecurityConfig {
  csp: {
    enabled: boolean;
    reportUri?: string;
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      frameSrc: string[];
      mediaSrc: string[];
      objectSrc: string[];
      workerSrc: string[];
    };
  };
  headers: {
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    frameOptions: string;
    contentTypeOptions: boolean;
    referrerPolicy: string;
    xssProtection: string;
    permissionsPolicy: string;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  cors: {
    enabled: boolean;
    origin: string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  csp: {
    enabled: true,
    reportUri: '/security/csp-report',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{nonce}'", 'https://easysite.ai'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:', 'https://newoaks.s3.us-west-1.amazonaws.com'],
      connectSrc: ["'self'", 'https:', 'ws:', 'wss:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'none'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      workerSrc: ["'self'", 'blob:']
    }
  },
  headers: {
    hsts: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    xssProtection: '1; mode=block',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=(), gyroscope=(), magnetometer=(), payment=()'
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false
  },
  cors: {
    enabled: true,
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:8080', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSP-Nonce', 'Idempotency-Key'],
    credentials: true
  }
};

export const getSecurityConfig = (): SecurityConfig => {
  // Allow runtime configuration override
  return {
    ...defaultSecurityConfig,
    // Override with environment variables if needed
    csp: {
      ...defaultSecurityConfig.csp,
      enabled: process.env.CSP_ENABLED !== 'false'
    },
    rateLimit: {
      ...defaultSecurityConfig.rateLimit,
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000')
    }
  };
};