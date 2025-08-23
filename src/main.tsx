import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SafeNetworkProvider from '@/components/network/SafeNetworkProvider';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import './index.css';

// Initialize debug utilities and unload protection
if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
  initConsoleDebugUtils();

  // Import and initialize unload protection (async to avoid blocking)
  import('@/devtools/assertNoUnload').then(({ enableUnloadProtection, reportUnloadHandlers }) => {
    enableUnloadProtection({
      throwOnUnload: true,
      throwOnBeforeUnload: false, // Allow for form protection
      logWarnings: true,
      allowedOrigins: ['easysite.ai', 'googleapis.com']
    });

    // Report any existing unload handlers
    setTimeout(reportUnloadHandlers, 1000);
  }).catch((error) => {
    console.warn('[Debug] Failed to initialize unload protection:', error);
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SafeNetworkProvider>
      <App />
    </SafeNetworkProvider>
  </React.StrictMode>
);