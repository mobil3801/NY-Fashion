import { PRODUCTION_CONFIG } from '@/config/production';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
}

interface PerformanceEntry {
  timestamp: string;
  type: 'api' | 'component' | 'page' | 'database';
  name: string;
  duration: number;
  success: boolean;
  data?: any;
}

class ProductionLogger {
  private logs: LogEntry[] = [];
  private performanceMetrics: PerformanceEntry[] = [];
  private maxLogs = 1000;
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupPerformanceObserver();
    this.scheduleLogFlush();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupPerformanceObserver() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.logPerformance('page', 'page_load', entry.duration, true, {
                loadTime: entry.duration,
                domComplete: (entry as PerformanceNavigationTiming).domComplete,
                domInteractive: (entry as PerformanceNavigationTiming).domInteractive
              });
            }
          }
        });
        observer.observe({ entryTypes: ['navigation', 'paint'] });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }
  }

  private scheduleLogFlush() {
    setInterval(() => {
      this.flushLogs();
    }, PRODUCTION_CONFIG.monitoring.metricsFlushInterval);
  }

  private createLogEntry(
  level: LogEntry['level'],
  category: string,
  message: string,
  data?: any)
  : LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };
  }

  private sanitizeData(data: any): any {
    // Remove sensitive information
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credential'];

      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    return data;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  logInfo(message: string, data?: any, category = 'general') {
    const entry = this.createLogEntry('info', category, message, data);
    this.addLog(entry);

    if (PRODUCTION_CONFIG.errorHandling.logToConsole) {
      console.info(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  logWarn(message: string, data?: any, category = 'general') {
    const entry = this.createLogEntry('warn', category, message, data);
    this.addLog(entry);

    if (PRODUCTION_CONFIG.errorHandling.logToConsole) {
      console.warn(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  logError(message: string, error?: any, data?: any, category = 'error') {
    const errorData = error instanceof Error ?
    { name: error.name, message: error.message, stack: error.stack?.substring(0, PRODUCTION_CONFIG.errorHandling.maxErrorStackTrace) } :
    error;

    const entry = this.createLogEntry('error', category, message, { error: errorData, ...data });
    this.addLog(entry);

    if (PRODUCTION_CONFIG.errorHandling.logToConsole) {
      console.error(`[${category.toUpperCase()}] ${message}`, errorData, data || '');
    }

    // Send critical errors immediately
    if (PRODUCTION_CONFIG.errorHandling.sendTelemetry) {
      this.sendCriticalError(entry);
    }
  }

  logDebug(message: string, data?: any, category = 'debug') {
    if (!PRODUCTION_CONFIG.development.enableDebugMode) return;

    const entry = this.createLogEntry('debug', category, message, data);
    this.addLog(entry);

    if (PRODUCTION_CONFIG.errorHandling.logToConsole) {
      console.debug(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }

  logPerformance(type: PerformanceEntry['type'], name: string, duration: number, success = true, data?: any) {
    if (!PRODUCTION_CONFIG.monitoring.enablePerformanceMetrics) return;

    const entry: PerformanceEntry = {
      timestamp: new Date().toISOString(),
      type,
      name,
      duration,
      success,
      data: data ? this.sanitizeData(data) : undefined
    };

    this.performanceMetrics.push(entry);

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.maxLogs) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxLogs);
    }

    if (PRODUCTION_CONFIG.development.enableConsoleLogging) {
      console.log(`[PERF] ${type}:${name} took ${duration}ms`, data || '');
    }
  }

  logUserAction(action: string, data?: any) {
    this.logInfo(`User action: ${action}`, data, 'user_action');
  }

  logApiCall(endpoint: string, method: string, data?: any) {
    const startTime = performance.now();
    this.logInfo(`API call: ${method} ${endpoint}`, data, 'api');

    return {
      end: (success = true, responseData?: any) => {
        const duration = performance.now() - startTime;
        this.logPerformance('api', `${method} ${endpoint}`, duration, success, {
          request: data,
          response: responseData,
          success
        });
      }
    };
  }

  logDatabaseOperation(operation: string, table: string, data?: any) {
    this.logInfo(`Database ${operation} on ${table}`, data, 'database');
  }

  logComponentLifecycle(component: string, lifecycle: string, data?: any) {
    this.logDebug(`Component ${component} ${lifecycle}`, data, 'component');
  }

  logSecurityEvent(event: string, data?: any) {
    this.logWarn(`Security event: ${event}`, data, 'security');
  }

  logBusinessMetric(metric: string, value: number, data?: any) {
    this.logInfo(`Business metric: ${metric} = ${value}`, data, 'business');
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private async sendCriticalError(entry: LogEntry) {
    try {
      // In a real production environment, you would send this to your logging service
      // For now, we'll store it locally and could implement EasySite API integration
      const errorReport = {
        timestamp: entry.timestamp,
        error: entry.message,
        data: entry.data,
        userAgent: entry.userAgent,
        url: entry.url,
        userId: entry.userId,
        sessionId: entry.sessionId
      };

      // Store in localStorage for now - in production, send to logging service
      const existingErrors = JSON.parse(localStorage.getItem('criticalErrors') || '[]');
      existingErrors.push(errorReport);

      // Keep only last 100 critical errors
      if (existingErrors.length > 100) {
        existingErrors.splice(0, existingErrors.length - 100);
      }

      localStorage.setItem('criticalErrors', JSON.stringify(existingErrors));
    } catch (error) {
      console.error('Failed to send critical error:', error);
    }
  }

  private async flushLogs() {
    if (this.logs.length === 0 && this.performanceMetrics.length === 0) return;

    try {
      // In production, send logs to your logging service
      // For now, we'll implement basic local storage with cleanup
      const logData = {
        logs: this.logs.slice(),
        performanceMetrics: this.performanceMetrics.slice(),
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      };

      // Store in localStorage with rotation
      const logKey = `logs_${Date.now()}`;
      localStorage.setItem(logKey, JSON.stringify(logData));

      // Clean up old log entries
      this.cleanupOldLogs();

      // Clear current logs after flush
      this.logs = [];
      this.performanceMetrics = [];

    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  private cleanupOldLogs() {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('logs_'));
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    keys.forEach((key) => {
      const timestamp = parseInt(key.replace('logs_', ''));
      if (now - timestamp > maxAge) {
        localStorage.removeItem(key);
      }
    });
  }

  // Public methods for manual log access
  getLogs(category?: string, level?: LogEntry['level']): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (category) {
      filteredLogs = filteredLogs.filter((log) => log.category === category);
    }

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    return filteredLogs;
  }

  getPerformanceMetrics(type?: PerformanceEntry['type']): PerformanceEntry[] {
    if (type) {
      return this.performanceMetrics.filter((metric) => metric.type === type);
    }
    return [...this.performanceMetrics];
  }

  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      performanceMetrics: this.performanceMetrics,
      sessionId: this.sessionId,
      exportTime: new Date().toISOString()
    }, null, 2);
  }

  clearLogs() {
    this.logs = [];
    this.performanceMetrics = [];
  }
}

// Singleton logger instance
export const logger = new ProductionLogger();

// Convenience exports
export const logInfo = logger.logInfo.bind(logger);
export const logWarn = logger.logWarn.bind(logger);
export const logError = logger.logError.bind(logger);
export const logDebug = logger.logDebug.bind(logger);
export const logPerformance = logger.logPerformance.bind(logger);
export const logUserAction = logger.logUserAction.bind(logger);
export const logApiCall = logger.logApiCall.bind(logger);
export const logDatabaseOperation = logger.logDatabaseOperation.bind(logger);
export const logComponentLifecycle = logger.logComponentLifecycle.bind(logger);
export const logSecurityEvent = logger.logSecurityEvent.bind(logger);
export const logBusinessMetric = logger.logBusinessMetric.bind(logger);

export default logger;