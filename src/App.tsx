import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { PurchaseOrderProvider } from './contexts/PurchaseOrderContext';
import { EmployeeProvider } from '@/contexts/EmployeeContext';
import { POSProvider } from '@/contexts/POSContext';
import { ProductionProvider } from '@/contexts/ProductionContext';
import { DebugProvider } from '@/debug';

import { PRODUCTION_CONFIG } from '@/config/production';
import ProductionErrorBoundary from '@/components/common/EnhancedErrorBoundary';
import NetworkErrorBoundary from '@/components/network/NetworkErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

// Main Pages
import DashboardPage from '@/pages/DashboardPage';
import SalesPage from '@/pages/SalesPage';
import InvoicesPage from '@/pages/InvoicesPage';
import PurchasePage from '@/pages/PurchasePage';
import InventoryPage from '@/pages/InventoryPage';
import EmployeesPage from '@/pages/EmployeesPage';
import SalaryPage from '@/pages/SalaryPage';
import AdminPage from '@/pages/AdminPage';
import SettingsPage from '@/pages/SettingsPage';
import POSPage from '@/pages/POSPage';
import NotFound from '@/pages/NotFound';

// Debug Pages (Development only)
import NetworkDebugPage from '@/pages/debug/NetworkDebugPage';
import TestingPage from '@/pages/TestingPage';

// Lazy load Performance Dashboard
const LazyPerformanceDashboard = React.lazy(() =>
import('@/components/monitoring/PerformanceDashboard').then((module) => ({
  default: module.default
}))
);

// Import production initialization
import { logger } from '@/utils/production-logger';
import { enhancedToast } from '@/utils/enhanced-toast';
import { enhancedPerformanceMonitor } from '@/utils/enhanced-performance-monitor';
import { globalCache } from '@/utils/enhanced-cache';
import { memoryManager } from '@/utils/memory-manager';
import { auditLogger } from '@/utils/audit-logger';
import { bundleOptimizer } from '@/utils/bundle-optimizer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < PRODUCTION_CONFIG.api.retryCount;
      },
      retryDelay: PRODUCTION_CONFIG.api.retryDelay,
      staleTime: PRODUCTION_CONFIG.performance.cacheTimeout,
      cacheTime: PRODUCTION_CONFIG.performance.cacheTimeout * 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry mutations on client errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < PRODUCTION_CONFIG.api.retryCount;
      },
      retryDelay: PRODUCTION_CONFIG.api.retryDelay
    }
  }
});

function App() {
  // Initialize production features
  React.useEffect(() => {
    if (PRODUCTION_CONFIG.isProduction) {
      logger.logInfo('Application started in production mode');

      // Initialize error reporting if enabled
      if (PRODUCTION_CONFIG.enableErrorReporting) {
        logger.logInfo('Error reporting enabled');
      }

      // Initialize production monitoring
      bundleOptimizer.preloadCriticalResources();
      bundleOptimizer.initializeServiceWorker();

      // Log application startup
      auditLogger.logSystemEvent('APPLICATION_START', 'APPLICATION', {
        version: '1.0.0',
        environment: 'production'
      });
    } else {
      logger.logInfo('Application started in development mode');
    }

    // Show toast notifications for critical errors
    const handleError = (event: ErrorEvent) => {
      enhancedToast.showErrorToast(
        'Application Error',
        event.error?.message || 'An unexpected error occurred'
      );

      // Log error for audit
      auditLogger.logSecurityEvent('APPLICATION_ERROR', 'APPLICATION', 'HIGH', undefined, {
        error: event.error?.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    window.addEventListener('error', handleError);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('error', handleError);
      if (PRODUCTION_CONFIG.isProduction) {
        auditLogger.logSystemEvent('APPLICATION_STOP', 'APPLICATION');
      }
    };
  }, []);
  return (
    <ProductionErrorBoundary level="global">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <NetworkProvider>
              <NetworkErrorBoundary>
                <ProductionErrorBoundary level="app">
                  <AuthProvider>
                    <InventoryProvider>
                      <PurchaseOrderProvider>
                        <EmployeeProvider>
                          <POSProvider>
                            {import.meta.env.NODE_ENV === 'development' && !import.meta.env.VITE_DISABLE_DEBUG_PROVIDER ?
                            <DebugProvider>
                                <Router>
                                  <Routes>
                                  {/* Public Routes */}
                                  <Route
                                    path="/login"
                                    element={
                                    <ProductionErrorBoundary level="page">
                                        <LoginPage />
                                      </ProductionErrorBoundary>
                                    } />

                                  <Route
                                    path="/register"
                                    element={
                                    <ProductionErrorBoundary level="page">
                                        <RegisterPage />
                                      </ProductionErrorBoundary>
                                    } />

                                  
                                  {/* Protected Routes */}
                                  <Route
                                    path="/*"
                                    element={
                                    <ProtectedRoute>
                                        <ProductionErrorBoundary level="layout">
                                          <MainLayout />
                                        </ProductionErrorBoundary>
                                      </ProtectedRoute>
                                    }>

                                    <Route
                                      index
                                      element={
                                      <ProductionErrorBoundary level="page">
                                          <Navigate to="/dashboard" replace />
                                        </ProductionErrorBoundary>
                                      } />

                                    <Route
                                      path="dashboard"
                                      element={
                                      <ProtectedRoute resource="dashboard">
                                          <ProductionErrorBoundary level="page">
                                            <DashboardPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="sales"
                                      element={
                                      <ProtectedRoute resource="sales">
                                          <ProductionErrorBoundary level="page">
                                            <SalesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="invoices"
                                      element={
                                      <ProtectedRoute resource="invoices">
                                          <ProductionErrorBoundary level="page">
                                            <InvoicesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="purchases"
                                      element={
                                      <ProtectedRoute resource="purchases">
                                          <ProductionErrorBoundary level="page">
                                            <PurchasePage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="inventory"
                                      element={
                                      <ProtectedRoute resource="inventory">
                                          <ProductionErrorBoundary level="page">
                                            <InventoryPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="employees"
                                      element={
                                      <ProtectedRoute resource="employees">
                                          <ProductionErrorBoundary level="page">
                                            <EmployeesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="salary"
                                      element={
                                      <ProtectedRoute resource="salary">
                                          <ProductionErrorBoundary level="page">
                                            <SalaryPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="admin"
                                      element={
                                      <ProtectedRoute resource="admin">
                                          <ProductionErrorBoundary level="page">
                                            <AdminPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="settings"
                                      element={
                                      <ProtectedRoute resource="settings">
                                          <ProductionErrorBoundary level="page">
                                            <SettingsPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />

                                    <Route
                                      path="pos"
                                      element={
                                      <ProtectedRoute resource="pos">
                                          <ProductionErrorBoundary level="page">
                                            <POSPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                      } />


                                    {/* Debug Routes - Development Only */}
                                    {process.env.NODE_ENV === 'development' && !import.meta.env.VITE_DISABLE_DEBUG_ROUTES &&
                                    <>
                                        <Route
                                        path="debug/network"
                                        element={
                                        <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <NetworkDebugPage />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                        } />

                                        <Route
                                        path="performance"
                                        element={
                                        <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <LazyPerformanceDashboard />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                        } />

                                        <Route
                                        path="testing"
                                        element={
                                        <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <TestingPage />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                        } />

                                      </>
                                    }
                                  </Route>

                                  {/* Fallback Route */}
                                  <Route
                                    path="*"
                                    element={
                                    <ProductionErrorBoundary level="page">
                                        <NotFound />
                                      </ProductionErrorBoundary>
                                    } />

                                  </Routes>
                                </Router>
                              </DebugProvider> :

                            <Router>
                                <Routes>
                                  {/* Public Routes */}
                                  <Route
                                  path="/login"
                                  element={
                                  <ProductionErrorBoundary level="page">
                                        <LoginPage />
                                      </ProductionErrorBoundary>
                                  } />

                                  <Route
                                  path="/register"
                                  element={
                                  <ProductionErrorBoundary level="page">
                                        <RegisterPage />
                                      </ProductionErrorBoundary>
                                  } />

                                  
                                  {/* Protected Routes */}
                                  <Route
                                  path="/*"
                                  element={
                                  <ProtectedRoute>
                                        <ProductionErrorBoundary level="layout">
                                          <MainLayout />
                                        </ProductionErrorBoundary>
                                      </ProtectedRoute>
                                  }>

                                    <Route
                                    index
                                    element={
                                    <ProductionErrorBoundary level="page">
                                          <Navigate to="/dashboard" replace />
                                        </ProductionErrorBoundary>
                                    } />

                                    <Route
                                    path="dashboard"
                                    element={
                                    <ProtectedRoute resource="dashboard">
                                          <ProductionErrorBoundary level="page">
                                            <DashboardPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="sales"
                                    element={
                                    <ProtectedRoute resource="sales">
                                          <ProductionErrorBoundary level="page">
                                            <SalesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="invoices"
                                    element={
                                    <ProtectedRoute resource="invoices">
                                          <ProductionErrorBoundary level="page">
                                            <InvoicesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="purchases"
                                    element={
                                    <ProtectedRoute resource="purchases">
                                          <ProductionErrorBoundary level="page">
                                            <PurchasePage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="inventory"
                                    element={
                                    <ProtectedRoute resource="inventory">
                                          <ProductionErrorBoundary level="page">
                                            <InventoryPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="employees"
                                    element={
                                    <ProtectedRoute resource="employees">
                                          <ProductionErrorBoundary level="page">
                                            <EmployeesPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="salary"
                                    element={
                                    <ProtectedRoute resource="salary">
                                          <ProductionErrorBoundary level="page">
                                            <SalaryPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="admin"
                                    element={
                                    <ProtectedRoute resource="admin">
                                          <ProductionErrorBoundary level="page">
                                            <AdminPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="settings"
                                    element={
                                    <ProtectedRoute resource="settings">
                                          <ProductionErrorBoundary level="page">
                                            <SettingsPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />

                                    <Route
                                    path="pos"
                                    element={
                                    <ProtectedRoute resource="pos">
                                          <ProductionErrorBoundary level="page">
                                            <POSPage />
                                          </ProductionErrorBoundary>
                                        </ProtectedRoute>
                                    } />


                                    {/* Debug Routes - Development Only */}
                                    {process.env.NODE_ENV === 'development' && !import.meta.env.VITE_DISABLE_DEBUG_ROUTES &&
                                  <>
                                        <Route
                                      path="debug/network"
                                      element={
                                      <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <NetworkDebugPage />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                      } />

                                        <Route
                                      path="performance"
                                      element={
                                      <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <LazyPerformanceDashboard />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                      } />

                                        <Route
                                      path="testing"
                                      element={
                                      <ProtectedRoute resource="admin">
                                              <ProductionErrorBoundary level="page">
                                                <TestingPage />
                                              </ProductionErrorBoundary>
                                            </ProtectedRoute>
                                      } />

                                      </>
                                  }
                                  </Route>

                                  {/* Fallback Route */}
                                  <Route
                                  path="*"
                                  element={
                                  <ProductionErrorBoundary level="page">
                                        <NotFound />
                                      </ProductionErrorBoundary>
                                  } />

                                  </Routes>
                                </Router>

                            }
                          </POSProvider>
                        </EmployeeProvider>
                      </PurchaseOrderProvider>
                    </InventoryProvider>
                  </AuthProvider>
                </ProductionErrorBoundary>
              </NetworkErrorBoundary>
            </NetworkProvider>
          </LanguageProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ProductionErrorBoundary>);

}

export default App;