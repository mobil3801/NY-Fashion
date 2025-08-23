
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployee } from '@/contexts/EmployeeContext';
import { hasPermission } from '@/utils/permissions';
import {
  Wallet,
  Calculator,
  Users,
  FileText,
  Settings,
  Download,
  Clock,
  DollarSign } from
'lucide-react';

// Import payroll components
import PayrollRunManagement from '@/components/payroll/PayrollRunManagement';
import PayStructureManagement from '@/components/payroll/PayStructureManagement';
import PayslipGeneration from '@/components/payroll/PayslipGeneration';
import PayrollReports from '@/components/payroll/PayrollReports';
import EmployeePayrollHistory from '@/components/payroll/EmployeePayrollHistory';

const SalaryPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { initializeEmployeeSystem, loadEmployees } = useEmployee();
  const [activeTab, setActiveTab] = useState('overview');

  const isAdmin = hasPermission(user, 'admin');
  const isManager = hasPermission(user, 'manager');
  const isEmployee = hasPermission(user, 'employee');

  useEffect(() => {
    initializeEmployeeSystem();
    loadEmployees();
  }, [initializeEmployeeSystem, loadEmployees]);

  // Set default tab based on role
  useEffect(() => {
    if (isEmployee && !isManager && !isAdmin) {
      setActiveTab('history');
    }
  }, [isEmployee, isManager, isAdmin]);

  const canProcessPayroll = isAdmin || isManager;
  const canManagePayStructures = isAdmin;
  const canViewReports = isAdmin || isManager;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('salary')}</h1>
          <p className="text-gray-600 mt-2">Comprehensive payroll management system</p>
        </div>
        {canProcessPayroll &&
        <Button
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setActiveTab('payroll-runs')}>

            <Calculator className="w-4 h-4 mr-2" />
            Process Payroll
          </Button>
        }
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-6 rounded-2xl bg-gray-100">
          <TabsTrigger value="overview" className="rounded-xl">
            <Wallet className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          
          {canProcessPayroll &&
          <TabsTrigger value="payroll-runs" className="rounded-xl">
              <Calculator className="w-4 h-4 mr-2" />
              Payroll Runs
            </TabsTrigger>
          }

          {canManagePayStructures &&
          <TabsTrigger value="pay-structures" className="rounded-xl">
              <DollarSign className="w-4 h-4 mr-2" />
              Pay Structures
            </TabsTrigger>
          }

          <TabsTrigger value="payslips" className="rounded-xl">
            <FileText className="w-4 h-4 mr-2" />
            Payslips
          </TabsTrigger>

          <TabsTrigger value="history" className="rounded-xl">
            <Clock className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>

          {canViewReports &&
          <TabsTrigger value="reports" className="rounded-xl">
              <Download className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
          }
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PayrollOverview />
        </TabsContent>

        {canProcessPayroll &&
        <TabsContent value="payroll-runs" className="space-y-6">
            <PayrollRunManagement />
          </TabsContent>
        }

        {canManagePayStructures &&
        <TabsContent value="pay-structures" className="space-y-6">
            <PayStructureManagement />
          </TabsContent>
        }

        <TabsContent value="payslips" className="space-y-6">
          <PayslipGeneration />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <EmployeePayrollHistory />
        </TabsContent>

        {canViewReports &&
        <TabsContent value="reports" className="space-y-6">
            <PayrollReports />
          </TabsContent>
        }
      </Tabs>
    </div>);

};

// Overview component showing payroll summary
const PayrollOverview: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activePayrollRuns: 0,
    pendingPayslips: 0,
    monthlyPayroll: 0
  });

  const isAdmin = hasPermission(user, 'admin');
  const isManager = hasPermission(user, 'manager');

  useEffect(() => {
    loadPayrollStats();
  }, []);

  const loadPayrollStats = async () => {
    try {
      // Load payroll statistics
      const [employeesRes, payrollRunsRes, payslipsRes] = await Promise.all([
      window.ezsite.apis.tablePage(36859, { PageSize: 1 }), // employees
      window.ezsite.apis.tablePage(36862, {
        PageSize: 1,
        Filters: [{ name: 'status', op: 'Equal', value: 'processing' }]
      }), // active payroll runs
      window.ezsite.apis.tablePage(36863, {
        PageSize: 1,
        Filters: [{ name: 'status', op: 'Equal', value: 'draft' }]
      }) // pending payslips
      ]);

      setStats({
        totalEmployees: employeesRes.data?.VirtualCount || 0,
        activePayrollRuns: payrollRunsRes.data?.VirtualCount || 0,
        pendingPayslips: payslipsRes.data?.VirtualCount || 0,
        monthlyPayroll: 0 // Calculate from recent payroll runs
      });
    } catch (error) {
      console.error('Failed to load payroll stats:', error);
    }
  };

  const statCards = [
  {
    title: 'Total Employees',
    value: stats.totalEmployees,
    icon: Users,
    color: 'blue',
    show: isAdmin || isManager
  },
  {
    title: 'Active Payroll Runs',
    value: stats.activePayrollRuns,
    icon: Calculator,
    color: 'emerald',
    show: isAdmin || isManager
  },
  {
    title: 'Pending Payslips',
    value: stats.pendingPayslips,
    icon: FileText,
    color: 'amber',
    show: isAdmin || isManager
  },
  {
    title: 'Monthly Payroll',
    value: `$${stats.monthlyPayroll.toLocaleString()}`,
    icon: DollarSign,
    color: 'purple',
    show: isAdmin
  }].
  filter((card) => card.show);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="rounded-3xl border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 bg-${stat.color}-100 rounded-2xl flex items-center justify-center`}>
                    <IconComponent className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                </div>
              </CardContent>
            </Card>);

        })}
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common payroll tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(isAdmin || isManager) &&
          <>
              <Button
              variant="outline"
              className="h-20 rounded-2xl flex flex-col items-center justify-center space-y-2">

                <Calculator className="w-6 h-6 text-emerald-600" />
                <span>Start New Payroll</span>
              </Button>
              
              <Button
              variant="outline"
              className="h-20 rounded-2xl flex flex-col items-center justify-center space-y-2">

                <FileText className="w-6 h-6 text-blue-600" />
                <span>Generate Payslips</span>
              </Button>
            </>
          }

          <Button
            variant="outline"
            className="h-20 rounded-2xl flex flex-col items-center justify-center space-y-2">

            <Download className="w-6 h-6 text-purple-600" />
            <span>Download Reports</span>
          </Button>

          {isAdmin &&
          <Button
            variant="outline"
            className="h-20 rounded-2xl flex flex-col items-center justify-center space-y-2">

              <Settings className="w-6 h-6 text-gray-600" />
              <span>Payroll Settings</span>
            </Button>
          }
        </CardContent>
      </Card>
    </div>);

};

export default SalaryPage;