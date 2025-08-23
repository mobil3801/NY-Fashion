import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SafeNetworkProvider from '@/components/network/SafeNetworkProvider';
import ProductionSecurityProvider from '@/components/security/ProductionSecurityProvider';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import { setupPageLifecycle } from '@/lib/lifecycle';
import { initializeSecurity } from '@/config/security';
import { httpsEnforcer } from '@/utils/https-enforcer';
import { securityHeadersManager } from '@/utils/security-headers';
import { productionDebugDisabler } from '@/utils/production-debug-disabler';
import { environmentValidator } from '@/utils/env-validator';
import './index.css';
import './styles/accessibility.css';

// Initialize production security measures with better error handling
const initializeApp = async () => {
  try {
    // Validate environment variables with more lenient approach
    try {
      const envValidation = environmentValidator.validateAll();

      if (!envValidation.isValid) {
        console.warn('Environment validation issues found:', envValidation.errors);
        // In production builds, we'll continue with warnings rather than failing hard
        const nodeEnv = import.meta.env.NODE_ENV || 'production';
        console.warn('Continuing with environment:', nodeEnv);
      }

      if (envValidation.warnings.length > 0) {
        console.warn('Environment warnings:', envValidation.warnings);
      }
    } catch (envError) {
      console.warn('Environment validation failed, using defaults:', envError);
      // Continue execution with default values
    }

    if (envValidation.warnings.length > 0) {
      console.warn('Environment warnings:', envValidation.warnings);
    }

    // Initialize core security
    try {
      const { initializeSecurity } = await import('@/config/security');
      initializeSecurity();
    } catch (securityError) {
      console.warn('Security initialization warning:', securityError);
      // Continue execution - security features are optional
    }

    // Initialize HTTPS enforcement
    try {
      httpsEnforcer.initialize();
    } catch (httpsError) {
      console.warn('HTTPS enforcement warning:', httpsError);
    }

    // Initialize security headers
    try {
      securityHeadersManager.initialize();
    } catch (headersError) {
      console.warn('Security headers warning:', headersError);
    }

    // Initialize debug disabler for production
    const nodeEnv = import.meta.env.NODE_ENV || 'production';
    if (nodeEnv === 'production') {
      console.log('Initializing production security measures...');
      try {
        productionDebugDisabler.initialize();
      } catch (debugError) {
        console.warn('Debug disabler warning:', debugError);
      }
    }

  } catch (error) {
    console.error('App initialization error:', error);
    // Continue with app initialization even if some security features fail
  }
};

// Initialize debug utilities (development only)
const initializeDevFeatures = () => {
  try {
    const nodeEnv = import.meta.env.NODE_ENV || 'production';
    const isDev = import.meta.env.DEV === true || nodeEnv === 'development';

    if (isDev) {
      initConsoleDebugUtils();

      // Enhanced unload protection - prevent deprecated unload listeners
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

        // Cleanup on page hide
        window.addEventListener('pagehide', () => {
          lifecycleManager.cleanup();
        });
      } catch (lifecycleError) {
        console.warn('Lifecycle manager warning:', lifecycleError);
      }

      // Report any existing unload handlers
      setTimeout(() => {
        import('@/devtools/assertNoUnload').then(({ reportUnloadHandlers }) => {
          reportUnloadHandlers();
        }).catch(() => {
          console.log('[Debug] Unload protection initialized');
        });
      }, 1000);
    }
  } catch (error) {
    console.warn('Dev features initialization warning:', error);
  }
};

// Dev-only console command for contrast checking
const initializeDevCommands = () => {
  try {
    if (import.meta.env.DEV) {
      (window as any).checkContrast = () => {
        console.log('[A11y] Running contrast check...');

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

        // Check all badge and text elements
        document.querySelectorAll('[class*="badge"], [class*="text-"]').forEach(checkElement);
      };
    }
  } catch (error) {
    console.warn('Dev commands initialization warning:', error);
  }
};

// Main initialization
const startApp = async () => {
  try {
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
        <ProductionSecurityProvider>
          <SafeNetworkProvider>
            <App />
          </SafeNetworkProvider>
        </ProductionSecurityProvider>
      </React.StrictMode>
    );

    console.log('App initialized successfully');

  } catch (error) {
    console.error('Failed to start app:', error);

    // Fallback error display
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
            max-width: 500px;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ">
            <h1 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.25rem; font-weight: 600;">
              Application Error
            </h1>
            <p style="margin-bottom: 1.5rem; line-height: 1.6;">
              The application failed to start. Please refresh the page or try again later.
            </p>
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
              "
            >
              Reload Page
            </button>
            <details style="margin-top: 1.5rem; text-align: left;">
              <summary style="cursor: pointer; font-weight: 500; margin-bottom: 0.5rem;">Error Details</summary>
              <pre style="
                background: #f3f4f6;
                padding: 1rem;
                border-radius: 4px;
                font-size: 0.75rem;
                overflow-x: auto;
                color: #6b7280;
              ">${error instanceof Error ? error.stack : String(error)}</pre>
            </details>
          </div>
        </div>
      `;
    }
  }
};

// Start the application
startApp();