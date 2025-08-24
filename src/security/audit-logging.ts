
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 'authentication' | 'authorization' | 'data_access' | 'security_violation' | 'system_event' | 'user_action';
  severity: 'info' | 'warning' | 'error' | 'critical';
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  type: 'rate_limit_exceeded' | 'ddos_detected' | 'sql_injection_attempt' | 'xss_attempt' | 'unauthorized_access' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  description: string;
  affectedResource?: string;
  mitigation?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

class SecurityAuditLogger {
  private logs: AuditLogEntry[] = [];
  private alerts: SecurityAlert[] = [];
  private maxLogs = 10000;
  private maxAlerts = 1000;
  private persistenceEnabled = true;

  constructor() {
    this.loadPersistedData();
    this.startPeriodicFlush();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadPersistedData(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const savedLogs = localStorage.getItem('security_audit_logs');
      const savedAlerts = localStorage.getItem('security_alerts');

      if (savedLogs) {
        this.logs = JSON.parse(savedLogs).slice(-this.maxLogs);
      }

      if (savedAlerts) {
        this.alerts = JSON.parse(savedAlerts).slice(-this.maxAlerts);
      }
    } catch (error) {
      console.error('Failed to load persisted security data:', error);
    }
  }

  private persistData(): void {
    if (!this.persistenceEnabled || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem('security_audit_logs', JSON.stringify(this.logs.slice(-this.maxLogs)));
      localStorage.setItem('security_alerts', JSON.stringify(this.alerts.slice(-this.maxAlerts)));
    } catch (error) {
      console.error('Failed to persist security data:', error);
    }
  }

  private startPeriodicFlush(): void {
    // Flush logs to server every 5 minutes
    setInterval(() => {
      this.flushToServer();
    }, 5 * 60 * 1000);

    // Persist to localStorage every minute
    setInterval(() => {
      this.persistData();
    }, 60 * 1000);
  }

  private async flushToServer(): Promise<void> {
    if (this.logs.length === 0 && this.alerts.length === 0) return;

    try {
      // Send logs and alerts to server
      const payload = {
        logs: this.logs,
        alerts: this.alerts.filter(a => !a.resolved),
        timestamp: new Date().toISOString()
      };

      // In a real implementation, you would send to your security monitoring service
      await this.sendToSecurityService(payload);

      // Clear sent logs (keep last 100 for immediate access)
      this.logs = this.logs.slice(-100);
      
    } catch (error) {
      console.error('Failed to flush security logs to server:', error);
    }
  }

  private async sendToSecurityService(payload: any): Promise<void> {
    // Implementation would depend on your security monitoring service
    // Examples: Splunk, ELK Stack, Datadog, New Relic, etc.
    
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Security audit payload:', payload);
    }

    // Example implementation for a REST API:
    /*
    const response = await fetch('/api/security/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send security logs: ${response.statusText}`);
    }
    */
  }

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.logs.push(logEntry);

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Auto-generate alerts for critical events
    if (entry.severity === 'critical' || entry.eventType === 'security_violation') {
      this.createAlert({
        type: this.mapEventTypeToAlertType(entry.eventType, entry.action),
        severity: entry.severity === 'critical' ? 'critical' : 'high',
        source: entry.ipAddress || 'unknown',
        description: `${entry.action}: ${entry.errorMessage || 'Security event detected'}`,
        affectedResource: entry.resource,
        resolved: false
      });
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      const logLevel = entry.severity === 'critical' ? 'error' : 
                      entry.severity === 'error' ? 'error' :
                      entry.severity === 'warning' ? 'warn' : 'log';
      
      console[logLevel](`[SECURITY AUDIT] ${entry.action}:`, logEntry);
    }
  }

  private mapEventTypeToAlertType(eventType: string, action: string): SecurityAlert['type'] {
    if (action.includes('rate limit')) return 'rate_limit_exceeded';
    if (action.includes('ddos') || action.includes('DDoS')) return 'ddos_detected';
    if (action.includes('sql') || action.includes('SQL')) return 'sql_injection_attempt';
    if (action.includes('xss') || action.includes('XSS')) return 'xss_attempt';
    if (eventType === 'authorization') return 'unauthorized_access';
    return 'suspicious_activity';
  }

  createAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved' | 'resolvedAt' | 'resolvedBy'>): void {
    const alertEntry: SecurityAlert = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      resolved: false,
      ...alert
    };

    this.alerts.push(alertEntry);

    // Trim alerts if too many
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Send immediate notification for critical alerts
    if (alert.severity === 'critical') {
      this.sendImmediateAlert(alertEntry);
    }
  }

  private async sendImmediateAlert(alert: SecurityAlert): Promise<void> {
    // Implementation for immediate alerting (email, SMS, Slack, PagerDuty, etc.)
    console.error('[CRITICAL SECURITY ALERT]', alert);
    
    // Example webhook notification:
    /*
    try {
      await fetch('/api/security/alerts/immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send immediate alert:', error);
    }
    */
  }

  resolveAlert(alertId: string, resolvedBy: string, mitigation?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;
    if (mitigation) {
      alert.mitigation = mitigation;
    }

    this.log({
      eventType: 'system_event',
      severity: 'info',
      action: 'Alert resolved',
      success: true,
      details: { alertId, resolvedBy, mitigation },
      resource: 'security_alert'
    });

    return true;
  }

  // Convenience methods for common security events
  logAuthentication(userId: string, success: boolean, details: Record<string, any> = {}): void {
    this.log({
      eventType: 'authentication',
      severity: success ? 'info' : 'warning',
      userId,
      action: success ? 'Login successful' : 'Login failed',
      success,
      details,
      errorMessage: success ? undefined : 'Authentication failed'
    });
  }

  logAuthorization(userId: string, resource: string, action: string, success: boolean, details: Record<string, any> = {}): void {
    this.log({
      eventType: 'authorization',
      severity: success ? 'info' : 'warning',
      userId,
      resource,
      action: `${action} access ${success ? 'granted' : 'denied'}`,
      success,
      details,
      errorMessage: success ? undefined : 'Access denied'
    });
  }

  logSecurityViolation(source: string, violationType: string, details: Record<string, any> = {}): void {
    this.log({
      eventType: 'security_violation',
      severity: 'critical',
      ipAddress: source,
      action: `Security violation: ${violationType}`,
      success: false,
      details,
      errorMessage: `Potential security threat detected: ${violationType}`
    });
  }

  logDataAccess(userId: string, resource: string, action: string, success: boolean, details: Record<string, any> = {}): void {
    this.log({
      eventType: 'data_access',
      severity: success ? 'info' : 'error',
      userId,
      resource,
      action: `${action} data`,
      success,
      details
    });
  }

  // Query methods
  getLogs(options: {
    eventType?: AuditLogEntry['eventType'];
    severity?: AuditLogEntry['severity'];
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): AuditLogEntry[] {
    let filtered = [...this.logs];

    if (options.eventType) {
      filtered = filtered.filter(log => log.eventType === options.eventType);
    }

    if (options.severity) {
      filtered = filtered.filter(log => log.severity === options.severity);
    }

    if (options.userId) {
      filtered = filtered.filter(log => log.userId === options.userId);
    }

    if (options.startDate) {
      filtered = filtered.filter(log => log.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      filtered = filtered.filter(log => log.timestamp <= options.endDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getAlerts(options: {
    type?: SecurityAlert['type'];
    severity?: SecurityAlert['severity'];
    resolved?: boolean;
    limit?: number;
  } = {}): SecurityAlert[] {
    let filtered = [...this.alerts];

    if (options.type) {
      filtered = filtered.filter(alert => alert.type === options.type);
    }

    if (options.severity) {
      filtered = filtered.filter(alert => alert.severity === options.severity);
    }

    if (options.resolved !== undefined) {
      filtered = filtered.filter(alert => alert.resolved === options.resolved);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getStatistics() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    return {
      totalLogs: this.logs.length,
      totalAlerts: this.alerts.length,
      unresolvedAlerts: this.alerts.filter(a => !a.resolved).length,
      criticalAlerts: this.alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
      logsLastHour: this.logs.filter(l => now - new Date(l.timestamp).getTime() < oneHour).length,
      logsLastDay: this.logs.filter(l => now - new Date(l.timestamp).getTime() < oneDay).length,
      securityViolationsToday: this.logs.filter(l => 
        l.eventType === 'security_violation' && 
        now - new Date(l.timestamp).getTime() < oneDay
      ).length,
      failedAuthenticationsToday: this.logs.filter(l => 
        l.eventType === 'authentication' && 
        !l.success && 
        now - new Date(l.timestamp).getTime() < oneDay
      ).length
    };
  }

  clearLogs(): void {
    this.logs = [];
    this.persistData();
  }

  clearAlerts(): void {
    this.alerts = [];
    this.persistData();
  }

  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      alerts: this.alerts,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

export const securityAuditLogger = new SecurityAuditLogger();

// React hook for audit logging
export const useSecurityAudit = () => {
  const logEvent = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    securityAuditLogger.log(entry);
  };

  const createAlert = (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved' | 'resolvedAt' | 'resolvedBy'>) => {
    securityAuditLogger.createAlert(alert);
  };

  const getLogs = (options?: Parameters<typeof securityAuditLogger.getLogs>[0]) => {
    return securityAuditLogger.getLogs(options);
  };

  const getAlerts = (options?: Parameters<typeof securityAuditLogger.getAlerts>[0]) => {
    return securityAuditLogger.getAlerts(options);
  };

  const getStatistics = () => {
    return securityAuditLogger.getStatistics();
  };

  return {
    logEvent,
    createAlert,
    getLogs,
    getAlerts,
    getStatistics,
    // Convenience methods
    logAuthentication: securityAuditLogger.logAuthentication.bind(securityAuditLogger),
    logAuthorization: securityAuditLogger.logAuthorization.bind(securityAuditLogger),
    logSecurityViolation: securityAuditLogger.logSecurityViolation.bind(securityAuditLogger),
    logDataAccess: securityAuditLogger.logDataAccess.bind(securityAuditLogger)
  };
};
