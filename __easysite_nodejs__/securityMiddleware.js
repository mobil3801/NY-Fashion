
const crypto = require('crypto');

function createSecurityMiddleware(options = {}) {
  const {
    rateLimitWindowMs = 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests = 1000,
    enableDDoSProtection = true,
    enableInputSanitization = true,
    logSecurityEvents = true
  } = options;

  // In-memory stores for rate limiting (in production, use Redis)
  const rateLimitStore = new Map();
  const suspiciousIPs = new Map();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    // Clean expired entries
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    // Clean expired suspicious IPs
    for (const [ip, data] of suspiciousIPs.entries()) {
      if (data.blockUntil && now > data.blockUntil) {
        suspiciousIPs.delete(ip);
      }
    }
  }, 60000); // Run every minute

  function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.connection?.socket?.remoteAddress ||
           '127.0.0.1';
  }

  function generateNonce() {
    return crypto.randomBytes(16).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>\"'&]/g, (match) => {
        const map = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return map[match];
      });
  }

  function detectSQLInjection(input) {
    if (typeof input !== 'string') return false;
    
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
      /(--|\/\*|\*\/|xp_|sp_)/i,
      /(\b(OR|AND)\s+\w+\s*=\s*\w+)/i,
      /(\'\s*(OR|AND|SELECT|INSERT|UPDATE|DELETE))/i
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  function detectXSS(input) {
    if (typeof input !== 'string') return false;
    
    const patterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  function checkRateLimit(ip, endpoint = '') {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    
    // Check if IP is blocked due to suspicious activity
    const suspicious = suspiciousIPs.get(ip);
    if (suspicious?.blockUntil && now < suspicious.blockUntil) {
      return {
        success: false,
        blocked: true,
        retryAfter: Math.ceil((suspicious.blockUntil - now) / 1000)
      };
    }
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + rateLimitWindowMs,
        firstRequest: now
      };
    }
    
    entry.count++;
    
    // DDoS detection
    if (enableDDoSProtection) {
      const requestRate = entry.count / ((now - entry.firstRequest) / 1000);
      
      if (requestRate > 50) { // Very high request rate
        const blockDuration = 60 * 60 * 1000; // 1 hour
        suspiciousIPs.set(ip, {
          violations: (suspicious?.violations || 0) + 1,
          lastViolation: now,
          blockUntil: now + blockDuration
        });
        
        logSecurityEvent('ddos_detected', {
          ip,
          requestRate,
          blockDuration,
          severity: 'critical'
        });
        
        return {
          success: false,
          blocked: true,
          retryAfter: Math.ceil(blockDuration / 1000)
        };
      }
    }
    
    const exceeded = entry.count > rateLimitMaxRequests;
    rateLimitStore.set(key, entry);
    
    if (exceeded) {
      logSecurityEvent('rate_limit_exceeded', {
        ip,
        endpoint,
        count: entry.count,
        limit: rateLimitMaxRequests
      });
    }
    
    return {
      success: !exceeded,
      limit: rateLimitMaxRequests,
      current: entry.count,
      remaining: Math.max(0, rateLimitMaxRequests - entry.count),
      resetTime: entry.resetTime,
      blocked: false
    };
  }

  function logSecurityEvent(type, details) {
    if (!logSecurityEvents) return;
    
    const event = {
      timestamp: new Date().toISOString(),
      type,
      details,
      severity: details.severity || 'medium'
    };
    
    console.warn(`[SECURITY EVENT] ${type}:`, event);
    
    // In production, send to security monitoring service
    // await sendToSecurityService(event);
  }

  function validateAndSanitizeInput(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = {};
    const violations = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Check for security violations
        if (detectSQLInjection(value)) {
          violations.push({ field: key, type: 'sql_injection', value: value.substring(0, 50) });
        }
        if (detectXSS(value)) {
          violations.push({ field: key, type: 'xss_attempt', value: value.substring(0, 50) });
        }
        
        // Sanitize the value
        if (enableInputSanitization) {
          sanitized[key] = sanitizeInput(value);
        } else {
          sanitized[key] = value;
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return { sanitized, violations };
  }

  // Main middleware function
  return {
    securityHeaders: (req, res, next) => {
      const nonce = generateNonce();
      req.cspNonce = nonce;

      // Security headers
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), gyroscope=(), magnetometer=(), payment=()');
      
      // HSTS (only if HTTPS)
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
      
      // CSP
      const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' https://easysite.ai`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https: ws: wss:",
        "frame-src 'none'",
        "object-src 'none'",
        "worker-src 'self' blob:"
      ].join('; ');
      
      res.setHeader('Content-Security-Policy', cspDirectives);
      res.setHeader('X-CSP-Nonce', nonce);

      next();
    },

    rateLimit: (req, res, next) => {
      const ip = getClientIP(req);
      const endpoint = req.path;
      
      const result = checkRateLimit(ip, endpoint);
      
      if (!result.success) {
        if (result.blocked) {
          logSecurityEvent('ip_blocked', {
            ip,
            endpoint,
            retryAfter: result.retryAfter,
            reason: 'Rate limit exceeded or suspicious activity'
          });
        }
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter || Math.ceil((result.resetTime - Date.now()) / 1000)
        });
        return;
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

      next();
    },

    inputValidation: (req, res, next) => {
      const ip = getClientIP(req);
      
      if (req.body) {
        const { sanitized, violations } = validateAndSanitizeInput(req.body);
        
        if (violations.length > 0) {
          violations.forEach(violation => {
            logSecurityEvent('input_violation', {
              ip,
              endpoint: req.path,
              field: violation.field,
              type: violation.type,
              value: violation.value,
              severity: 'high'
            });
          });
          
          // Block the request
          res.status(400).json({
            error: 'Invalid input detected',
            code: 'SECURITY_VIOLATION'
          });
          return;
        }
        
        req.body = sanitized;
      }
      
      // Validate query parameters
      if (req.query) {
        const { sanitized, violations } = validateAndSanitizeInput(req.query);
        
        if (violations.length > 0) {
          violations.forEach(violation => {
            logSecurityEvent('query_violation', {
              ip,
              endpoint: req.path,
              field: violation.field,
              type: violation.type,
              value: violation.value,
              severity: 'medium'
            });
          });
        }
        
        req.query = sanitized;
      }

      next();
    },

    auditLog: (req, res, next) => {
      const ip = getClientIP(req);
      const startTime = Date.now();
      
      // Log the request
      logSecurityEvent('api_request', {
        ip,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer,
        timestamp: new Date().toISOString(),
        severity: 'info'
      });
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        logSecurityEvent('api_response', {
          ip,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date().toISOString(),
          severity: res.statusCode >= 400 ? 'warning' : 'info'
        });
        
        originalEnd.call(this, chunk, encoding);
      };

      next();
    },

    // Utility functions
    utils: {
      generateNonce,
      sanitizeInput,
      detectSQLInjection,
      detectXSS,
      checkRateLimit: (ip, endpoint) => checkRateLimit(ip, endpoint),
      getSecurityStats: () => ({
        rateLimitEntries: rateLimitStore.size,
        suspiciousIPs: suspiciousIPs.size,
        blockedIPs: Array.from(suspiciousIPs.values()).filter(data => 
          data.blockUntil && Date.now() < data.blockUntil
        ).length
      })
    },

    // Cleanup function
    destroy: () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      rateLimitStore.clear();
      suspiciousIPs.clear();
    }
  };
}

module.exports = createSecurityMiddleware;
