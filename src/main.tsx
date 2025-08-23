
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { POSProvider } from '@/contexts/POSContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { PurchaseOrderProvider } from '@/contexts/PurchaseOrderContext';
import { EmployeeProvider } from '@/contexts/EmployeeContext';
import EnhancedAuthContext from  '@/contexts/EnhancedAuthContext';
import EnhancedNetworkContext from  '@/contexts/EnhancedNetworkContext';
import ProductionContext from  '@/contexts/ProductionContext';
import SafeNetworkProvider from '@/components/network/SafeNetworkProvider';
import ProductionSecurityProvider from '@/components/security/ProductionSecurityProvider';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import { setupPageLifecycle } from '@/lib/lifecycle';
import { environmentValidator, isProduction } from '@/utils/env-validator';
import { logger } from '@/utils/production-logger';
import { auditLogger } from '@/utils/audit-logger';

// Lazy load debug provider only in development
const DebugProviderLazy = React.lazy(async () => {
  if (isProduction()) {
    // Return a no-op component in production
    return { default: ({ children }: { children: React.ReactNode }) => <>{children}</> };
  }
  try {
    const { DebugProvider } = await import('@/debug/DebugProvider');
    return { default: DebugProvider };
  } catch (error) {
    console.warn('Failed to load DebugProvider:', error);
    return { default: ({ children }: { children: React.ReactNode }) => <>{children}</> };
  }
});

import { ENV_CONFIG } from '@/config/environment';
import './index.css';
import './styles/accessibility.css';

// Initialize production security measures with better error handling
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing application...');
    
    // Environment validation - non-blocking in production
    const envValidation = environmentValidator.validateAll();
    
    console.log('Environment validation:', {
      environment: envValidation.environment,
      isValid: envValidation.isValid,
      errors: envValidation.errors,
      warnings: envValidation.warnings
    });

    // Log warnings but don't fail
    if (envValidation.warnings.length > 0) {
      console.warn('Environment warnings:', envValidation.warnings);
      logger.logWarn('Environment configuration warnings', envValidation.warnings);
    }

    // Only fail in development, log in production
    if (envValidation.errors.length > 0) {
      if (envValidation.environment === 'development') {
        console.error('Environment validation failed:', envValidation.errors);
        logger.logError('Environment validation failed', new Error('Invalid environment configuration'), envValidation);
        throw new Error('Invalid environment configuration');
      } else {
        // In production, log errors as warnings but don't block startup
        console.warn('Environment issues (non-blocking):', envValidation.errors);
        logger.logWarn('Environment configuration issues (non-blocking)', envValidation.errors);
      }
    }

    // Set global environment info for debugging
    if (typeof window !== 'undefined') {
      (window as any).__ENV__ = ENV_CONFIG;
      (window as any).__ENV_INFO__ = envValidation;
      logger.setUserId('system');
    }

    // Initialize security features with error handling
    try {
      if (ENV_CONFIG.SECURITY.ENABLE_HTTPS_ENFORCEMENT && ENV_CONFIG.IS_PRODUCTION) {
        const { httpsEnforcer } = await import('@/utils/https-enforcer');
        httpsEnforcer.initialize();
        logger.logSecurityEvent('https_enforcer_initialized');
      }
    } catch (error) {
      console.warn('HTTPS enforcement initialization warning:', error);
      logger.logWarn('HTTPS enforcement initialization warning', error);
    }

    try {
      if (ENV_CONFIG.SECURITY.ENABLE_SECURITY_HEADERS) {
        const { securityHeadersManager } = await import('@/utils/security-headers');
        securityHeadersManager.initialize();
        logger.logSecurityEvent('security_headers_initialized');
      }
    } catch (error) {
      console.warn('Security headers initialization warning:', error);
      logger.logWarn('Security headers initialization warning', error);
    }

    // Initialize production debug disabler
    if (ENV_CONFIG.IS_PRODUCTION) {
      try {
        const { productionDebugDisabler } = await import('@/utils/production-debug-disabler');
        productionDebugDisabler.initialize();
        console.log('Production debug disabler initialized');
        logger.logInfo('Production debug disabler initialized');
      } catch (error) {
        console.warn('Debug disabler warning:', error);
        logger.logWarn('Debug disabler warning', error);
      }
    }

    // Initialize core security
    try {
      const { initializeSecurity } = await import('@/config/security');
      initializeSecurity();
      logger.logSecurityEvent('core_security_initialized');
    } catch (error) {
      console.warn('Security initialization warning:', error);
      logger.logWarn('Security initialization warning', error);
    }

    // Log successful initialization
    logger.logInfo('Application initialization completed successfully', {
      environment: envValidation.environment,
      timestamp: new Date().toISOString(),
      features: {
        httpsEnforcement: ENV_CONFIG.SECURITY.ENABLE_HTTPS_ENFORCEMENT,
        securityHeaders: ENV_CONFIG.SECURITY.ENABLE_SECURITY_HEADERS,
        debugMode: ENV_CONFIG.FEATURES.ENABLE_DEBUG
      }
    });

    auditLogger.logSystemEvent('application_initialized', {
      environment: envValidation.environment,
      version: '1.0.0'
    }, true);

    console.log('✅ App initialization completed successfully');

  } catch (error) {
    console.error('App initialization error:', error);
    logger.logError('App initialization error', error, {
      timestamp: new Date().toISOString(),
      environment: environmentValidator.getEnvironment()
    });
    
    auditLogger.logSystemEvent('application_initialization_failed', {
      error: error instanceof Error ? error.message : String(error)
    }, false);

    // Continue with app initialization even if some features fail
  }
};

// Initialize development features
const initializeDevFeatures = () => {
  try {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log('🔧 Initializing development features...');
      
      // Initialize debug utilities
      if (ENV_CONFIG.FEATURES.ENABLE_DEBUG) {
        initConsoleDebugUtils();
        logger.logInfo('Console debug utilities initialized');
      }

      // Enhanced unload protection
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = function (type: any, ...rest: any[]) {
        if (type === 'unload') {
          console.warn('Preventing deprecated unload listener - use pagehide/visibilitychange instead');
          return;
        }
        // @ts-ignore
        return originalAddEventListener.call(this, type, ...rest);
      };

      // Initialize modern page lifecycle management
      try {
        const lifecycleManager = setupPageLifecycle();
        window.addEventListener('pagehide', () => {
          lifecycleManager.cleanup();
        });
        logger.logInfo('Page lifecycle management initialized');
      } catch (lifecycleError) {
        console.warn('Lifecycle manager warning:', lifecycleError);
        logger.logWarn('Lifecycle manager warning', lifecycleError);
      }

      // Report any existing unload handlers
      setTimeout(() => {
        import('@/devtools/assertNoUnload').then(({ reportUnloadHandlers }) => {
          reportUnloadHandlers();
        }).catch(() => {
          console.log('[Debug] Unload protection initialized');
        });
      }, 1000);

      logger.logInfo('Development features initialized');
      console.log('✅ Development features initialized');
    }
  } catch (error) {
    console.warn('Dev features initialization warning:', error);
    logger.logWarn('Dev features initialization warning', error);
  }
};

// Development commands
const initializeDevCommands = () => {
  try {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      // Add global debug commands
      (window as any).checkContrast = () => {
        console.log('[A11y] Running contrast check...');
        logger.logInfo('Accessibility contrast check initiated');
        
        const checkElement = (el: Element) => {
          const styles = getComputedStyle(el);
          const bgColor = styles.backgroundColor;
          const color = styles.color;
          const fontSize = parseFloat(styles.fontSize);
          const fontWeight = styles.fontWeight;

          console.log(`Element: ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`, {
            background: bgColor,
            color: color,
            fontSize: `${fontSize}px`,
            fontWeight: fontWeight
          });
        };

        document.querySelectorAll('[class*="badge"], [class*="text-"]').forEach(checkElement);
      };

      // Environment debugging
      (window as any).showEnv = () => {
        console.log('Current Environment Config:', ENV_CONFIG);
        console.log('Environment Validation:', environmentValidator.validateAll());
        logger.logInfo('Environment information displayed', { method: 'showEnv' });
      };

      // Error monitoring debugging
      (window as any).showErrorLogs = () => {
        const errors = JSON.parse(localStorage.getItem('production_errors') || '[]');
        console.log('Production Errors:', errors);
        logger.logInfo('Error logs displayed', { errorCount: errors.length });
      };

      // Health monitoring debugging
      (window as any).showHealthMetrics = async () => {
        const { productionHealthMonitor } = await import('@/utils/production-health-monitor');
        const metrics = productionHealthMonitor.getLatestMetrics();
        const report = await productionHealthMonitor.generateHealthReport();
        console.log('Health Metrics:', metrics);
        console.log('Health Report:', report);
        logger.logInfo('Health metrics displayed');
      };

      logger.logInfo('Development commands initialized');
      console.log('🛠️ Development commands available: checkContrast(), showEnv(), showErrorLogs(), showHealthMetrics()');
    }
  } catch (error) {
    console.warn('Dev commands initialization warning:', error);
    logger.logWarn('Dev commands initialization warning', error);
  }
};

// Enhanced error fallback
const showErrorFallback = (error: any) => {
  logger.logError('Critical application error - showing fallback UI', error);
  auditLogger.logSystemEvent('application_error_fallback_shown', {
    error: error instanceof Error ? error.message : String(error)
  }, false);

  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #f9fafb;
        font-family: system-ui, -apple-system, sans-serif;
        color: #374151;
        padding: 1rem;
      ">
        <div style="
          text-align: center;
          max-width: 600px;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        ">
          <h1 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.25rem; font-weight: 600;">
            Application Error
          </h1>
          <p style="margin-bottom: 1.5rem; line-height: 1.6;">
            The application failed to start properly. This may be due to environment configuration issues.
          </p>
          <div style="margin-bottom: 1.5rem;">
            <button 
              onclick="window.location.reload()" 
              style="
                background: #10b981;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
                margin-right: 0.5rem;
              "
            >
              Reload Page
            </button>
            <button 
              onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" 
              style="
                background: #6b7280;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
              "
            >
              Clear Cache & Reload
            </button>
          </div>
          <details style="margin-top: 1.5rem; text-align: left;">
            <summary style="cursor: pointer; font-weight: 500; margin-bottom: 0.5rem;">Environment Info</summary>
            <pre style="
              background: #f3f4f6;
              padding: 1rem;
              border-radius: 4px;
              font-size: 0.75rem;
              overflow-x: auto;
              color: #6b7280;
              margin-bottom: 1rem;
            ">Environment: ${ENV_CONFIG.NODE_ENV || 'unknown'}
Mode: ${ENV_CONFIG.MODE || 'unknown'}
API URL: ${ENV_CONFIG.API?.BASE_URL || 'not configured'}
Debug: ${ENV_CONFIG.FEATURES?.ENABLE_DEBUG ? 'enabled' : 'disabled'}</pre>
            <details>
              <summary style="cursor: pointer; font-weight: 500; margin-bottom: 0.5rem;">Error Details</summary>
              <pre style="
                background: #fef2f2;
                padding: 1rem;
                border-radius: 4px;
                font-size: 0.75rem;
                overflow-x: auto;
                color: #dc2626;
              ">${error instanceof Error ? error.stack : String(error)}</pre>
            </details>
          </details>
        </div>
      </div>
    `;
  }
};

// Main initialization
const startApp = async () => {
  try {
    console.log(`🌟 Starting application in ${ENV_CONFIG.NODE_ENV} mode...`);
    logger.logInfo('Application startup initiated', {
      environment: ENV_CONFIG.NODE_ENV,
      timestamp: new Date().toISOString()
    });
    
    // Initialize app features
    await initializeApp();
    initializeDevFeatures();
    initializeDevCommands();

    // Render the app
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    const root = createRoot(rootElement);

    root.render(
      <React.StrictMode>
        <EnhancedAuthContext>
          <EnhancedNetworkContext>
            <ProductionContext>
              <POSProvider>
                <InventoryProvider>
                  <PurchaseOrderProvider>
                    <EmployeeProvider>
                      {!isProduction() ? (
                        <React.Suspense fallback={<div>Loading debug...</div>}>
                          <DebugProviderLazy>
                            <App />
                          </DebugProviderLazy>
                        </React.Suspense>
                      ) : (
                        <App />
                      )}
                    </EmployeeProvider>
                  </PurchaseOrderProvider>
                </InventoryProvider>
              </POSProvider>
            </ProductionContext>
          </EnhancedNetworkContext>
        </EnhancedAuthContext>
      </React.StrictMode>
    );

    logger.logInfo('Application rendered successfully');
    auditLogger.logSystemEvent('application_started', {
      environment: ENV_CONFIG.NODE_ENV,
      timestamp: new Date().toISOString()
    }, true);

    console.log('🎉 Application started successfully!');

  } catch (error) {
    console.error('💥 Failed to start app:', error);
    logger.logError('Failed to start application', error);
    auditLogger.logSystemEvent('application_startup_failed', {
      error: error instanceof Error ? error.message : String(error)
    }, false);
    showErrorFallback(error);
  }
};

// Start the application
startApp();
