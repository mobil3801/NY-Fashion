/**
 * Secure Authentication Manager
 * Implements additional security measures for authentication system
 * Removes test bypasses and enforces secure authentication practices
 */

import { SECURITY_CONFIG } from '@/config/security';
import { logger } from '@/utils/production-logger';

export interface SecureAuthConfig {
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  requireMFA: boolean;
  passwordStrengthRules: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

class SecureAuthManager {
  private config: SecureAuthConfig;
  private failedAttempts: Map<string, {count: number;lastAttempt: number;lockedUntil?: number;}> = new Map();
  private activeSessions: Map<string, {userId: string;createdAt: number;lastActivity: number;}> = new Map();

  constructor(config: SecureAuthConfig) {
    this.config = config;
    this.initializeSecurityMeasures();
  }

  /**
   * Initialize security measures
   */
  private initializeSecurityMeasures(): void {
    this.removeTestAuthenticationBypasses();
    this.setupSessionMonitoring();
    this.auditExistingAuthentication();
  }

  /**
   * Remove any test authentication bypasses
   * This is critical for production security
   */
  private removeTestAuthenticationBypasses(): void {
    // Remove any global test credentials
    if (typeof window !== 'undefined') {
      delete (window as any).testCredentials;
      delete (window as any).bypassAuth;
      delete (window as any).adminAccess;
      delete (window as any).debugAuth;
    }

    // Clear any localStorage test tokens
    if (typeof localStorage !== 'undefined') {
      const testKeys = [
      'test_token',
      'dev_token',
      'bypass_token',
      'admin_bypass',
      'test_user',
      'demo_mode'];


      testKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          logger.logSecurityEvent('test_bypass_removed', 'AUTH', 'HIGH', undefined, { removedKey: key });
        }
      });
    }

    // Remove hardcoded test users from any arrays/objects
    this.removeHardcodedCredentials();

    logger.logSecurityEvent('authentication_bypasses_removed', 'AUTH', 'INFO');
  }

  /**
   * Remove hardcoded credentials that might exist in the codebase
   */
  private removeHardcodedCredentials(): void {
    // This function audits for common hardcoded credential patterns
    const suspiciousPatterns = [
    /test@test\.com/gi,
    /admin@admin\.com/gi,
    /demo@demo\.com/gi,
    /password123/gi,
    /admin123/gi,
    /test123/gi];


    // Log if any suspicious patterns are found in memory
    const memoryDump = JSON.stringify(window);
    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(memoryDump)) {
        logger.logSecurityEvent('suspicious_credential_pattern', 'AUTH', 'HIGH', undefined, {
          pattern: pattern.source
        });
      }
    });
  }

  /**
   * Setup session monitoring
   */
  private setupSessionMonitoring(): void {
    // Monitor session timeouts
    setInterval(() => {
      this.checkSessionTimeouts();
    }, 60000); // Check every minute

    // Monitor for concurrent sessions
    setInterval(() => {
      this.auditConcurrentSessions();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Audit existing authentication state
   */
  private auditExistingAuthentication(): void {
    // Check for existing tokens
    if (typeof localStorage !== 'undefined') {
      const authKeys = Object.keys(localStorage).filter((key) =>
      key.includes('token') ||
      key.includes('auth') ||
      key.includes('session')
      );

      authKeys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value) {
          logger.logSecurityEvent('existing_auth_token_found', 'AUTH', 'INFO', undefined, {
            key,
            hasValue: !!value,
            valueLength: value.length
          });
        }
      });
    }
  }

  /**
   * Validate login attempt with enhanced security
   */
  validateLoginAttempt(email: string, ip?: string): {allowed: boolean;reason?: string;waitTime?: number;} {
    const identifier = ip || email;
    const attempts = this.failedAttempts.get(identifier);

    if (!attempts) {
      return { allowed: true };
    }

    // Check if locked out
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const waitTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      return {
        allowed: false,
        reason: 'Account temporarily locked due to failed login attempts',
        waitTime
      };
    }

    // Check if too many attempts
    if (attempts.count >= this.config.maxLoginAttempts) {
      const lockUntil = Date.now() + this.config.lockoutDuration;
      this.failedAttempts.set(identifier, {
        ...attempts,
        lockedUntil: lockUntil
      });

      logger.logSecurityEvent('account_locked', 'AUTH', 'HIGH', undefined, {
        identifier,
        attempts: attempts.count,
        lockDuration: this.config.lockoutDuration
      });

      return {
        allowed: false,
        reason: 'Account locked due to too many failed attempts',
        waitTime: Math.ceil(this.config.lockoutDuration / 1000)
      };
    }

    return { allowed: true };
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(email: string, ip?: string): void {
    const identifier = ip || email;
    const existing = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: 0 };

    this.failedAttempts.set(identifier, {
      count: existing.count + 1,
      lastAttempt: Date.now(),
      lockedUntil: existing.lockedUntil
    });

    logger.logSecurityEvent('failed_login_attempt', 'AUTH', 'WARNING', undefined, {
      identifier,
      attemptCount: existing.count + 1,
      maxAttempts: this.config.maxLoginAttempts
    });
  }

  /**
   * Clear failed attempts on successful login
   */
  clearFailedAttempts(email: string, ip?: string): void {
    const identifier = ip || email;
    if (this.failedAttempts.has(identifier)) {
      this.failedAttempts.delete(identifier);
      logger.logSecurityEvent('failed_attempts_cleared', 'AUTH', 'INFO', undefined, { identifier });
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {isValid: boolean;errors: string[];} {
    const errors: string[] = [];
    const rules = this.config.passwordStrengthRules;

    if (password.length < rules.minLength) {
      errors.push(`Password must be at least ${rules.minLength} characters long`);
    }

    if (rules.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (rules.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (rules.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (rules.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if password is commonly used
   */
  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'password1', 'admin', 'letmein', 'welcome',
    'monkey', '1234567890', 'dragon', 'master', 'login'];


    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Register new session
   */
  registerSession(sessionId: string, userId: string): void {
    this.activeSessions.set(sessionId, {
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    logger.logSecurityEvent('session_created', 'AUTH', 'INFO', userId, {
      sessionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * Check session timeouts
   */
  private checkSessionTimeouts(): void {
    const now = Date.now();
    const timeoutThreshold = now - this.config.sessionTimeout;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastActivity < timeoutThreshold) {
        this.activeSessions.delete(sessionId);
        logger.logSecurityEvent('session_timeout', 'AUTH', 'INFO', session.userId, {
          sessionId,
          lastActivity: new Date(session.lastActivity).toISOString()
        });
      }
    }
  }

  /**
   * Audit concurrent sessions
   */
  private auditConcurrentSessions(): void {
    const userSessions = new Map<string, string[]>();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (!userSessions.has(session.userId)) {
        userSessions.set(session.userId, []);
      }
      userSessions.get(session.userId)?.push(sessionId);
    }

    // Log users with multiple sessions
    for (const [userId, sessions] of userSessions.entries()) {
      if (sessions.length > 1) {
        logger.logSecurityEvent('concurrent_sessions_detected', 'AUTH', 'INFO', userId, {
          sessionCount: sessions.length,
          sessions
        });
      }
    }
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      logger.logSecurityEvent('session_removed', 'AUTH', 'INFO', session.userId, {
        sessionId
      });
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalFailedAttempts: number;
    lockedAccounts: number;
    activeSessions: number;
    suspiciousActivity: number;
  } {
    let lockedAccounts = 0;
    let totalFailedAttempts = 0;

    for (const attempts of this.failedAttempts.values()) {
      totalFailedAttempts += attempts.count;
      if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        lockedAccounts++;
      }
    }

    return {
      totalFailedAttempts,
      lockedAccounts,
      activeSessions: this.activeSessions.size,
      suspiciousActivity: 0 // Would implement actual suspicious activity detection
    };
  }
}

// Create and export singleton instance
export const secureAuthManager = new SecureAuthManager({
  maxLoginAttempts: SECURITY_CONFIG.authentication.maxLoginAttempts,
  lockoutDuration: SECURITY_CONFIG.authentication.lockoutDuration,
  sessionTimeout: SECURITY_CONFIG.authentication.sessionTimeout,
  requireMFA: false, // Can be enabled later
  passwordStrengthRules: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
});

export default secureAuthManager;