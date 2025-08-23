import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import './index.css';

// Initialize debug utilities and unload protection
if (process.env.NODE_ENV === 'development') {
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
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NetworkProvider>
      <OfflineBanner />
      <App />
    </NetworkProvider>
  </React.StrictMode>
);