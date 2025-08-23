
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ProductionErrorMonitor } from '@/components/error-monitoring/ProductionErrorMonitor';
import ErrorTrackingProvider from '@/components/monitoring/ErrorTrackingService';
import GlobalErrorBoundary from '@/components/common/GlobalErrorBoundary';
import LoadingState from '@/components/common/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { isProduction } from '@/utils/env-validator';
import { logger } from '@/utils/production-logger';

// Import the main layout component
import MainLayout from '@/components/layout/MainLayout';
import EnhancedErrorBoundary from '@/components/common/EnhancedErrorBoundary';

// Lazy load pages for optimal bundle splitting
const HomePage = React.lazy(() => import('@/pages/HomePage'));
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const POSPage = React.lazy(() => import('@/pages/POSPage'));
const InventoryPage = React.lazy(() => import('@/pages/InventoryPage'));
const PurchasePage = React.lazy(() => import('@/pages/PurchasePage'));
const EmployeesPage = React.lazy(() => import('@/pages/EmployeesPage'));
const SalaryPage = React.lazy(() => import('@/pages/SalaryPage'));
const SalesPage = React.lazy(() => import('@/pages/SalesPage'));
const InvoicesPage = React.lazy(() => import('@/pages/InvoicesPage'));
const AdminPage = React.lazy(() => import('@/pages/AdminPage'));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'));
const NotFound = React.lazy(() => import('@/pages/NotFound'));

// Protected Route Component
const ProtectedRoute: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Production Error Fallback Component
const ProductionErrorFallback = React.lazy(() => import('@/components/common/ProductionErrorFallback'));

// Error Fallback Component - Production optimized
const AppErrorFallback: React.FC<{error: Error; errorId: string; retry: () => void;}> = ({
  error,
  errorId,
  retry
}) => {
  if (isProduction()) {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">Loading error handler...</div>
        </div>
      }>
        <ProductionErrorFallback 
          error={error} 
          errorId={errorId} 
          resetError={retry}
        />
      </React.Suspense>
    );
  }

  // Development fallback (lightweight)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Application Error
          </h2>
          <p className="text-gray-600 mb-4">
            The application encountered an unexpected error.
          </p>
          <div className="space-y-2">
            <button
              onClick={retry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              Reload page
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Error ID: {errorId}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  React.useEffect(() => {
    if (!isProduction()) {
      logger.logInfo('App component mounted');
      logger.logComponentLifecycle('App', 'mounted');
    }
  }, []);

  return (
    <EnhancedErrorBoundary 
      componentName="App"
      category="application"
      maxRetries={3}
    >
      <ErrorTrackingProvider>
        <ProductionErrorMonitor fallback={AppErrorFallback}>
          <Router>
            <div className="min-h-screen bg-background">
              <Suspense fallback={<LoadingState />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={
                    <EnhancedErrorBoundary componentName="HomePage">
                      <HomePage />
                    </EnhancedErrorBoundary>
                  } />
                  <Route path="/login" element={
                    <PublicRoute>
                      <EnhancedErrorBoundary componentName="LoginPage">
                        <LoginPage />
                      </EnhancedErrorBoundary>
                    </PublicRoute>
                  } />
                  <Route path="/register" element={
                    <PublicRoute>
                      <EnhancedErrorBoundary componentName="RegisterPage">
                        <RegisterPage />
                      </EnhancedErrorBoundary>
                    </PublicRoute>
                  } />

                  {/* Protected Routes with Main Layout */}
                  <Route element={<MainLayout />}>  
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="DashboardPage">
                          <DashboardPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/sales" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="SalesPage">
                          <SalesPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/invoices" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="InvoicesPage">
                          <InvoicesPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/inventory" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="InventoryPage">
                          <InventoryPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/employees" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="EmployeesPage">
                          <EmployeesPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/payroll" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="SalaryPage">
                          <SalaryPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="AdminPage">
                          <AdminPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="SettingsPage">
                          <SettingsPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/pos" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="POSPage">
                          <POSPage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/purchase" element={
                      <ProtectedRoute>
                        <EnhancedErrorBoundary componentName="PurchasePage">
                          <PurchasePage />
                        </EnhancedErrorBoundary>
                      </ProtectedRoute>
                    } />
                  </Route>

                  {/* 404 Route */}
                  <Route path="*" element={
                    <EnhancedErrorBoundary componentName="NotFound">
                      <NotFound />
                    </EnhancedErrorBoundary>
                  } />
                </Routes>
              </Suspense>

              {/* Global UI Components */}
              <Toaster />
            </div>
          </Router>
        </ProductionErrorMonitor>
      </ErrorTrackingProvider>
    </EnhancedErrorBoundary>
  );
}

export default App;
