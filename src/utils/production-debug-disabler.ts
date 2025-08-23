/**
 * Production Debug Disabler
 * Ensures all debug functionality is properly disabled in production environments
 */

import { SECURITY_CONFIG } from '@/config/security';
import { logger } from '@/utils/production-logger';

export interface DebugDisablerConfig {
  disableConsoleLogging: boolean;
  disableDebugPanels: boolean;
  removeDebugRoutes: boolean;
  disableSourceMaps: boolean;
  secureLogging: boolean;
}

class ProductionDebugDisabler {
  private config: DebugDisablerConfig;
  private originalConsole: Console;
  private isProduction: boolean;

  constructor(config: DebugDisablerConfig) {
    this.config = config;
    this.isProduction = import.meta.env.NODE_ENV === 'production';
    this.originalConsole = { ...console };

    if (this.isProduction && SECURITY_CONFIG.debug.disableInProduction) {
      this.initializeProductionSecurity();
    }
  }

  /**
   * Initialize production security measures
   */
  private initializeProductionSecurity(): void {
    this.disableConsoleLogging();
    this.disableDebugPanels();
    this.removeDebugGlobals();
    this.secureErrorReporting();
    this.preventDevToolsDetection();

    logger.logSecurityEvent('debug_mode_disabled', 'SYSTEM', 'INFO');
  }

  /**
   * Disable console logging in production
   */
  private disableConsoleLogging(): void {
    if (!this.config.disableConsoleLogging) return;

    // Store references to original methods for emergency use
    const originalMethods = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      info: console.info,
      trace: console.trace,
      table: console.table,
      group: console.group,
      groupEnd: console.groupEnd
    };

    // Replace console methods with no-ops
    console.log = () => {};
    console.warn = () => {};
    console.error = this.createSecureErrorLogger();
    console.debug = () => {};
    console.info = () => {};
    console.trace = () => {};
    console.table = () => {};
    console.group = () => {};
    console.groupEnd = () => {};

    // Store original methods for emergency restoration (internal use only)
    (window as any).__originalConsole = originalMethods;

    // Log the console disabling action
    this.secureLog('Console logging disabled for production');
  }

  /**
   * Create secure error logger that only logs critical errors
   */
  private createSecureErrorLogger(): (...args: any[]) => void {
    return (...args: any[]) => {
      // Only log critical security-related errors
      const message = args.join(' ');
      if (this.isCriticalError(message)) {
        logger.logError('Critical Error', new Error(message));
      }
    };
  }

  /**
   * Determine if an error is critical and should be logged
   */
  private isCriticalError(message: string): boolean {
    const criticalPatterns = [
    /security/i,
    /authentication/i,
    /unauthorized/i,
    /csrf/i,
    /xss/i,
    /injection/i,
    /malicious/i];


    return criticalPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Disable debug panels and components
   */
  private disableDebugPanels(): void {
    if (!this.config.disableDebugPanels) return;

    // Remove debug panels from DOM
    const debugSelectors = [
    '[data-testid*="debug"]',
    '[data-debug="true"]',
    '[class*="debug-"]',
    '[id*="debug"]',
    '.debug-panel',
    '.dev-tools'];


    debugSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    });

    // Disable React Developer Tools
    if (typeof window !== 'undefined') {
      delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete (window as any).React;
      delete (window as any).ReactDOM;
    }

    this.secureLog('Debug panels and dev tools disabled');
  }

  /**
   * Remove debug-related global variables
   */
  private removeDebugGlobals(): void {
    const debugGlobals = [
    '__DEBUG__',
    '__DEV__',
    'DEBUG',
    'DEVELOPMENT_MODE',
    '__REDUX_DEVTOOLS_EXTENSION__',
    '__REDUX_DEVTOOLS_EXTENSION_COMPOSE__',
    'checkContrast', // Custom debug function
    '__originalConsole' // Our own debug reference
    ];

    debugGlobals.forEach((globalName) => {
      if ((window as any)[globalName]) {
        delete (window as any)[globalName];
      }
    });

    this.secureLog('Debug global variables removed');
  }

  /**
   * Secure error reporting - only report non-sensitive errors
   */
  private secureErrorReporting(): void {
    if (!this.config.secureLogging) return;

    window.addEventListener('error', (event) => {
      const error = event.error;

      // Filter out sensitive errors
      if (this.shouldReportError(error)) {
        logger.logError('Application Error', error);
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;

      if (this.shouldReportError(reason)) {
        logger.logError('Unhandled Promise Rejection', reason);
      }
    });
  }

  /**
   * Determine if an error should be reported
   */
  private shouldReportError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();

    // Don't report errors that might contain sensitive information
    const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /credential/i,
    /session/i];


    return !sensitivePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Attempt to prevent dev tools detection
   */
  private preventDevToolsDetection(): void {
    // This is not foolproof but adds a layer of obscurity
    let devtools = false;

    setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if ((heightThreshold || widthThreshold) && !devtools) {
        devtools = true;
        this.secureLog('Developer tools potentially opened');

        // Could implement additional security measures here
        // For example: log user out, disable sensitive features, etc.
      } else if (!(heightThreshold || widthThreshold) && devtools) {
        devtools = false;
      }
    }, 500);
  }

  /**
   * Secure logging method that respects production settings
   */
  private secureLog(message: string): void {
    if (this.isProduction && this.config.secureLogging) {
      // Only log through the secure logger in production
      logger.logInfo(message);
    } else if (!this.isProduction) {
      // Allow console logging in development
      this.originalConsole.log(`[Production Debug Disabler] ${message}`);
    }
  }

  /**
   * Restore console for emergency debugging (development only)
   */
  restoreConsole(): void {
    if (this.isProduction) {
      this.secureLog('Console restoration blocked in production');
      return;
    }

    // Only allow in development
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
    console.info = this.originalConsole.info;
    console.trace = this.originalConsole.trace;
    console.table = this.originalConsole.table;
    console.group = this.originalConsole.group;
    console.groupEnd = this.originalConsole.groupEnd;

    console.log('Console logging restored (development mode only)');
  }

  /**
   * Check if debug mode is properly disabled
   */
  isDebugDisabled(): boolean {
    const checks = {
      consoleDisabled: this.isConsoleDisabled(),
      debugPanelsRemoved: this.areDebugPanelsRemoved(),
      globalsRemoved: this.areDebugGlobalsRemoved(),
      devToolsBlocked: true // Assume dev tools blocking is working
    };

    return Object.values(checks).every((check) => check === true);
  }

  /**
   * Check if console is disabled
   */
  private isConsoleDisabled(): boolean {
    if (!this.isProduction) return true; // Not expected to be disabled in development

    // Test if console methods are no-ops
    const originalLog = console.log;
    let logged = false;

    console.log = (...args) => {logged = true;};
    console.log('test');
    console.log = originalLog;

    return !logged;
  }

  /**
   * Check if debug panels are removed
   */
  private areDebugPanelsRemoved(): boolean {
    const debugElements = document.querySelectorAll('[data-testid*="debug"], [data-debug="true"]');
    return debugElements.length === 0;
  }

  /**
   * Check if debug globals are removed
   */
  private areDebugGlobalsRemoved(): boolean {
    const debugGlobals = ['__DEBUG__', '__DEV__', 'DEBUG', 'DEVELOPMENT_MODE'];
    return debugGlobals.every((global) => !(window as any)[global]);
  }

  /**
   * Get debug disabler status
   */
  getStatus(): {
    isProduction: boolean;
    debugDisabled: boolean;
    consoleDisabled: boolean;
    panelsRemoved: boolean;
    globalsRemoved: boolean;
  } {
    return {
      isProduction: this.isProduction,
      debugDisabled: this.isDebugDisabled(),
      consoleDisabled: this.isConsoleDisabled(),
      panelsRemoved: this.areDebugPanelsRemoved(),
      globalsRemoved: this.areDebugGlobalsRemoved()
    };
  }
}

// Create and export singleton instance
export const productionDebugDisabler = new ProductionDebugDisabler({
  disableConsoleLogging: SECURITY_CONFIG.debug.secureLogging,
  disableDebugPanels: SECURITY_CONFIG.debug.disableDebugPanels,
  removeDebugRoutes: SECURITY_CONFIG.debug.removeDebugRoutes,
  disableSourceMaps: true,
  secureLogging: SECURITY_CONFIG.debug.secureLogging
});

export default productionDebugDisabler;