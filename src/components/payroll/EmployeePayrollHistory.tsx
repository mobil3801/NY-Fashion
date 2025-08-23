
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Download, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface PayrollHistoryEntry {
  id: number;
  payroll_run_id: number;
  payroll_run_name: string;
  employee_id: number;
  employee_name: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_total: number;
  total_deductions: number;
  net_pay: number;
  regular_hours: number;
  overtime_hours: number;
  commission: number;
  status: string;
  generated_at: string;
}

interface PayrollSummary {
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  averageHours: number;
  totalCommission: number;
  payslipCount: number;
}

const EmployeePayrollHistory: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistoryEntry[]>([]);
  const [summary, setSummary] = useState<PayrollSummary>({
    totalEarnings: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    averageHours: 0,
    totalCommission: 0,
    payslipCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('current');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last-6-months');
  const [employees, setEmployees] = useState<any[]>([]);

  const isAdmin = hasPermission(user, 'admin');
  const isManager = hasPermission(user, 'manager');
  const isEmployee = hasPermission(user, 'employee');

  useEffect(() => {
    if (isAdmin || isManager) {
      loadEmployees();
    }
    loadPayrollHistory();
  }, [selectedEmployee, selectedPeriod]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(36859, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'first_name',
        IsAsc: true,
        Filters: [{ name: 'status', op: 'Equal', value: 'active' }]
      });

      if (error) throw error;
      setEmployees(data?.List || []);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadPayrollHistory = async () => {
    try {
      setLoading(true);

      const filters = [];

      // Employee role filter - only see own payroll history
      if (isEmployee && !isManager && !isAdmin) {
        filters.push({ name: 'employee_id', op: 'Equal', value: user?.employee_id || 0 });
      } else if (selectedEmployee !== 'all' && selectedEmployee !== 'current') {
        filters.push({ name: 'employee_id', op: 'Equal', value: parseInt(selectedEmployee) });
      } else if (selectedEmployee === 'current' && user?.employee_id) {
        filters.push({ name: 'employee_id', op: 'Equal', value: user.employee_id });
      }

      // Date range filter
      const dateRange = getDateRange(selectedPeriod);
      if (dateRange.start) {
        filters.push({ name: 'pay_period_end', op: 'GreaterThanOrEqual', value: dateRange.start });
      }
      if (dateRange.end) {
        filters.push({ name: 'pay_period_end', op: 'LessThanOrEqual', value: dateRange.end });
      }

      const { data, error } = await window.ezsite.apis.tablePage(36863, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'pay_period_end',
        IsAsc: false,
        Filters: filters
      });

      if (error) throw error;

      const history = data?.List || [];
      setPayrollHistory(history);

      // Calculate summary
      calculateSummary(history);

    } catch (error) {
      console.error('Failed to load payroll history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payroll history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'last-month':
        return {
          start: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
          end: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
        };
      case 'last-3-months':
        return {
          start: format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      case 'last-6-months':
        return {
          start: format(startOfMonth(subMonths(now, 6)), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      case 'last-year':
        return {
          start: format(startOfMonth(subMonths(now, 12)), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      default:
        return { start: null, end: null };
    }
  };

  const calculateSummary = (history: PayrollHistoryEntry[]) => {
    if (history.length === 0) {
      setSummary({
        totalEarnings: 0,
        totalDeductions: 0,
        totalNetPay: 0,
        averageHours: 0,
        totalCommission: 0,
        payslipCount: 0
      });
      return;
    }

    const totalEarnings = history.reduce((sum, entry) => sum + (entry.gross_total || 0), 0);
    const totalDeductions = history.reduce((sum, entry) => sum + (entry.total_deductions || 0), 0);
    const totalNetPay = history.reduce((sum, entry) => sum + (entry.net_pay || 0), 0);
    const totalHours = history.reduce((sum, entry) => sum + (entry.regular_hours || 0) + (entry.overtime_hours || 0), 0);
    const totalCommission = history.reduce((sum, entry) => sum + (entry.commission || 0), 0);
    const averageHours = totalHours / history.length;

    setSummary({
      totalEarnings,
      totalDeductions,
      totalNetPay,
      averageHours,
      totalCommission,
      payslipCount: history.length
    });
  };

  const downloadHistoryCSV = () => {
    const headers = [
    'Pay Period Start',
    'Pay Period End',
    'Regular Hours',
    'Overtime Hours',
    'Gross Pay',
    'Commission',
    'Total Deductions',
    'Net Pay',
    'Status'];


    const csvContent = [
    headers.join(','),
    ...payrollHistory.map((entry) => [
    format(new Date(entry.pay_period_start), 'yyyy-MM-dd'),
    format(new Date(entry.pay_period_end), 'yyyy-MM-dd'),
    entry.regular_hours?.toString() || '0',
    entry.overtime_hours?.toString() || '0',
    entry.gross_total?.toString() || '0',
    entry.commission?.toString() || '0',
    entry.total_deductions?.toString() || '0',
    entry.net_pay?.toString() || '0',
    entry.status].
    join(','))].
    join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-history-${selectedEmployee}-${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Payroll history exported successfully'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      generated: { color: 'bg-blue-100 text-blue-800', label: 'Generated' },
      sent: { color: 'bg-emerald-100 text-emerald-800', label: 'Sent' },
      viewed: { color: 'bg-purple-100 text-purple-800', label: 'Viewed' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <Badge className={`${config.color} rounded-xl`}>
        {config.label}
      </Badge>);

  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll History</h2>
          <p className="text-gray-600">View historical payroll data</p>
        </div>
        
        {payrollHistory.length > 0 &&
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={downloadHistoryCSV}>

            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        }
      </div>

      <div className="flex gap-4">
        {(isAdmin || isManager) &&
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-64 rounded-2xl">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              <SelectItem value="current">Current User</SelectItem>
              {employees.map((emp) =>
            <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
            )}
            </SelectContent>
          </Select>
        }

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48 rounded-2xl">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            <SelectItem value="last-6-months">Last 6 Months</SelectItem>
            <SelectItem value="last-year">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalEarnings)}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalDeductions)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Pay</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalNetPay)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Hours/Period</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.averageHours.toFixed(1)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Minus className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll History Table */}
      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>
            {payrollHistory.length > 0 ?
            `Showing ${payrollHistory.length} payroll entries` :
            'No payroll history found for selected criteria'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ?
          <div className="text-center py-8">Loading payroll history...</div> :
          payrollHistory.length === 0 ?
          <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll history found</h3>
              <p className="text-gray-600">Try selecting a different time period or employee</p>
            </div> :

          <Table>
              <TableHeader>
                <TableRow>
                  {(isAdmin || isManager) && selectedEmployee === 'all' &&
                <TableHead>Employee</TableHead>
                }
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollHistory.map((entry) =>
              <TableRow key={entry.id}>
                    {(isAdmin || isManager) && selectedEmployee === 'all' &&
                <TableCell className="font-medium">
                        {entry.employee_name}
                      </TableCell>
                }
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(entry.pay_period_start), 'MMM dd')}</div>
                        <div className="text-gray-500">
                          to {format(new Date(entry.pay_period_end), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Reg: {entry.regular_hours || 0}h</div>
                        {entry.overtime_hours > 0 &&
                    <div className="text-amber-600">OT: {entry.overtime_hours}h</div>
                    }
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        <div>{formatCurrency(entry.gross_total)}</div>
                        {entry.commission > 0 &&
                    <div className="text-green-600 text-xs">
                            +{formatCurrency(entry.commission)} comm
                          </div>
                    }
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.total_deductions)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.net_pay)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.status)}
                    </TableCell>
                    <TableCell>
                      <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl">

                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
              )}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>
    </div>);

};

export default EmployeePayrollHistory;