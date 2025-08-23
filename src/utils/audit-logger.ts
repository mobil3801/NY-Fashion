
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import { globalCache } from '@/utils/enhanced-cache';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLog {
  id: string;
  timestamp: number;
  userId?: string;
  userName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  success: boolean;
  error?: string;
  duration?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AuditConfig {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  retentionDays: number;
  sensitiveFields: string[];
  excludeActions: string[];
}

class AuditLogger {
  private logs: AuditLog[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private config: AuditConfig;

  constructor(config?: Partial<AuditConfig>) {
    this.config = {
      enabled: PRODUCTION_CONFIG.enableAuditLogging,
      bufferSize: 100,
      flushInterval: 30000, // 30 seconds
      retentionDays: 90,
      sensitiveFields: ['password', 'token', 'ssn', 'creditCard', 'bankAccount'],
      excludeActions: ['view', 'list', 'search'],
      ...config
    };

    if (this.config.enabled) {
      this.startPeriodicFlush();
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimeout = setInterval(() => {
      this.flushLogs();
    }, this.config.flushInterval);
  }

  log(auditData: Partial<AuditLog>): void {
    if (!this.config.enabled) return;

    // Skip excluded actions
    if (auditData.action && this.config.excludeActions.includes(auditData.action)) {
      return;
    }

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action: 'unknown',
      resource: 'unknown',
      details: {},
      success: true,
      severity: 'low',
      ip: this.getClientIP(),
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId(),
      ...auditData
    };

    // Sanitize sensitive data
    auditLog.details = this.sanitizeData(auditLog.details);

    // Determine severity based on action and resource
    auditLog.severity = this.calculateSeverity(auditLog);

    this.logs.push(auditLog);

    // Log to console/external systems for critical actions
    if (auditLog.severity === 'critical' || !auditLog.success) {
      logger.logInfo('Critical audit event', {
        action: auditLog.action,
        resource: auditLog.resource,
        userId: auditLog.userId,
        success: auditLog.success,
        error: auditLog.error
      });
    }

    // Flush if buffer is full
    if (this.logs.length >= this.config.bufferSize) {
      this.flushLogs();
    }
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };

    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Deep sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  private calculateSeverity(auditLog: AuditLog): 'low' | 'medium' | 'high' | 'critical' {
    // Critical actions
    const criticalActions = ['delete', 'purge', 'reset', 'disable', 'suspend'];
    const criticalResources = ['user', 'employee', 'financial', 'security'];

    if (criticalActions.includes(auditLog.action) || criticalResources.includes(auditLog.resource)) {
      return 'critical';
    }

    // High severity actions
    const highActions = ['create', 'update', 'modify', 'grant', 'revoke'];
    const highResources = ['payment', 'inventory', 'payroll'];

    if (highActions.includes(auditLog.action) || highResources.includes(auditLog.resource)) {
      return 'high';
    }

    // Medium severity actions
    const mediumActions = ['login', 'logout', 'access', 'export', 'import'];

    if (mediumActions.includes(auditLog.action)) {
      return 'medium';
    }

    return 'low';
  }

  private getClientIP(): string {
    // In a real application, this would get the actual client IP
    return '0.0.0.0';
  }

  private getSessionId(): string {
    return globalCache.get('sessionId') || 'no-session';
  }

  private async flushLogs(): Promise<void> {
    if (this.logs.length === 0) return;

    const logsToFlush = [...this.logs];
    this.logs = [];

    try {
      // In a real application, send to external audit system
      // For now, just log and store locally
      logger.logInfo('Audit logs flushed', {
        count: logsToFlush.length,
        timestamp: Date.now()
      });

      // Store in localStorage as backup (for demo purposes)
      const existingLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      const allLogs = [...existingLogs, ...logsToFlush];

      // Keep only logs within retention period
      const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
      const validLogs = allLogs.filter((log) => log.timestamp > cutoff);

      localStorage.setItem('auditLogs', JSON.stringify(validLogs.slice(-1000))); // Keep last 1000 logs

    } catch (error) {
      logger.logError('Failed to flush audit logs', error);
      // Re-add logs to buffer if flush failed
      this.logs = [...logsToFlush, ...this.logs];
    }
  }

  // Public methods for different types of audit events
  logUserAction(action: string, resource: string, details: Record<string, any> = {}, success: boolean = true, error?: string): void {
    this.log({
      action,
      resource,
      details,
      success,
      error
    });
  }

  logSecurityEvent(action: string, details: Record<string, any> = {}, success: boolean = true): void {
    this.log({
      action,
      resource: 'security',
      details,
      success,
      severity: 'critical'
    });
  }

  logDataAccess(resource: string, resourceId: string, action: string = 'access', details: Record<string, any> = {}): void {
    this.log({
      action,
      resource,
      resourceId,
      details,
      severity: 'medium'
    });
  }

  logFinancialTransaction(action: string, details: Record<string, any>, success: boolean = true, error?: string): void {
    this.log({
      action,
      resource: 'financial',
      details,
      success,
      error,
      severity: 'critical'
    });
  }

  logSystemEvent(action: string, details: Record<string, any>, success: boolean = true): void {
    this.log({
      action,
      resource: 'system',
      details,
      success,
      severity: success ? 'low' : 'high'
    });
  }

  // Query methods
  getLogs(filter?: Partial<AuditLog>, limit: number = 100): AuditLog[] {
    try {
      const storedLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      let filteredLogs = [...this.logs, ...storedLogs];

      if (filter) {
        filteredLogs = filteredLogs.filter((log) => {
          return Object.keys(filter).every((key) => {
            return log[key as keyof AuditLog] === filter[key as keyof AuditLog];
          });
        });
      }

      return filteredLogs.
      sort((a, b) => b.timestamp - a.timestamp).
      slice(0, limit);
    } catch (error) {
      logger.logError('Failed to get audit logs', error);
      return [];
    }
  }

  getLogsByUser(userId: string, limit: number = 50): AuditLog[] {
    return this.getLogs({ userId }, limit);
  }

  getLogsByResource(resource: string, limit: number = 50): AuditLog[] {
    return this.getLogs({ resource }, limit);
  }

  getLogsBySeverity(severity: AuditLog['severity'], limit: number = 50): AuditLog[] {
    return this.getLogs({ severity }, limit);
  }

  getFailedLogs(limit: number = 50): AuditLog[] {
    return this.getLogs({ success: false }, limit);
  }

  // Analytics
  getAuditStatistics(hours: number = 24): {
    totalEvents: number;
    successRate: number;
    topActions: Array<{action: string;count: number;}>;
    topResources: Array<{resource: string;count: number;}>;
    severityBreakdown: Record<string, number>;
    errorBreakdown: Array<{error: string;count: number;}>;
  } {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recentLogs = this.getLogs({}, 1000).filter((log) => log.timestamp > cutoff);

    const stats = {
      totalEvents: recentLogs.length,
      successRate: recentLogs.length > 0 ? recentLogs.filter((l) => l.success).length / recentLogs.length * 100 : 100,
      topActions: this.getTopItems(recentLogs, 'action'),
      topResources: this.getTopItems(recentLogs, 'resource'),
      severityBreakdown: this.getBreakdown(recentLogs, 'severity'),
      errorBreakdown: this.getErrorBreakdown(recentLogs)
    };

    return stats;
  }

  private getTopItems(logs: AuditLog[], field: keyof AuditLog): Array<{[key: string]: any;count: number;}> {
    const counts = logs.reduce((acc, log) => {
      const value = log[field] as string;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).
    map(([key, count]) => ({ [field]: key, count })).
    sort((a, b) => b.count - a.count).
    slice(0, 10);
  }

  private getBreakdown(logs: AuditLog[], field: keyof AuditLog): Record<string, number> {
    return logs.reduce((acc, log) => {
      const value = log[field] as string;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getErrorBreakdown(logs: AuditLog[]): Array<{error: string;count: number;}> {
    const errorLogs = logs.filter((l) => !l.success && l.error);
    const counts = errorLogs.reduce((acc, log) => {
      const error = log.error || 'Unknown error';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).
    map(([error, count]) => ({ error, count })).
    sort((a, b) => b.count - a.count).
    slice(0, 10);
  }

  destroy(): void {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    this.flushLogs();
    this.logs = [];
    logger.logInfo('Audit logger destroyed');
  }
}

// Global audit logger instance
export const auditLogger = new AuditLogger();

// React hook for audit logging
export const useAuditLogger = () => {
  const { user } = useAuth();

  const logUserAction = React.useCallback((
  action: string,
  resource: string,
  details: Record<string, any> = {},
  success: boolean = true,
  error?: string) =>
  {
    auditLogger.log({
      action,
      resource,
      details,
      success,
      error,
      userId: user?.ID?.toString(),
      userName: user?.Name
    });
  }, [user]);

  const logSecurityEvent = React.useCallback((
  action: string,
  details: Record<string, any> = {},
  success: boolean = true) =>
  {
    auditLogger.logSecurityEvent(action, {
      ...details,
      userId: user?.ID?.toString(),
      userName: user?.Name
    }, success);
  }, [user]);

  const logDataAccess = React.useCallback((
  resource: string,
  resourceId: string,
  action: string = 'access',
  details: Record<string, any> = {}) =>
  {
    auditLogger.logDataAccess(resource, resourceId, action, {
      ...details,
      userId: user?.ID?.toString(),
      userName: user?.Name
    });
  }, [user]);

  return {
    logUserAction,
    logSecurityEvent,
    logDataAccess,
    getLogs: auditLogger.getLogs.bind(auditLogger),
    getStatistics: auditLogger.getAuditStatistics.bind(auditLogger)
  };
};

export default auditLogger;