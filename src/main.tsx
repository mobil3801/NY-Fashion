import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Production-ready providers
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProductionProvider } from '@/contexts/ProductionContext';

// Import the simplified production App component
import ProductionApp from './ProductionApp';

// Environment detection
const isProductionEnv = () => {
  return import.meta.env.PROD || import.meta.env.MODE === 'production' ||
  process.env.NODE_ENV === 'production';
};

// Create QueryClient with production-optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true
    },
    mutations: {
      retry: 2
    }
  }
});

// Start the application immediately
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProductionProvider>
          <ProductionApp />
        </ProductionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);