
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';

export interface ErrorContext {
  // User context
  userId?: string;
  sessionId: string;
  userAgent: string;
  timestamp: string;
  
  // Application context
  route: string;
  component: string;
  action: string;
  
  // System context
  browserInfo: BrowserInfo;
  performanceMetrics: PerformanceMetrics;
  networkStatus: NetworkStatus;
  memoryUsage?: MemoryInfo;
  
  // Error context
  errorId: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  
  // Additional context
  breadcrumbs: ErrorBreadcrumb[];
  customData?: Record<string, any>;
  stackTrace?: string;
  componentTree?: string[];
  
  // Recovery context
  recoveryAttempts: number;
  lastRecoveryAction?: string;
  userFeedback?: UserErrorFeedback;
}

export interface BrowserInfo {
  name: string;
  version: string;
  platform: string;
  cookieEnabled: boolean;
  onlineStatus: boolean;
  language: string;
  timezone: string;
  screenResolution: string;
  viewportSize: string;
}

export interface PerformanceMetrics {
  pageLoadTime?: number;
  memoryUsed?: number;
  activeConnections?: number;
  renderTime?: number;
  apiLatency?: number[];
  errorRate?: number;
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface ErrorBreadcrumb {
  timestamp: string;
  type: 'navigation' | 'user_action' | 'api_call' | 'state_change' | 'error';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface UserErrorFeedback {
  description?: string;
  rating: number; // 1-5 scale
  expectation: string;
  reproductionSteps?: string;
  contactAllowed: boolean;
  contactInfo?: string;
}

export type ErrorType = 'javascript' | 'network' | 'api' | 'validation' | 'authentication' | 'permission' | 'business_logic' | 'system';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'user_error' | 'system_error' | 'network_error' | 'configuration_error' | 'data_error';

export interface ErrorRecoverySuggestion {
  id: string;
  title: string;
  description: string;
  action: ErrorRecoveryAction;
  priority: number;
  applicableErrors: string[];
  userMessage: string;
  technicalDetails: string;
}

export interface ErrorRecoveryAction {
  type: 'reload' | 'retry' | 'clear_cache' | 'logout_login' | 'contact_support' | 'navigate' | 'custom';
  params?: Record<string, any>;
  handler?: () => Promise<boolean>;
}

class ComprehensiveErrorReportingService {
  private errorId = 0;
  private sessionId: string;
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private maxBreadcrumbs = 50;
  private errorQueue: ErrorContext[] = [];
  private reportingEnabled = true;
  private recoveryEngineLoaded = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeErrorCapture();
    this.initializePerformanceMonitoring();
    this.loadRecoveryEngine();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeErrorCapture() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        component: 'global',
        action: 'script_error',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        {
          component: 'global',
          action: 'unhandled_promise',
          additionalData: { reason: event.reason }
        }
      );
    });

    // Network error detection
    window.addEventListener('offline', () => {
      this.addBreadcrumb({
        type: 'state_change',
        message: 'Network went offline',
        level: 'warning'
      });
    });

    window.addEventListener('online', () => {
      this.addBreadcrumb({
        type: 'state_change',
        message: 'Network came online',
        level: 'info'
      });
    });
  }

  private initializePerformanceMonitoring() {
    // Monitor performance issues
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
              this.addBreadcrumb({
                type: 'state_change',
                message: `Performance: ${entry.name} took ${entry.duration}ms`,
                level: entry.duration > 1000 ? 'warning' : 'info',
                data: { duration: entry.duration, type: entry.entryType }
              });
            }
          }
        });
        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (e) {
        // PerformanceObserver not fully supported
      }
    }
  }

  private async loadRecoveryEngine() {
    // Load recovery suggestions based on historical error patterns
    try {
      // In a real implementation, this would load from your analytics service
      this.recoveryEngineLoaded = true;
    } catch (error) {
      logger.logError('Failed to load recovery engine', error);
    }
  }

  public addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) {
    const timestampedBreadcrumb: ErrorBreadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString()
    };

    this.breadcrumbs.push(timestampedBreadcrumb);
    
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  public async captureError(
    error: Error,
    context: {
      component?: string;
      action?: string;
      userId?: string;
      severity?: ErrorSeverity;
      additionalData?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const errorId = `error_${++this.errorId}_${Date.now()}`;

    try {
      const errorContext: ErrorContext = {
        errorId,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        
        // Application context
        route: window.location.pathname,
        component: context.component || 'unknown',
        action: context.action || 'unknown',
        
        // System context
        browserInfo: this.getBrowserInfo(),
        performanceMetrics: await this.getPerformanceMetrics(),
        networkStatus: this.getNetworkStatus(),
        memoryUsage: this.getMemoryInfo(),
        
        // Error context
        errorType: this.categorizeErrorType(error),
        severity: context.severity || this.determineSeverity(error),
        category: this.categorizeError(error),
        stackTrace: error.stack,
        componentTree: this.getComponentTree(),
        
        // Additional context
        breadcrumbs: [...this.breadcrumbs],
        customData: context.additionalData,
        recoveryAttempts: 0,
        
        userId: context.userId
      };

      // Add error as breadcrumb
      this.addBreadcrumb({
        type: 'error',
        message: `Error: ${error.message}`,
        level: 'error',
        data: { errorId, component: context.component }
      });

      // Queue for reporting
      if (this.reportingEnabled) {
        this.queueErrorReport(errorContext);
      }

      // Log for development
      if (PRODUCTION_CONFIG.development.enableDebugMode) {
        console.group(`🚨 Error Captured: ${errorId}`);
        console.error('Error:', error);
        console.log('Context:', errorContext);
        console.groupEnd();
      }

      return errorId;
    } catch (captureError) {
      logger.logError('Failed to capture error context', captureError);
      return `error_${Date.now()}_capture_failed`;
    }
  }

  private getBrowserInfo(): BrowserInfo {
    const nav = navigator as any;
    
    return {
      name: this.getBrowserName(),
      version: this.getBrowserVersion(),
      platform: nav.platform || 'unknown',
      cookieEnabled: nav.cookieEnabled,
      onlineStatus: nav.onLine,
      language: nav.language || nav.userLanguage || 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown';
  }

  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([0-9.]+)/);
    return match ? match[2] : 'Unknown';
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {};

    try {
      // Page load time
      if (performance.timing) {
        const timing = performance.timing;
        metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
      }

      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        metrics.memoryUsed = memory.usedJSHeapSize;
      }

      // Network information (if available)
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        metrics.activeConnections = connection.downlink;
      }

    } catch (error) {
      logger.logError('Failed to collect performance metrics', error);
    }

    return metrics;
  }

  private getNetworkStatus(): NetworkStatus {
    const status: NetworkStatus = {
      isOnline: navigator.onLine
    };

    try {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        status.connectionType = connection.type;
        status.effectiveType = connection.effectiveType;
        status.downlink = connection.downlink;
        status.rtt = connection.rtt;
      }
    } catch (error) {
      // Network API not fully supported
    }

    return status;
  }

  private getMemoryInfo(): MemoryInfo | undefined {
    try {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
    } catch (error) {
      // Memory API not available
    }
    return undefined;
  }

  private getComponentTree(): string[] {
    // This would ideally integrate with React DevTools or similar
    // For now, we'll return a basic implementation
    const tree: string[] = [];
    
    try {
      // Get current route components (if using React Router)
      const path = window.location.pathname;
      tree.push(`Route: ${path}`);
      
      // Add any available component information from React DevTools
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        tree.push('React DevTools Available');
      }
    } catch (error) {
      tree.push('Component tree unavailable');
    }

    return tree;
  }

  private categorizeErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = (error.stack || '').toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('xmlhttprequest')) {
      return 'network';
    }
    
    if (message.includes('unauthorized') || message.includes('authentication') || message.includes('login')) {
      return 'authentication';
    }
    
    if (message.includes('permission') || message.includes('forbidden') || message.includes('access denied')) {
      return 'permission';
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    
    if (message.includes('api') || message.includes('server') || message.includes('endpoint')) {
      return 'api';
    }
    
    if (stack.includes('businesslogic') || stack.includes('service')) {
      return 'business_logic';
    }
    
    return 'javascript';
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('cannot read property') || message.includes('undefined is not a function')) {
      return 'critical';
    }
    
    // High severity
    if (message.includes('network') || message.includes('server error') || message.includes('authentication')) {
      return 'high';
    }
    
    // Medium severity
    if (message.includes('validation') || message.includes('permission')) {
      return 'medium';
    }
    
    return 'low';
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('validation') || message.includes('invalid input')) {
      return 'user_error';
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'network_error';
    }
    
    if (message.includes('configuration') || message.includes('environment')) {
      return 'configuration_error';
    }
    
    if (message.includes('data') || message.includes('database')) {
      return 'data_error';
    }
    
    return 'system_error';
  }

  private queueErrorReport(errorContext: ErrorContext) {
    this.errorQueue.push(errorContext);
    
    // Process queue periodically or when it reaches a certain size
    if (this.errorQueue.length >= 5) {
      this.processErrorQueue();
    }
  }

  private async processErrorQueue() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await this.sendErrorReports(errors);
    } catch (error) {
      logger.logError('Failed to send error reports', error);
      // Re-queue errors for later retry
      this.errorQueue.unshift(...errors);
    }
  }

  private async sendErrorReports(errors: ErrorContext[]) {
    try {
      // Send to your error reporting service
      const { error } = await window.ezsite.apis.tableCreate(37302, {
        session_id: this.sessionId,
        error_data: JSON.stringify(errors),
        count: errors.length,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });

      if (error) {
        throw new Error(error);
      }

      logger.logInfo(`Sent ${errors.length} error reports`, { sessionId: this.sessionId });
    } catch (error) {
      logger.logError('Failed to send error reports to database', error);
      throw error;
    }
  }

  public getRecoverySuggestions(errorContext: ErrorContext): ErrorRecoverySuggestion[] {
    const suggestions: ErrorRecoverySuggestion[] = [];

    // Network-related recovery suggestions
    if (errorContext.errorType === 'network') {
      suggestions.push({
        id: 'network_retry',
        title: 'Retry Connection',
        description: 'Check your internet connection and try again',
        userMessage: 'It looks like there was a connection issue. Please check your internet and try again.',
        technicalDetails: `Network error: ${errorContext.errorType}`,
        priority: 1,
        applicableErrors: ['network', 'api'],
        action: {
          type: 'retry',
          handler: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return navigator.onLine;
          }
        }
      });

      if (!navigator.onLine) {
        suggestions.push({
          id: 'offline_mode',
          title: 'You are offline',
          description: 'Some features may not be available while offline',
          userMessage: 'You appear to be offline. Please check your internet connection.',
          technicalDetails: 'Navigator.onLine: false',
          priority: 0,
          applicableErrors: ['network'],
          action: {
            type: 'reload'
          }
        });
      }
    }

    // Authentication-related suggestions
    if (errorContext.errorType === 'authentication') {
      suggestions.push({
        id: 'reauth',
        title: 'Re-authenticate',
        description: 'Your session may have expired',
        userMessage: 'Your session has expired. Please log in again.',
        technicalDetails: `Auth error: ${errorContext.errorType}`,
        priority: 1,
        applicableErrors: ['authentication'],
        action: {
          type: 'logout_login'
        }
      });
    }

    // Validation-related suggestions
    if (errorContext.errorType === 'validation') {
      suggestions.push({
        id: 'check_input',
        title: 'Check Input',
        description: 'Please review the information you entered',
        userMessage: 'Please check the information you entered and try again.',
        technicalDetails: `Validation error in ${errorContext.component}`,
        priority: 1,
        applicableErrors: ['validation'],
        action: {
          type: 'custom',
          handler: async () => {
            // Focus on the first invalid field if possible
            const firstInvalid = document.querySelector('.error, [aria-invalid="true"]');
            if (firstInvalid && 'focus' in firstInvalid) {
              (firstInvalid as HTMLElement).focus();
            }
            return true;
          }
        }
      });
    }

    // Generic suggestions
    suggestions.push({
      id: 'refresh_page',
      title: 'Refresh Page',
      description: 'Sometimes a simple refresh can resolve the issue',
      userMessage: 'Try refreshing the page to resolve this issue.',
      technicalDetails: 'Generic page refresh suggestion',
      priority: 2,
      applicableErrors: ['javascript', 'system'],
      action: {
        type: 'reload'
      }
    });

    suggestions.push({
      id: 'clear_cache',
      title: 'Clear Browser Cache',
      description: 'Clear cached data and reload',
      userMessage: 'Try clearing your browser cache and cookies.',
      technicalDetails: 'Cache clearing for persistent issues',
      priority: 3,
      applicableErrors: ['system', 'javascript'],
      action: {
        type: 'clear_cache'
      }
    });

    // Sort by priority
    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  public async recordUserFeedback(errorId: string, feedback: UserErrorFeedback) {
    try {
      const { error } = await window.ezsite.apis.tableCreate(37302, {
        error_id: errorId,
        user_feedback: JSON.stringify(feedback),
        feedback_timestamp: new Date().toISOString(),
        session_id: this.sessionId
      });

      if (error) throw new Error(error);
      
      logger.logInfo('User feedback recorded', { errorId, feedback });
    } catch (error) {
      logger.logError('Failed to record user feedback', error);
    }
  }

  public async updateErrorWithRecoveryAttempt(errorId: string, recoveryAction: string, success: boolean) {
    try {
      // Update the error record with recovery attempt
      this.addBreadcrumb({
        type: 'user_action',
        message: `Recovery attempt: ${recoveryAction} - ${success ? 'Success' : 'Failed'}`,
        level: success ? 'info' : 'warning',
        data: { errorId, recoveryAction, success }
      });
    } catch (error) {
      logger.logError('Failed to record recovery attempt', error);
    }
  }

  // Cleanup method
  public cleanup() {
    // Process any remaining errors in queue
    if (this.errorQueue.length > 0) {
      this.processErrorQueue();
    }
  }
}

// Export singleton instance
export const comprehensiveErrorReporting = new ComprehensiveErrorReportingService();

// Export for React components
export default ComprehensiveErrorReportingService;
