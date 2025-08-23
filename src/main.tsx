import React from "react";
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

// Initialize production security measures first
try {
  // Validate environment variables
  const envValidation = environmentValidator.validateAll();
  if (!envValidation.isValid && import.meta.env.NODE_ENV === 'production') {
    throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
  }

  // Initialize core security
  initializeSecurity();

  // Initialize HTTPS enforcement
  httpsEnforcer.initialize();

  // Initialize security headers
  securityHeadersManager.initialize();

  // Initialize debug disabler for production
  if (import.meta.env.NODE_ENV === 'production') {
    console.log('Initializing production security measures...');
  }

} catch (error) {
  console.error('Security initialization failed:', error);
  if (import.meta.env.NODE_ENV === 'production') {
    throw error; // Fail fast in production
  }
}

// Initialize debug utilities (development only)
if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
  initConsoleDebugUtils();

  // Enhanced unload protection - prevent deprecated unload listeners
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function (type: any, ...rest: any[]) {
    if (type === 'unload') {
      throw new Error('Do not use unload in main frame - use pagehide/visibilitychange instead');
    }
    // @ts-ignore
    return originalAddEventListener.call(this, type, ...rest);
  };

  // Initialize modern page lifecycle management
  const lifecycleManager = setupPageLifecycle();

  // Report any existing unload handlers
  setTimeout(() => {
    import('@/devtools/assertNoUnload').then(({ reportUnloadHandlers }) => {
      reportUnloadHandlers();
    }).catch(() => {
      console.log('[Debug] Unload protection initialized');
    });
  }, 1000);

  // Cleanup on page hide
  window.addEventListener('pagehide', () => {
    lifecycleManager.cleanup();
  });
}

// Dev-only console command for contrast checking
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProductionSecurityProvider>
      <SafeNetworkProvider>
        <App />
      </SafeNetworkProvider>
    </ProductionSecurityProvider>
  </React.StrictMode>
);