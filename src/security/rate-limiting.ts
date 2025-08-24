
import { getSecurityConfig } from '@/config/security';

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  firstRequest: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  blocked: boolean;
  retryAfter?: number;
}

export interface DDoSDetection {
  suspicious: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockDuration?: number;
}

class RateLimitManager {
  private store = new Map<string, RateLimitEntry>();
  private suspiciousIPs = new Map<string, {violations: number;lastViolation: number;blockUntil?: number;}>();
  private config = getSecurityConfig();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean up expired rate limit entries
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }

    // Clean up expired suspicious IP entries
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.blockUntil && now > data.blockUntil) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  private generateKey(identifier: string, endpoint?: string): string {
    return endpoint ? `${identifier}:${endpoint}` : identifier;
  }

  private detectDDoS(identifier: string, entry: RateLimitEntry): DDoSDetection {
    const now = Date.now();
    const requestRate = entry.count / ((now - entry.firstRequest) / 1000); // requests per second

    // High request rate detection
    if (requestRate > 100) {
      return {
        suspicious: true,
        reason: 'Extremely high request rate detected',
        severity: 'critical',
        blockDuration: 24 * 60 * 60 * 1000 // 24 hours
      };
    }

    if (requestRate > 50) {
      return {
        suspicious: true,
        reason: 'Very high request rate detected',
        severity: 'high',
        blockDuration: 60 * 60 * 1000 // 1 hour
      };
    }

    if (requestRate > 20) {
      return {
        suspicious: true,
        reason: 'High request rate detected',
        severity: 'medium',
        blockDuration: 15 * 60 * 1000 // 15 minutes
      };
    }

    // Pattern detection
    const suspicious = this.suspiciousIPs.get(identifier);
    if (suspicious && suspicious.violations >= 3) {
      return {
        suspicious: true,
        reason: 'Multiple rate limit violations',
        severity: 'high',
        blockDuration: 60 * 60 * 1000 // 1 hour
      };
    }

    return { suspicious: false, severity: 'low' };
  }

  private handleSuspiciousActivity(identifier: string, detection: DDoSDetection): void {
    const now = Date.now();
    const existing = this.suspiciousIPs.get(identifier) || { violations: 0, lastViolation: 0 };

    existing.violations++;
    existing.lastViolation = now;

    if (detection.blockDuration) {
      existing.blockUntil = now + detection.blockDuration;
    }

    this.suspiciousIPs.set(identifier, existing);

    // Log security event
    console.warn(`DDoS Detection: ${detection.reason}`, {
      identifier,
      severity: detection.severity,
      violations: existing.violations,
      blockUntil: existing.blockUntil
    });

    // You could send alerts to security monitoring service here
    this.sendSecurityAlert(identifier, detection);
  }

  private sendSecurityAlert(identifier: string, detection: DDoSDetection): void {
    // Implementation for sending alerts to monitoring service
    // This could integrate with services like PagerDuty, Slack, email, etc.
    const alert = {
      type: 'ddos_detection',
      timestamp: new Date().toISOString(),
      identifier,
      severity: detection.severity,
      reason: detection.reason,
      blockDuration: detection.blockDuration
    };

    // For now, just log the alert
    console.error('SECURITY ALERT:', alert);
  }

  checkRateLimit(identifier: string, endpoint?: string, customLimit?: number): RateLimitResult {
    if (!this.config.rateLimit.enabled) {
      return {
        success: true,
        limit: Number.MAX_SAFE_INTEGER,
        current: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        resetTime: Date.now() + this.config.rateLimit.windowMs,
        blocked: false
      };
    }

    const key = this.generateKey(identifier, endpoint);
    const now = Date.now();
    const limit = customLimit || this.config.rateLimit.maxRequests;
    const windowMs = this.config.rateLimit.windowMs;

    // Check if IP is blocked due to suspicious activity
    const suspicious = this.suspiciousIPs.get(identifier);
    if (suspicious?.blockUntil && now < suspicious.blockUntil) {
      return {
        success: false,
        limit,
        current: limit,
        remaining: 0,
        resetTime: suspicious.blockUntil,
        blocked: true,
        retryAfter: Math.ceil((suspicious.blockUntil - now) / 1000)
      };
    }

    let entry = this.store.get(key);

    // Create new entry or reset if window has passed
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        blocked: false,
        firstRequest: now
      };
    }

    entry.count++;

    // Check for DDoS patterns
    const ddosDetection = this.detectDDoS(identifier, entry);
    if (ddosDetection.suspicious) {
      this.handleSuspiciousActivity(identifier, ddosDetection);
      entry.blocked = true;
    }

    // Check if limit exceeded
    const exceeded = entry.count > limit;
    if (exceeded && !entry.blocked) {
      entry.blocked = true;
      this.handleSuspiciousActivity(identifier, {
        suspicious: true,
        reason: 'Rate limit exceeded',
        severity: 'medium',
        blockDuration: 5 * 60 * 1000 // 5 minutes
      });
    }

    this.store.set(key, entry);

    return {
      success: !exceeded && !entry.blocked,
      limit,
      current: entry.count,
      remaining: Math.max(0, limit - entry.count),
      resetTime: entry.resetTime,
      blocked: entry.blocked,
      retryAfter: entry.blocked ? Math.ceil((entry.resetTime - now) / 1000) : undefined
    };
  }

  // Get rate limit status without incrementing
  getRateLimitStatus(identifier: string, endpoint?: string): RateLimitResult {
    const key = this.generateKey(identifier, endpoint);
    const entry = this.store.get(key);
    const limit = this.config.rateLimit.maxRequests;

    if (!entry) {
      return {
        success: true,
        limit,
        current: 0,
        remaining: limit,
        resetTime: Date.now() + this.config.rateLimit.windowMs,
        blocked: false
      };
    }

    return {
      success: entry.count <= limit && !entry.blocked,
      limit,
      current: entry.count,
      remaining: Math.max(0, limit - entry.count),
      resetTime: entry.resetTime,
      blocked: entry.blocked
    };
  }

  // Whitelist an identifier (useful for trusted sources)
  whitelist(identifier: string, duration: number = 24 * 60 * 60 * 1000): void {
    // Remove from suspicious IPs
    this.suspiciousIPs.delete(identifier);

    // Remove all rate limit entries for this identifier
    for (const key of this.store.keys()) {
      if (key.startsWith(identifier)) {
        this.store.delete(key);
      }
    }
  }

  // Get statistics for monitoring
  getStatistics() {
    return {
      totalEntries: this.store.size,
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: Array.from(this.suspiciousIPs.entries()).filter(([_, data]) =>
      data.blockUntil && Date.now() < data.blockUntil
      ).length
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
    this.suspiciousIPs.clear();
  }
}

export const rateLimitManager = new RateLimitManager();

// Utility function to get client identifier
export const getClientIdentifier = (req?: any): string => {
  if (typeof window !== 'undefined') {
    // Client-side - use session storage or generate fingerprint
    const stored = sessionStorage.getItem('client_id');
    if (stored) return stored;

    const clientId = generateClientFingerprint();
    sessionStorage.setItem('client_id', clientId);
    return clientId;
  }

  // Server-side - use IP address and user agent
  if (req) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}:${userAgent.substring(0, 50)}`;
  }

  return 'unknown';
};

function generateClientFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 2, 2);

  const fingerprint = [
  navigator.userAgent,
  navigator.language,
  screen.width + 'x' + screen.height,
  new Date().getTimezoneOffset(),
  canvas.toDataURL()].
  join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}