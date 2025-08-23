
import { logger } from '@/utils/production-logger';

// Error categories and severity levels
export enum ErrorCategory {
  APPLICATION = 'application',
  NETWORK = 'network',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  BUSINESS_LOGIC = 'business_logic'
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum PerformanceIssueType {
  LONG_TASK = 'long_task',
  LAYOUT_SHIFT = 'layout_shift',
  MEMORY_LEAK = 'memory_leak',
  SLOW_API = 'slow_api',
  LARGE_CONTENTFUL_PAINT = 'large_contentful_paint',
  FIRST_INPUT_DELAY = 'first_input_delay'
}

export enum NetworkErrorType {
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  CONNECTION_ERROR = 'connection_error',
  DNS_ERROR = 'dns_error'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  componentName?: string;
  actionAttempted?: string;
  userAgent?: string;
  pageUrl?: string;
  timestamp?: string;
  browserInfo?: {
    language: string;
    platform: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
  performanceInfo?: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    navigation?: {
      loadTime: number;
      domComplete: number;
      domInteractive: number;
    };
  };
  networkInfo?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  additionalData?: Record<string, any>;
}

export interface ErrorLogEntry {
  errorId: string;
  category: ErrorCategory;
  severity: SeverityLevel;
  type: string;
  message: string;
  stack?: string;
  componentStack?: string;
  context: ErrorContext;
}

export interface PerformanceIssueEntry {
  issueId: string;
  type: PerformanceIssueType;
  metricName: string;
  metricValue: number;
  thresholdValue: number;
  context: ErrorContext;
}

export interface NetworkErrorEntry {
  errorId: string;
  requestUrl: string;
  method: string;
  statusCode?: number;
  errorType: NetworkErrorType;
  message: string;
  retryCount: number;
  responseTime?: number;
  context: ErrorContext;
}

class CentralizedErrorService {
  private errorBuffer: ErrorLogEntry[] = [];
  private performanceBuffer: PerformanceIssueEntry[] = [];
  private networkBuffer: NetworkErrorEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxBufferSize = 100;
  private readonly flushInterval = 30000; // 30 seconds
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkMonitoring();
    this.scheduleFlush();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId: string) {
    this.userId = userId;
    logger.logInfo('User ID set for error service', { userId, sessionId: this.sessionId });
  }

  // Main error logging method
  logError(
    error: Error,
    category: ErrorCategory,
    severity: SeverityLevel,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorId = this.generateErrorId();
    const fullContext = this.enrichContext(context);

    const errorEntry: ErrorLogEntry = {
      errorId,
      category,
      severity,
      type: error.name || 'Error',
      message: error.message,
      stack: error.stack?.substring(0, 2000), // Limit stack trace size
      context: fullContext
    };

    this.errorBuffer.push(errorEntry);
    this.checkBufferSize();

    // Log to console and production logger
    logger.logError(
      `${category.toUpperCase()}: ${error.message}`,
      error,
      { errorId, category, severity, context: fullContext },
      'centralized_error_service'
    );

    // Handle critical errors immediately
    if (severity === SeverityLevel.CRITICAL) {
      this.flushBuffers();
    }

    return errorId;
  }

  // Log performance issues
  logPerformanceIssue(
    type: PerformanceIssueType,
    metricName: string,
    metricValue: number,
    thresholdValue: number,
    context: Partial<ErrorContext> = {}
  ): string {
    const issueId = this.generateErrorId();
    const fullContext = this.enrichContext(context);

    const performanceEntry: PerformanceIssueEntry = {
      issueId,
      type,
      metricName,
      metricValue,
      thresholdValue,
      context: fullContext
    };

    this.performanceBuffer.push(performanceEntry);
    this.checkBufferSize();

    logger.logWarn(
      `Performance issue: ${metricName} (${metricValue}ms) exceeded threshold (${thresholdValue}ms)`,
      { issueId, type, metricName, metricValue, thresholdValue },
      'performance_monitoring'
    );

    return issueId;
  }

  // Log network errors
  logNetworkError(
    requestUrl: string,
    method: string,
    errorType: NetworkErrorType,
    message: string,
    statusCode?: number,
    retryCount: number = 0,
    responseTime?: number,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorId = this.generateErrorId();
    const fullContext = this.enrichContext(context);

    const networkEntry: NetworkErrorEntry = {
      errorId,
      requestUrl,
      method,
      statusCode,
      errorType,
      message,
      retryCount,
      responseTime,
      context: fullContext
    };

    this.networkBuffer.push(networkEntry);
    this.checkBufferSize();

    logger.logError(
      `Network error: ${method} ${requestUrl} - ${message}`,
      null,
      { errorId, statusCode, errorType, retryCount, responseTime },
      'network_error'
    );

    return errorId;
  }

  // Enrich context with additional information
  private enrichContext(context: Partial<ErrorContext>): ErrorContext {
    const enriched: ErrorContext = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      ...context
    };

    // Add performance info if available
    if ((performance as any).memory) {
      enriched.performanceInfo = {
        memory: {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        }
      };
    }

    // Add network info if available
    if ((navigator as any).connection) {
      enriched.networkInfo = {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      };
    }

    return enriched;
  }

  private setupGlobalErrorHandlers() {
    // Enhanced global error handler
    window.addEventListener('error', (event) => {
      this.logError(
        event.error || new Error(event.message),
        ErrorCategory.APPLICATION,
        SeverityLevel.HIGH,
        {
          componentName: 'global_error_handler',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      );
    });

    // Enhanced unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.logError(
        error,
        ErrorCategory.APPLICATION,
        SeverityLevel.HIGH,
        {
          componentName: 'unhandled_promise_rejection',
          additionalData: {
            promise: event.promise
          }
        }
      );
    });

    // Network status handlers
    window.addEventListener('offline', () => {
      this.logError(
        new Error('Application went offline'),
        ErrorCategory.NETWORK,
        SeverityLevel.MEDIUM,
        {
          componentName: 'network_status_monitor',
          additionalData: { connectionStatus: 'offline' }
        }
      );
    });
  }

  private setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        // Long task monitoring
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.logPerformanceIssue(
                PerformanceIssueType.LONG_TASK,
                'long_task_duration',
                entry.duration,
                50,
                {
                  additionalData: {
                    taskName: entry.name,
                    startTime: entry.startTime
                  }
                }
              );
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        // Layout shift monitoring
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as any;
            if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value > 0.1) {
              this.logPerformanceIssue(
                PerformanceIssueType.LAYOUT_SHIFT,
                'cumulative_layout_shift',
                layoutShiftEntry.value,
                0.1,
                {
                  additionalData: {
                    sources: layoutShiftEntry.sources
                  }
                }
              );
            }
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

        // Largest Contentful Paint monitoring
        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime > 2500) { // LCP longer than 2.5s
              this.logPerformanceIssue(
                PerformanceIssueType.LARGE_CONTENTFUL_PAINT,
                'largest_contentful_paint',
                entry.startTime,
                2500,
                {
                  additionalData: {
                    element: (entry as any).element?.tagName,
                    size: (entry as any).size
                  }
                }
              );
            }
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      } catch (error) {
        logger.logWarn('Performance observer setup failed', error);
      }
    }
  }

  private setupNetworkMonitoring() {
    // Enhanced fetch monitoring
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const [input, init] = args;
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(...args);
        const responseTime = performance.now() - startTime;

        if (!response.ok) {
          const errorType = response.status >= 500 
            ? NetworkErrorType.SERVER_ERROR 
            : NetworkErrorType.CLIENT_ERROR;

          this.logNetworkError(
            url,
            method,
            errorType,
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            0,
            responseTime
          );
        } else if (responseTime > 5000) {
          // Log slow responses
          this.logPerformanceIssue(
            PerformanceIssueType.SLOW_API,
            'api_response_time',
            responseTime,
            5000,
            {
              additionalData: {
                url,
                method,
                statusCode: response.status
              }
            }
          );
        }

        return response;
      } catch (error) {
        const responseTime = performance.now() - startTime;
        const networkError = error as Error;
        
        let errorType = NetworkErrorType.NETWORK_ERROR;
        if (networkError.message.includes('timeout')) {
          errorType = NetworkErrorType.TIMEOUT;
        } else if (networkError.message.includes('Failed to fetch')) {
          errorType = NetworkErrorType.CONNECTION_ERROR;
        }

        this.logNetworkError(
          url,
          method,
          errorType,
          networkError.message,
          undefined,
          0,
          responseTime
        );

        throw error;
      }
    };
  }

  private checkBufferSize() {
    if (this.errorBuffer.length >= this.maxBufferSize ||
        this.performanceBuffer.length >= this.maxBufferSize ||
        this.networkBuffer.length >= this.maxBufferSize) {
      this.flushBuffers();
    }
  }

  private scheduleFlush() {
    this.flushTimer = setInterval(() => {
      this.flushBuffers();
    }, this.flushInterval);
  }

  private async flushBuffers() {
    if (this.errorBuffer.length === 0 && 
        this.performanceBuffer.length === 0 && 
        this.networkBuffer.length === 0) {
      return;
    }

    try {
      // Flush error logs
      if (this.errorBuffer.length > 0) {
        await this.flushErrorLogs();
      }

      // Flush performance issues
      if (this.performanceBuffer.length > 0) {
        await this.flushPerformanceIssues();
      }

      // Flush network errors
      if (this.networkBuffer.length > 0) {
        await this.flushNetworkErrors();
      }

      logger.logInfo('Error buffers flushed successfully', {
        errorCount: this.errorBuffer.length,
        performanceCount: this.performanceBuffer.length,
        networkCount: this.networkBuffer.length
      });

    } catch (error) {
      logger.logError('Failed to flush error buffers', error);
    }
  }

  private async flushErrorLogs() {
    const errors = [...this.errorBuffer];
    this.errorBuffer = [];

    for (const errorEntry of errors) {
      try {
        const { error } = await window.ezsite.apis.tableCreate(37297, { // error_logs table ID
          error_id: errorEntry.errorId,
          error_category: errorEntry.category,
          severity_level: errorEntry.severity,
          error_type: errorEntry.type,
          error_message: errorEntry.message,
          error_stack: errorEntry.stack || '',
          component_stack: errorEntry.componentStack || '',
          page_url: errorEntry.context.pageUrl || '',
          user_agent: errorEntry.context.userAgent || '',
          user_id: errorEntry.context.userId || '',
          session_id: errorEntry.context.sessionId || '',
          timestamp: new Date(errorEntry.context.timestamp || Date.now()),
          context_data: JSON.stringify(errorEntry.context.additionalData || {}),
          resolved: false,
          resolution_notes: ''
        });

        if (error) {
          logger.logWarn('Failed to save error log to database', error);
        }
      } catch (dbError) {
        logger.logError('Database error while saving error log', dbError);
      }
    }
  }

  private async flushPerformanceIssues() {
    const issues = [...this.performanceBuffer];
    this.performanceBuffer = [];

    for (const issue of issues) {
      try {
        const { error } = await window.ezsite.apis.tableCreate(37298, { // performance_issues table ID
          issue_id: issue.issueId,
          issue_type: issue.type,
          metric_name: issue.metricName,
          metric_value: issue.metricValue,
          threshold_value: issue.thresholdValue,
          page_url: issue.context.pageUrl || '',
          user_agent: issue.context.userAgent || '',
          timestamp: new Date(issue.context.timestamp || Date.now()),
          context_data: JSON.stringify(issue.context.additionalData || {}),
          resolved: false
        });

        if (error) {
          logger.logWarn('Failed to save performance issue to database', error);
        }
      } catch (dbError) {
        logger.logError('Database error while saving performance issue', dbError);
      }
    }
  }

  private async flushNetworkErrors() {
    const networkErrors = [...this.networkBuffer];
    this.networkBuffer = [];

    for (const networkError of networkErrors) {
      try {
        const { error } = await window.ezsite.apis.tableCreate(37299, { // network_errors table ID
          error_id: networkError.errorId,
          request_url: networkError.requestUrl,
          request_method: networkError.method,
          status_code: networkError.statusCode || 0,
          error_type: networkError.errorType,
          error_message: networkError.message,
          retry_count: networkError.retryCount,
          response_time: networkError.responseTime || 0,
          timestamp: new Date(networkError.context.timestamp || Date.now()),
          context_data: JSON.stringify(networkError.context.additionalData || {}),
          resolved: false
        });

        if (error) {
          logger.logWarn('Failed to save network error to database', error);
        }
      } catch (dbError) {
        logger.logError('Database error while saving network error', dbError);
      }
    }
  }

  // Public methods for manual error reporting
  reportApplicationError(error: Error, severity: SeverityLevel = SeverityLevel.MEDIUM, context?: Partial<ErrorContext>) {
    return this.logError(error, ErrorCategory.APPLICATION, severity, context);
  }

  reportNetworkError(url: string, method: string, error: Error, statusCode?: number, retryCount?: number) {
    return this.logNetworkError(
      url,
      method,
      NetworkErrorType.NETWORK_ERROR,
      error.message,
      statusCode,
      retryCount || 0,
      undefined,
      { additionalData: { originalError: error.name } }
    );
  }

  reportSecurityError(error: Error, severity: SeverityLevel = SeverityLevel.CRITICAL, context?: Partial<ErrorContext>) {
    return this.logError(error, ErrorCategory.SECURITY, severity, {
      ...context,
      componentName: 'security_monitor'
    });
  }

  reportDatabaseError(error: Error, operation: string, table?: string) {
    return this.logError(error, ErrorCategory.DATABASE, SeverityLevel.HIGH, {
      componentName: 'database_operation',
      actionAttempted: operation,
      additionalData: { table }
    });
  }

  // Get error statistics
  async getErrorStatistics(days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: errorData, error: errorQueryError } = await window.ezsite.apis.tablePage(37297, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: [
          {
            name: 'timestamp',
            op: 'GreaterThanOrEqual',
            value: startDate.toISOString()
          }
        ]
      });

      if (errorQueryError) {
        logger.logWarn('Failed to fetch error statistics', errorQueryError);
        return null;
      }

      return {
        totalErrors: errorData?.VirtualCount || 0,
        recentErrors: errorData?.List || [],
        timeRange: `${days} days`
      };
    } catch (error) {
      logger.logError('Error fetching statistics', error);
      return null;
    }
  }

  // Cleanup method
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushBuffers(); // Final flush
  }
}

// Export singleton instance
export const centralizedErrorService = new CentralizedErrorService();
export default centralizedErrorService;
