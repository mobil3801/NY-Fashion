
/**
 * Console debugging utilities for development
 */

import { ApiError, createEnhancedErrorReport } from '@/lib/errors';
import { networkSimulator } from './debugTestUtils';

/**
 * Enhanced console logging for debug mode
 */
class DebugLogger {
  private isEnabled = process.env.NODE_ENV === 'development';
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    if (!this.isEnabled) return false;
    
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `🔧 [${timestamp}]`;
    
    if (data) {
      return `${prefix} ${message}\n${JSON.stringify(data, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`[DEBUG] ${message}`, data));
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(`[INFO] ${message}`, data));
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(`[WARN] ${message}`, data));
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(`[ERROR] ${message}`, data));
    }
  }

  // API-specific logging
  apiCall(method: string, url: string, duration: number, success: boolean, data?: any) {
    const status = success ? '✅' : '❌';
    const message = `${status} ${method} ${url} (${duration.toFixed(0)}ms)`;
    
    if (success) {
      this.debug(message, data);
    } else {
      this.error(message, data);
    }
  }

  // Network-specific logging
  networkEvent(event: string, data?: any) {
    this.info(`🌐 Network: ${event}`, data);
  }

  // Retry-specific logging
  retryAttempt(operation: string, attempt: number, maxAttempts: number, error?: ApiError) {
    const message = `🔄 Retry ${operation}: attempt ${attempt}/${maxAttempts}`;
    
    if (error) {
      this.warn(message, { error: error.message, type: error.type });
    } else {
      this.debug(message);
    }
  }
}

// Global logger instance
export const debugLogger = new DebugLogger();

/**
 * Console commands for debugging (available in browser console)
 */
export const debugCommands = {
  // Network simulation
  simulateOffline: (duration: number = 10000) => {
    networkSimulator.start({ condition: 'offline' });
    setTimeout(() => networkSimulator.stop(), duration);
    console.log(`🔧 Simulating offline mode for ${duration / 1000} seconds`);
  },

  simulateSlow: (duration: number = 15000) => {
    networkSimulator.start({ condition: 'slow' });
    setTimeout(() => networkSimulator.stop(), duration);
    console.log(`🔧 Simulating slow network for ${duration / 1000} seconds`);
  },

  simulateIntermittent: (duration: number = 20000) => {
    networkSimulator.start({ condition: 'intermittent' });
    setTimeout(() => networkSimulator.stop(), duration);
    console.log(`🔧 Simulating intermittent network for ${duration / 1000} seconds`);
  },

  stopSimulation: () => {
    networkSimulator.stop();
    console.log('🔧 Network simulation stopped');
  },

  // Debug utilities
  clearAllStorage: () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    console.log('🔧 All storage cleared');
  },

  showNetworkInfo: () => {
    const connection = (navigator as any).connection;
    console.table({
      'Online': navigator.onLine,
      'Connection Type': connection?.effectiveType || 'Unknown',
      'Downlink': connection?.downlink || 'Unknown',
      'RTT': connection?.rtt || 'Unknown',
      'Save Data': connection?.saveData || 'Unknown'
    });
  },

  testEndpoints: async () => {
    const endpoints = [
      `${window.location.origin}/`,
      `${window.location.origin}/api/health`,
      'https://www.google.com',
      'https://api.github.com'
    ];

    console.log('🔧 Testing endpoints...');
    
    for (const endpoint of endpoints) {
      const start = performance.now();
      try {
        const response = await fetch(endpoint, { 
          method: 'HEAD', 
          cache: 'no-cache',
          mode: endpoint.includes(window.location.origin) ? 'same-origin' : 'no-cors'
        });
        const duration = performance.now() - start;
        console.log(`✅ ${endpoint}: ${duration.toFixed(0)}ms`);
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`❌ ${endpoint}: ${duration.toFixed(0)}ms - ${error}`);
      }
    }
  },

  generateErrorReport: async (error?: Error) => {
    const testError = error || new Error('Test error for debugging');
    const report = await createEnhancedErrorReport(testError, {
      action: 'Manual error report generation',
      timestamp: new Date().toISOString()
    });
    
    console.group('🔧 Error Report');
    console.log(JSON.stringify(report, null, 2));
    console.groupEnd();
    
    return report;
  },

  // Logging controls
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => {
    debugLogger.setLogLevel(level);
    console.log(`🔧 Log level set to: ${level}`);
  },

  enableDebugLogging: () => {
    debugLogger.setEnabled(true);
    console.log('🔧 Debug logging enabled');
  },

  disableDebugLogging: () => {
    debugLogger.setEnabled(false);
    console.log('🔧 Debug logging disabled');
  }
};

/**
 * Initialize console debugging utilities
 */
export function initConsoleDebugUtils() {
  if (process.env.NODE_ENV === 'development') {
    // Make debug commands available globally
    (window as any).debug = debugCommands;
    (window as any).debugLogger = debugLogger;

    // Log available commands
    console.group('🔧 Debug Commands Available');
    console.log('Access debug utilities via window.debug:');
    Object.keys(debugCommands).forEach(command => {
      console.log(`  debug.${command}()`);
    });
    console.log('\nExample usage:');
    console.log('  debug.simulateOffline(5000)  // Simulate offline for 5 seconds');
    console.log('  debug.testEndpoints()        // Test network connectivity');
    console.log('  debug.showNetworkInfo()      // Display network information');
    console.groupEnd();

    debugLogger.info('Debug utilities initialized');
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  initConsoleDebugUtils();
}
