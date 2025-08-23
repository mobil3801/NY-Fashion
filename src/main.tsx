
import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import { initConsoleDebugUtils } from '@/utils/consoleDebugUtils';
import './index.css';

// Initialize debug utilities
if (process.env.NODE_ENV === 'development') {
  initConsoleDebugUtils();
}

// Set up global network context reference for toast actions
if (typeof window !== 'undefined') {
  (window as any).networkContext = null;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NetworkProvider>
      <OfflineBanner />
      <App />
    </NetworkProvider>
  </React.StrictMode>
);
