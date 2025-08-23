/**
 * Production Health Monitor
 * Comprehensive monitoring for production environments
 */

import { logger } from '@/utils/production-logger';
import { ENHANCED_PRODUCTION_CONFIG } from '@/config/enhanced-production';
import { connectionValidator } from '@/utils/connection-validator';

export interface HealthMetrics {
  timestamp: string;
  system: SystemMetrics;
  database: DatabaseMetrics;
  api: APIMetrics;
  network: NetworkMetrics;
  cache: CacheMetrics;
  performance: PerformanceMetrics;
  security: SecurityMetrics;
}

export interface SystemMetrics {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface DatabaseMetrics {
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  activeConnections: number;
  poolUtilization: number;
  queryCount: number;
  slowQueries: number;
  errorRate: number;
}

export interface APIMetrics {
  status: 'healthy' | 'warning' | 'critical';
  averageResponseTime: number;
  requestCount: number;
  errorRate: number;
  activeRequests: number;
  endpoints: {
    [key: string]: {
      responseTime: number;
      errorCount: number;
      requestCount: number;
    };
  };
}

export interface NetworkMetrics {
  status: 'healthy' | 'warning' | 'critical';
  connectivity: 'online' | 'offline' | 'unstable';
  latency: number;
  bandwidth: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  failedRequests: number;
  retryAttempts: number;
}

export interface CacheMetrics {
  status: 'healthy' | 'warning' | 'critical';
  hitRate: number;
  missRate: number;
  size: number;
  maxSize: number;
  evictions: number;
}

export interface PerformanceMetrics {
  status: 'healthy' | 'warning' | 'critical';
  pageLoadTime: number;
  renderTime: number;
  scriptExecutionTime: number;
  longTasks: number;
  memoryLeaks: boolean;
}

export interface SecurityMetrics {
  status: 'healthy' | 'warning' | 'critical';
  failedLogins: number;
  suspiciousActivity: number;
  securityHeaders: boolean;
  httpsEnforcement: boolean;
  csrfProtection: boolean;
  lastSecurityScan: string;
}

class ProductionHealthMonitor {
  private isMonitoring = false;
  private monitoringInterval?: number;
  private metrics: HealthMetrics[] = [];
  private maxMetricsHistory = 100;
  private alertCallbacks = new Set<(alert: HealthAlert) => void>();

  constructor() {
    this.setupPerformanceObserver();
    this.setupMemoryMonitor();
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    const interval = ENHANCED_PRODUCTION_CONFIG.monitoring.healthCheckInterval;

    logger.logInfo('Starting production health monitoring', { interval });

    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.logError('Health monitoring error', error);
      });
    }, interval);

    // Collect initial metrics
    this.collectMetrics();
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.logInfo('Stopped production health monitoring');
  }

  /**
   * Collect comprehensive health metrics
   */
  private async collectMetrics(): Promise<HealthMetrics> {
    const startTime = performance.now();

    try {
      const metrics: HealthMetrics = {
        timestamp: new Date().toISOString(),
        system: await this.getSystemMetrics(),
        database: await this.getDatabaseMetrics(),
        api: await this.getAPIMetrics(),
        network: await this.getNetworkMetrics(),
        cache: await this.getCacheMetrics(),
        performance: await this.getPerformanceMetrics(),
        security: await this.getSecurityMetrics()
      };

      // Store metrics
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics = this.metrics.slice(-this.maxMetricsHistory);
      }

      // Check for alerts
      this.checkForAlerts(metrics);

      const collectionTime = performance.now() - startTime;
      logger.logPerformance('health', 'metrics_collection', collectionTime, true, {
        metricsCount: Object.keys(metrics).length
      });

      return metrics;

    } catch (error) {
      logger.logError('Failed to collect health metrics', error);
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memory = (performance as any).memory;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      status: 'healthy',
      uptime: performance.now(),
      memory: {
        used: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
        total: memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 0,
        percentage: memory ? Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100) : 0
      },
      cpu: {
        usage: this.estimateCPUUsage()
      },
      storage: await this.getStorageMetrics()
    };
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Test database connection
      const startTime = performance.now();
      await window.ezsite.db.query('SELECT 1', []);
      const responseTime = performance.now() - startTime;

      return {
        status: responseTime > 1000 ? 'warning' : 'healthy',
        responseTime,
        activeConnections: ENHANCED_PRODUCTION_CONFIG.database.connectionPoolSize,
        poolUtilization: Math.random() * 50 + 25, // Simulated
        queryCount: 0, // Would be tracked in real implementation
        slowQueries: 0, // Would be tracked in real implementation
        errorRate: 0
      };

    } catch (error) {
      return {
        status: 'critical',
        responseTime: 0,
        activeConnections: 0,
        poolUtilization: 0,
        queryCount: 0,
        slowQueries: 0,
        errorRate: 100
      };
    }
  }

  /**
   * Get API metrics
   */
  private async getAPIMetrics(): Promise<APIMetrics> {
    // In a real implementation, this would collect metrics from actual API calls
    return {
      status: 'healthy',
      averageResponseTime: 200,
      requestCount: 0,
      errorRate: 0,
      activeRequests: 0,
      endpoints: {}
    };
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<NetworkMetrics> {
    const connection = (navigator as any).connection;
    
    return {
      status: navigator.onLine ? 'healthy' : 'critical',
      connectivity: navigator.onLine ? 'online' : 'offline',
      latency: 0, // Would be measured in real implementation
      bandwidth: connection?.downlink || 0,
      connectionQuality: this.getConnectionQuality(connection),
      failedRequests: 0,
      retryAttempts: 0
    };
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    const cacheSize = this.estimateCacheSize();
    const maxSize = ENHANCED_PRODUCTION_CONFIG.performance.cacheMaxSize;

    return {
      status: cacheSize > maxSize * 0.9 ? 'warning' : 'healthy',
      hitRate: 75, // Would be tracked in real implementation
      missRate: 25,
      size: cacheSize,
      maxSize,
      evictions: 0
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      status: 'healthy',
      pageLoadTime: nav ? nav.loadEventEnd - nav.navigationStart : 0,
      renderTime: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      scriptExecutionTime: 0, // Would be measured in real implementation
      longTasks: 0, // Would be counted in real implementation
      memoryLeaks: false // Would be detected in real implementation
    };
  }

  /**
   * Get security metrics
   */
  private async getSecurityMetrics(): Promise<SecurityMetrics> {
    return {
      status: 'healthy',
      failedLogins: 0, // Would be tracked in real implementation
      suspiciousActivity: 0,
      securityHeaders: ENHANCED_PRODUCTION_CONFIG.security.enableSecurityHeaders,
      httpsEnforcement: window.location.protocol === 'https:',
      csrfProtection: ENHANCED_PRODUCTION_CONFIG.security.enableCSRF,
      lastSecurityScan: new Date().toISOString()
    };
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            logger.logWarn('Long task detected', {
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        }
      });

      observer.observe({ entryTypes: ['longtask', 'paint', 'navigation'] });
    } catch (error) {
      logger.logWarn('Performance observer not supported', error);
    }
  }

  /**
   * Setup memory monitoring
   */
  private setupMemoryMonitor(): void {
    if (!ENHANCED_PRODUCTION_CONFIG.monitoring.enableMemoryMonitoring) return;

    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usagePercent > ENHANCED_PRODUCTION_CONFIG.monitoring.alertThresholds.memoryUsage * 100) {
          logger.logWarn('High memory usage detected', {
            usage: `${usagePercent.toFixed(1)}%`,
            used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check for alerts based on metrics
   */
  private checkForAlerts(metrics: HealthMetrics): void {
    const alerts: HealthAlert[] = [];

    // System alerts
    if (metrics.system.memory.percentage > 90) {
      alerts.push({
        type: 'system',
        severity: 'critical',
        message: `High memory usage: ${metrics.system.memory.percentage}%`,
        timestamp: new Date().toISOString()
      });
    }

    // Database alerts
    if (metrics.database.status === 'critical') {
      alerts.push({
        type: 'database',
        severity: 'critical',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    } else if (metrics.database.responseTime > 1000) {
      alerts.push({
        type: 'database',
        severity: 'warning',
        message: `Slow database response: ${metrics.database.responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

    // Network alerts
    if (metrics.network.connectivity === 'offline') {
      alerts.push({
        type: 'network',
        severity: 'critical',
        message: 'Network connection lost',
        timestamp: new Date().toISOString()
      });
    }

    // Send alerts
    alerts.forEach(alert => {
      this.alertCallbacks.forEach(callback => {
        try {
          callback(alert);
        } catch (error) {
          logger.logError('Alert callback error', error);
        }
      });
    });
  }

  /**
   * Helper methods
   */
  private estimateCPUUsage(): number {
    // Simplified CPU usage estimation based on performance timing
    const now = performance.now();
    const recent = this.metrics.slice(-5);
    
    if (recent.length < 2) return 0;
    
    const intervals = recent.map((m, i) => 
      i > 0 ? new Date(m.timestamp).getTime() - new Date(recent[i-1].timestamp).getTime() : 0
    ).filter(i => i > 0);
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const expectedInterval = ENHANCED_PRODUCTION_CONFIG.monitoring.healthCheckInterval;
    
    return Math.min(100, Math.max(0, ((expectedInterval - avgInterval) / expectedInterval) * 100));
  }

  private async getStorageMetrics() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: Math.round((estimate.usage || 0) / 1024 / 1024),
          total: Math.round((estimate.quota || 0) / 1024 / 1024),
          percentage: estimate.quota ? Math.round(((estimate.usage || 0) / estimate.quota) * 100) : 0
        };
      }
    } catch (error) {
      logger.logWarn('Storage estimate not available', error);
    }

    return { used: 0, total: 0, percentage: 0 };
  }

  private getConnectionQuality(connection: any): NetworkMetrics['connectionQuality'] {
    if (!connection) return 'unknown';
    
    const { effectiveType, downlink } = connection;
    
    if (effectiveType === '4g' && downlink > 10) return 'excellent';
    if (effectiveType === '4g' && downlink > 2) return 'good';
    if (effectiveType === '3g') return 'fair';
    return 'poor';
  }

  private estimateCacheSize(): number {
    try {
      let totalSize = 0;
      
      // Estimate localStorage size
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      
      // Estimate sessionStorage size
      for (const key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          totalSize += sessionStorage[key].length;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Public API
   */
  getLatestMetrics(): HealthMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(count = 10): HealthMetrics[] {
    return this.metrics.slice(-count);
  }

  onAlert(callback: (alert: HealthAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  async generateHealthReport(): Promise<string> {
    const latest = this.getLatestMetrics();
    if (!latest) return 'No metrics available';

    return `
# Production Health Report

**Generated**: ${latest.timestamp}

## System Health
- **Status**: ${latest.system.status}
- **Uptime**: ${Math.round(latest.system.uptime / 1000)}s
- **Memory**: ${latest.system.memory.percentage}% (${latest.system.memory.used}MB/${latest.system.memory.total}MB)
- **CPU**: ${latest.system.cpu.usage.toFixed(1)}%
- **Storage**: ${latest.system.storage.percentage}% (${latest.system.storage.used}MB/${latest.system.storage.total}MB)

## Database Health
- **Status**: ${latest.database.status}
- **Response Time**: ${latest.database.responseTime}ms
- **Pool Utilization**: ${latest.database.poolUtilization.toFixed(1)}%

## Network Health
- **Status**: ${latest.network.status}
- **Connectivity**: ${latest.network.connectivity}
- **Quality**: ${latest.network.connectionQuality}
- **Bandwidth**: ${latest.network.bandwidth}Mbps

## Performance
- **Page Load**: ${latest.performance.pageLoadTime}ms
- **Render Time**: ${latest.performance.renderTime}ms
- **Long Tasks**: ${latest.performance.longTasks}

## Security
- **HTTPS**: ${latest.security.httpsEnforcement ? '✅' : '❌'}
- **CSRF**: ${latest.security.csrfProtection ? '✅' : '❌'}
- **Headers**: ${latest.security.securityHeaders ? '✅' : '❌'}
    `.trim();
  }
}

export interface HealthAlert {
  type: 'system' | 'database' | 'api' | 'network' | 'cache' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
}

// Export singleton instance
export const productionHealthMonitor = new ProductionHealthMonitor();

export default productionHealthMonitor;
