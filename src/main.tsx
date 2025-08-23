import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SafeNetworkProvider from '@/components/network/SafeNetworkProvider';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import { setupPageLifecycle } from '@/lib/lifecycle';
import './index.css';
import './styles/accessibility.css';

// Initialize debug utilities and enhanced unload protection
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
    <SafeNetworkProvider>
      <App />
    </SafeNetworkProvider>
  </React.StrictMode>
);