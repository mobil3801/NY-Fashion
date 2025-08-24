
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { PurchaseOrderProvider } from './contexts/PurchaseOrderContext';
import { EmployeeProvider } from '@/contexts/EmployeeContext';
import SecurityProvider from '@/components/security/SecurityProvider';

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
import DeploymentPage from '@/pages/DeploymentPage';
import MonitoringPage from '@/pages/MonitoringPage';
import SecurityPage from '@/pages/SecurityPage';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <NetworkErrorBoundary>
            <AuthProvider>
              <InventoryProvider>
                <PurchaseOrderProvider>
                  <EmployeeProvider>
                    <SecurityProvider>
                    <Router>
                      <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        
                        {/* Protected Routes */}
                        <Route
                            path="/*"
                            element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                            }>
                          <Route index element={<Navigate to="/dashboard" replace />} />
                          <Route
                              path="dashboard"
                              element={
                              <ProtectedRoute resource="dashboard">
                                <DashboardPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="sales"
                              element={
                              <ProtectedRoute resource="sales">
                                <SalesPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="invoices"
                              element={
                              <ProtectedRoute resource="invoices">
                                <InvoicesPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="purchases"
                              element={
                              <ProtectedRoute resource="purchases">
                                <PurchasePage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="inventory"
                              element={
                              <ProtectedRoute resource="inventory">
                                <InventoryPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="employees"
                              element={
                              <ProtectedRoute resource="employees">
                                <EmployeesPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="salary"
                              element={
                              <ProtectedRoute resource="salary">
                                <SalaryPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="admin"
                              element={
                              <ProtectedRoute resource="admin">
                                <AdminPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="settings"
                              element={
                              <ProtectedRoute resource="settings">
                                <SettingsPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="pos"
                              element={
                              <ProtectedRoute resource="pos">
                                <POSPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="monitoring"
                              element={
                              <ProtectedRoute resource="monitoring">
                                <MonitoringPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="deployment"
                              element={
                              <ProtectedRoute resource="deployment">
                                <DeploymentPage />
                              </ProtectedRoute>
                              } />
                          <Route
                              path="security"
                              element={
                              <ProtectedRoute resource="admin">
                                <SecurityPage />
                              </ProtectedRoute>
                              } />
                        </Route>

                        {/* Fallback Route */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Router>
                    </SecurityProvider>
                  </EmployeeProvider>
                </PurchaseOrderProvider>
              </InventoryProvider>
            </AuthProvider>
          </NetworkErrorBoundary>
          <Toaster />
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>);

}

export default App;