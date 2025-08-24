
import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SafeNetworkProvider from '@/components/network/SafeNetworkProvider';
import { setupPageLifecycle } from '@/lib/lifecycle';
import { setupGlobalErrorHandling } from '@/lib/layout-error-handler';
import './index.css';
import './styles/accessibility.css';

// Initialize global error handling
setupGlobalErrorHandling();

// Initialize modern page lifecycle management
const lifecycleManager = setupPageLifecycle();

// Cleanup on page hide
window.addEventListener('pagehide', () => {
  lifecycleManager.cleanup();
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SafeNetworkProvider>
      <App />
    </SafeNetworkProvider>
  </React.StrictMode>
);
