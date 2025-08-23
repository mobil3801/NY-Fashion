import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/common/LoadingState';
import ErrorBoundary from '@/components/common/GlobalErrorBoundary';

// Import the main layout component
import MainLayout from '@/components/layout/MainLayout';

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

function ProductionApp() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<LoadingState />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              } />
              <Route path="/register" element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              } />

              {/* Protected Routes with Main Layout */}
              <Route element={<MainLayout />}>  
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/sales" element={
                  <ProtectedRoute>
                    <SalesPage />
                  </ProtectedRoute>
                } />
                <Route path="/invoices" element={
                  <ProtectedRoute>
                    <InvoicesPage />
                  </ProtectedRoute>
                } />
                <Route path="/inventory" element={
                  <ProtectedRoute>
                    <InventoryPage />
                  </ProtectedRoute>
                } />
                <Route path="/employees" element={
                  <ProtectedRoute>
                    <EmployeesPage />
                  </ProtectedRoute>
                } />
                <Route path="/payroll" element={
                  <ProtectedRoute>
                    <SalaryPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } />
                <Route path="/pos" element={
                  <ProtectedRoute>
                    <POSPage />
                  </ProtectedRoute>
                } />
                <Route path="/purchase" element={
                  <ProtectedRoute>
                    <PurchasePage />
                  </ProtectedRoute>
                } />
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>

          {/* Global UI Components */}
          <Toaster />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default ProductionApp;