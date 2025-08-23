
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ProductionErrorBoundary } from '@/components/common/ProductionErrorBoundary';
import { MainLayout } from '@/components/layout/MainLayout';
import { isProduction } from '@/utils/env-validator';
import { LoadingState } from '@/components/common/LoadingState';

// Core pages (always included)
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import POSPage from '@/pages/POSPage';
import InventoryPage from '@/pages/InventoryPage';
import SalesPage from '@/pages/SalesPage';
import InvoicesPage from '@/pages/InvoicesPage';
import PurchasePage from '@/pages/PurchasePage';
import EmployeesPage from '@/pages/EmployeesPage';
import SalaryPage from '@/pages/SalaryPage';
import AdminPage from '@/pages/AdminPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFound from '@/pages/NotFound';

// Lazy load debug components only in development
const NetworkDebugPage = React.lazy(() => 
  isProduction() 
    ? Promise.resolve({ default: () => <div>Debug not available in production</div> })
    : import('@/pages/debug/NetworkDebugPage')
);

const TestingPage = React.lazy(() =>
  isProduction()
    ? Promise.resolve({ default: () => <div>Testing not available in production</div> })
    : import('@/pages/TestingPage')
);

interface ProductionAppProps {
  children?: React.ReactNode;
}

const ProductionApp: React.FC<ProductionAppProps> = () => {
  return (
    <ProductionErrorBoundary>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/resetpassword" element={<LoginPage />} />
          <Route path="/onauthsuccess" element={<div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-green-600">Registration Successful!</h2>
              <p className="text-gray-600 mt-2">Redirecting to login page...</p>
            </div>
          </div>} />

          {/* Protected routes with MainLayout */}
          <Route path="/dashboard" element={<MainLayout><DashboardPage /></MainLayout>} />
          <Route path="/pos" element={<MainLayout><POSPage /></MainLayout>} />
          <Route path="/inventory" element={<MainLayout><InventoryPage /></MainLayout>} />
          <Route path="/sales" element={<MainLayout><SalesPage /></MainLayout>} />
          <Route path="/invoices" element={<MainLayout><InvoicesPage /></MainLayout>} />
          <Route path="/purchase" element={<MainLayout><PurchasePage /></MainLayout>} />
          <Route path="/employees" element={<MainLayout><EmployeesPage /></MainLayout>} />
          <Route path="/salary" element={<MainLayout><SalaryPage /></MainLayout>} />
          <Route path="/admin" element={<MainLayout><AdminPage /></MainLayout>} />
          <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />

          {/* Debug routes - only in development */}
          {!isProduction() && (
            <>
              <Route path="/debug/network" element={
                <MainLayout>
                  <Suspense fallback={<LoadingState />}>
                    <NetworkDebugPage />
                  </Suspense>
                </MainLayout>
              } />
              <Route path="/testing" element={
                <MainLayout>
                  <Suspense fallback={<LoadingState />}>
                    <TestingPage />
                  </Suspense>
                </MainLayout>
              } />
            </>
          )}

          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      
      {/* Global toast notifications */}
      <Toaster />
    </ProductionErrorBoundary>
  );
};

export default ProductionApp;
