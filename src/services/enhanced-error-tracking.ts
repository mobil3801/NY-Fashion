
export interface ErrorReport {
  errorHash: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  componentName?: string;
  url: string;
  userId?: number;
  severityLevel: 1 | 2 | 3 | 4 | 5;
  userAgent: string;
  environment: string;
  additionalContext?: Record<string, any>;
}

export interface ErrorCategory {
  id: number;
  name: string;
  description: string;
  severity_level: number;
  alert_threshold: number;
  is_active: boolean;
}

export interface ErrorTracking {
  id: number;
  error_hash: string;
  category_id?: number;
  error_type: string;
  error_message: string;
  error_stack?: string;
  component_name?: string;
  url: string;
  user_id?: number;
  severity_level: number;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  is_resolved: boolean;
  resolution_notes?: string;
  environment: string;
  additional_context: string;
}

export interface ErrorAlert {
  id: number;
  alert_type: string;
  category_id?: number;
  threshold_count: number;
  time_window_hours: number;
  alert_recipient: string;
  is_enabled: boolean;
  last_triggered?: string;
  trigger_count: number;
}

export interface ErrorStatistics {
  id: number;
  date_key: string;
  hour_key: string;
  category_id?: number;
  error_type: string;
  error_count: number;
  unique_errors: number;
  affected_users: number;
  avg_severity: number;
}

class EnhancedErrorTrackingService {
  private static instance: EnhancedErrorTrackingService;
  private categories: ErrorCategory[] = [];
  private alertQueue: ErrorReport[] = [];
  private isProcessingAlerts = false;

  static getInstance(): EnhancedErrorTrackingService {
    if (!this.instance) {
      this.instance = new EnhancedErrorTrackingService();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadCategories();
      await this.setupDefaultCategories();
      this.startAlertProcessor();
    } catch (error) {
      console.error('Failed to initialize error tracking service:', error);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37301, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [{ name: 'is_active', op: 'Equal', value: true }]
      });

      if (error) throw new Error(error);
      this.categories = data?.List || [];
    } catch (error) {
      console.error('Failed to load error categories:', error);
    }
  }

  private async setupDefaultCategories(): Promise<void> {
    const defaultCategories = [
    { name: 'JavaScript Error', description: 'Runtime JavaScript errors', severity_level: 2, alert_threshold: 5 },
    { name: 'Network Error', description: 'Network and API related errors', severity_level: 3, alert_threshold: 10 },
    { name: 'UI Component Error', description: 'React component rendering errors', severity_level: 3, alert_threshold: 8 },
    { name: 'Authentication Error', description: 'User authentication failures', severity_level: 2, alert_threshold: 3 },
    { name: 'Database Error', description: 'Database operation failures', severity_level: 1, alert_threshold: 2 },
    { name: 'Performance Warning', description: 'Performance related warnings', severity_level: 4, alert_threshold: 20 }];


    for (const category of defaultCategories) {
      const exists = this.categories.some((c) => c.name === category.name);
      if (!exists) {
        try {
          const { error } = await window.ezsite.apis.tableCreate(37301, {
            ...category,
            is_active: true,
            created_at: new Date().toISOString()
          });
          if (error) console.error('Failed to create category:', category.name, error);
        } catch (error) {
          console.error('Error creating default category:', error);
        }
      }
    }

    await this.loadCategories();
  }

  private generateErrorHash(error: Partial<ErrorReport>): string {
    const hashSource = `${error.errorType}-${error.errorMessage}-${error.componentName}`;
    return btoa(hashSource).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  private categorizeError(error: ErrorReport): number | undefined {
    // Simple categorization logic
    if (error.errorType.toLowerCase().includes('network') || error.errorType.toLowerCase().includes('api')) {
      return this.categories.find((c) => c.name === 'Network Error')?.id;
    }
    if (error.errorType.toLowerCase().includes('auth')) {
      return this.categories.find((c) => c.name === 'Authentication Error')?.id;
    }
    if (error.componentName) {
      return this.categories.find((c) => c.name === 'UI Component Error')?.id;
    }
    if (error.errorType.toLowerCase().includes('database') || error.errorType.toLowerCase().includes('sql')) {
      return this.categories.find((c) => c.name === 'Database Error')?.id;
    }

    return this.categories.find((c) => c.name === 'JavaScript Error')?.id;
  }

  async reportError(errorReport: Partial<ErrorReport>): Promise<void> {
    try {
      const fullReport: ErrorReport = {
        errorHash: this.generateErrorHash(errorReport),
        errorType: errorReport.errorType || 'Unknown Error',
        errorMessage: errorReport.errorMessage || 'No message provided',
        errorStack: errorReport.errorStack,
        componentName: errorReport.componentName,
        url: errorReport.url || window.location.href,
        userId: errorReport.userId,
        severityLevel: errorReport.severityLevel || 3,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV || 'production',
        additionalContext: errorReport.additionalContext
      };

      await this.storeError(fullReport);
      this.alertQueue.push(fullReport);
    } catch (error) {
      console.error('Failed to report error:', error);
    }
  }

  private async storeError(error: ErrorReport): Promise<void> {
    const categoryId = this.categorizeError(error);

    try {
      // Check if error already exists
      const { data: existingErrors } = await window.ezsite.apis.tablePage(37302, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: false,
        Filters: [{ name: 'error_hash', op: 'Equal', value: error.errorHash }]
      });

      const now = new Date().toISOString();

      if (existingErrors?.List && existingErrors.List.length > 0) {
        // Update existing error
        const existing = existingErrors.List[0];
        await window.ezsite.apis.tableUpdate(37302, {
          id: existing.id,
          occurrence_count: existing.occurrence_count + 1,
          last_seen: now,
          additional_context: JSON.stringify({
            ...JSON.parse(existing.additional_context || '{}'),
            ...error.additionalContext
          })
        });
      } else {
        // Create new error record
        await window.ezsite.apis.tableCreate(37302, {
          error_hash: error.errorHash,
          category_id: categoryId,
          error_type: error.errorType,
          error_message: error.errorMessage,
          error_stack: error.errorStack || '',
          component_name: error.componentName || '',
          url: error.url,
          user_id: error.userId,
          severity_level: error.severityLevel,
          occurrence_count: 1,
          first_seen: now,
          last_seen: now,
          is_resolved: false,
          environment: error.environment,
          additional_context: JSON.stringify(error.additionalContext || {})
        });
      }

      // Update statistics
      await this.updateStatistics(error, categoryId);
    } catch (err) {
      console.error('Failed to store error:', err);
    }
  }

  private async updateStatistics(error: ErrorReport, categoryId?: number): Promise<void> {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const hourKey = now.getHours().toString().padStart(2, '0');

    try {
      const { data: existingStats } = await window.ezsite.apis.tablePage(37304, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: false,
        Filters: [
        { name: 'date_key', op: 'Equal', value: dateKey },
        { name: 'hour_key', op: 'Equal', value: hourKey },
        { name: 'error_type', op: 'Equal', value: error.errorType }]

      });

      if (existingStats?.List && existingStats.List.length > 0) {
        const existing = existingStats.List[0];
        await window.ezsite.apis.tableUpdate(37304, {
          id: existing.id,
          error_count: existing.error_count + 1,
          avg_severity: (existing.avg_severity + error.severityLevel) / 2
        });
      } else {
        await window.ezsite.apis.tableCreate(37304, {
          date_key: dateKey,
          hour_key: hourKey,
          category_id: categoryId,
          error_type: error.errorType,
          error_count: 1,
          unique_errors: 1,
          affected_users: error.userId ? 1 : 0,
          avg_severity: error.severityLevel,
          created_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to update statistics:', err);
    }
  }

  private startAlertProcessor(): void {
    if (this.isProcessingAlerts) return;

    this.isProcessingAlerts = true;
    setInterval(async () => {
      if (this.alertQueue.length > 0) {
        const errors = [...this.alertQueue];
        this.alertQueue = [];
        await this.processAlerts(errors);
      }
    }, 30000); // Process alerts every 30 seconds
  }

  private async processAlerts(errors: ErrorReport[]): Promise<void> {
    try {
      // Group errors by category and severity
      const errorGroups = errors.reduce((groups, error) => {
        const categoryId = this.categorizeError(error);
        const key = `${categoryId}-${error.severityLevel}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(error);
        return groups;
      }, {} as Record<string, ErrorReport[]>);

      // Check alert thresholds
      for (const [key, groupErrors] of Object.entries(errorGroups)) {
        const [categoryIdStr] = key.split('-');
        const categoryId = parseInt(categoryIdStr);
        const category = this.categories.find((c) => c.id === categoryId);

        if (category && groupErrors.length >= category.alert_threshold) {
          await this.triggerAlert(category, groupErrors);
        }
      }
    } catch (error) {
      console.error('Failed to process alerts:', error);
    }
  }

  private async triggerAlert(category: ErrorCategory, errors: ErrorReport[]): Promise<void> {
    try {
      // Log alert trigger
      console.warn(`🚨 ERROR ALERT: ${category.name} - ${errors.length} errors detected`);

      // In a real implementation, you would send emails, webhooks, etc.
      // For now, we'll just create an alert record

      const now = new Date().toISOString();
      const { data: existingAlerts } = await window.ezsite.apis.tablePage(37303, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: false,
        Filters: [
        { name: 'category_id', op: 'Equal', value: category.id },
        { name: 'is_enabled', op: 'Equal', value: true }]

      });

      if (existingAlerts?.List && existingAlerts.List.length > 0) {
        const alert = existingAlerts.List[0];
        await window.ezsite.apis.tableUpdate(37303, {
          id: alert.id,
          last_triggered: now,
          trigger_count: alert.trigger_count + 1
        });
      }
    } catch (error) {
      console.error('Failed to trigger alert:', error);
    }
  }

  async getErrorStatistics(dateRange: {from: Date;to: Date;}): Promise<any> {
    try {
      const fromDate = dateRange.from.toISOString().split('T')[0];
      const toDate = dateRange.to.toISOString().split('T')[0];

      const { data, error } = await window.ezsite.apis.tablePage(37304, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'date_key',
        IsAsc: true,
        Filters: [
        { name: 'date_key', op: 'GreaterThanOrEqual', value: fromDate },
        { name: 'date_key', op: 'LessThanOrEqual', value: toDate }]

      });

      if (error) throw new Error(error);
      return data?.List || [];
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return [];
    }
  }

  async getRecentErrors(limit = 50): Promise<ErrorTracking[]> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37302, {
        PageNo: 1,
        PageSize: limit,
        OrderByField: 'last_seen',
        IsAsc: false,
        Filters: []
      });

      if (error) throw new Error(error);
      return data?.List || [];
    } catch (error) {
      console.error('Failed to get recent errors:', error);
      return [];
    }
  }

  async markErrorResolved(errorId: number, resolutionNotes: string): Promise<void> {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(37302, {
        id: errorId,
        is_resolved: true,
        resolution_notes: resolutionNotes
      });

      if (error) throw new Error(error);
    } catch (err) {
      console.error('Failed to mark error as resolved:', err);
      throw err;
    }
  }
}

export const errorTrackingService = EnhancedErrorTrackingService.getInstance();

// Global error handler setup
if (typeof window !== 'undefined') {
  // Handle unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    errorTrackingService.reportError({
      errorType: 'JavaScript Error',
      errorMessage: event.message,
      errorStack: event.error?.stack,
      url: event.filename || window.location.href,
      severityLevel: 2,
      additionalContext: {
        line: event.lineno,
        column: event.colno
      }
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorTrackingService.reportError({
      errorType: 'Unhandled Promise Rejection',
      errorMessage: event.reason?.message || String(event.reason),
      errorStack: event.reason?.stack,
      severityLevel: 2,
      additionalContext: {
        reason: event.reason
      }
    });
  });
}

export default errorTrackingService;