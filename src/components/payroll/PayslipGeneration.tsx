
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Eye, Edit, Send, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { format } from 'date-fns';

interface Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_name: string;
  pay_period_start: string;
  pay_period_end: string;
  regular_hours: number;
  overtime_hours: number;
  regular_rate: number;
  overtime_rate: number;
  gross_pay: number;
  commission: number;
  gross_total: number;
  federal_tax: number;
  state_tax: number;
  social_security: number;
  medicare: number;
  health_insurance: number;
  retirement_contribution: number;
  total_deductions: number;
  net_pay: number;
  status: 'draft' | 'generated' | 'sent' | 'viewed';
  generated_at: string;
}

const PayslipGeneration: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');

  const isAdmin = hasPermission(user, 'admin');
  const isManager = hasPermission(user, 'manager');
  const isEmployee = hasPermission(user, 'employee');

  useEffect(() => {
    loadPayslips();
  }, [filterStatus, filterEmployee]);

  const loadPayslips = async () => {
    try {
      setLoading(true);

      const filters = [];

      // Employee role filter - only see own payslips
      if (isEmployee && !isManager && !isAdmin) {
        filters.push({ name: 'employee_id', op: 'Equal', value: user?.employee_id || 0 });
      }

      if (filterStatus !== 'all') {
        filters.push({ name: 'status', op: 'Equal', value: filterStatus });
      }

      if (filterEmployee !== 'all' && (isManager || isAdmin)) {
        filters.push({ name: 'employee_id', op: 'Equal', value: parseInt(filterEmployee) });
      }

      const { data, error } = await window.ezsite.apis.tablePage(36863, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'generated_at',
        IsAsc: false,
        Filters: filters
      });

      if (error) throw error;
      setPayslips(data?.List || []);
    } catch (error) {
      console.error('Failed to load payslips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payslips',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const previewPayslip = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setShowPreviewDialog(true);

    // Mark as viewed if employee is viewing their own payslip
    if (isEmployee && payslip.status === 'generated') {
      updatePayslipStatus(payslip.id, 'viewed');
    }
  };

  const updatePayslipStatus = async (payslipId: number, status: string) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(36863, {
        id: payslipId,
        status
      });

      if (error) throw error;
      loadPayslips();
    } catch (error) {
      console.error('Failed to update payslip status:', error);
    }
  };

  const downloadPayslip = async (payslip: Payslip) => {
    try {
      // Generate PDF payslip (simplified version)
      const { data, error } = await window.ezsite.apis.run({
        path: 'generatePayslipPDF',
        param: [payslip.id]
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslip.employee_name.replace(/\s+/g, '-')}-${format(new Date(payslip.pay_period_end), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Payslip downloaded successfully'
      });
    } catch (error) {
      console.error('Failed to download payslip:', error);
      toast({
        title: 'Error',
        description: 'Failed to download payslip',
        variant: 'destructive'
      });
    }
  };

  const sendPayslip = async (payslipId: number) => {
    try {
      const { error } = await window.ezsite.apis.run({
        path: 'sendPayslipEmail',
        param: [payslipId]
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payslip sent successfully'
      });

      await updatePayslipStatus(payslipId, 'sent');
    } catch (error) {
      console.error('Failed to send payslip:', error);
      toast({
        title: 'Error',
        description: 'Failed to send payslip',
        variant: 'destructive'
      });
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payslips</h2>
          <p className="text-gray-600">View and manage employee payslips</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 rounded-2xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="generated">Generated</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
          </SelectContent>
        </Select>

        {(isManager || isAdmin) &&
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-48 rounded-2xl">
              <SelectValue placeholder="Filter by employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {/* Add employee options here */}
            </SelectContent>
          </Select>
        }
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>Generated payslips for employees</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ?
          <div className="text-center py-8">Loading payslips...</div> :
          payslips.length === 0 ?
          <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payslips found</h3>
              <p className="text-gray-600">Process payroll runs to generate payslips</p>
            </div> :

          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) =>
              <TableRow key={payslip.id}>
                    <TableCell className="font-medium">
                      {payslip.employee_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(payslip.pay_period_start), 'MMM dd, yyyy')}</div>
                        <div className="text-gray-500">
                          to {format(new Date(payslip.pay_period_end), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(payslip.status)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payslip.gross_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payslip.net_pay)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => previewPayslip(payslip)}>

                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => downloadPayslip(payslip)}>

                          <Download className="w-4 h-4" />
                        </Button>

                        {(isManager || isAdmin) && payslip.status === 'generated' &&
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => sendPayslip(payslip.id)}>

                            <Send className="w-4 h-4" />
                          </Button>
                    }
                      </div>
                    </TableCell>
                  </TableRow>
              )}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {/* Payslip Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl rounded-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip Preview</DialogTitle>
            <DialogDescription>
              {selectedPayslip && `${selectedPayslip.employee_name} - ${format(new Date(selectedPayslip.pay_period_end), 'MMM yyyy')}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayslip &&
          <div className="space-y-6 py-4">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold">Company Name</h2>
                <p className="text-gray-600">Employee Payslip</p>
              </div>

              {/* Employee and Period Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Employee Information</h3>
                  <p><strong>Name:</strong> {selectedPayslip.employee_name}</p>
                  <p><strong>Employee ID:</strong> {selectedPayslip.employee_id}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Pay Period</h3>
                  <p><strong>Start:</strong> {format(new Date(selectedPayslip.pay_period_start), 'MMM dd, yyyy')}</p>
                  <p><strong>End:</strong> {format(new Date(selectedPayslip.pay_period_end), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              <Separator />

              {/* Earnings */}
              <div>
                <h3 className="font-semibold mb-3">Earnings</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Regular Hours ({selectedPayslip.regular_hours} hrs @ {formatCurrency(selectedPayslip.regular_rate)}/hr)</span>
                    <span>{formatCurrency(selectedPayslip.regular_hours * selectedPayslip.regular_rate)}</span>
                  </div>
                  {selectedPayslip.overtime_hours > 0 &&
                <div className="flex justify-between">
                      <span>Overtime Hours ({selectedPayslip.overtime_hours} hrs @ {formatCurrency(selectedPayslip.overtime_rate)}/hr)</span>
                      <span>{formatCurrency(selectedPayslip.overtime_hours * selectedPayslip.overtime_rate)}</span>
                    </div>
                }
                  {selectedPayslip.commission > 0 &&
                <div className="flex justify-between">
                      <span>Commission</span>
                      <span>{formatCurrency(selectedPayslip.commission)}</span>
                    </div>
                }
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Gross Total</span>
                    <span>{formatCurrency(selectedPayslip.gross_total)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Deductions */}
              <div>
                <h3 className="font-semibold mb-3">Deductions</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Federal Tax</span>
                    <span>-{formatCurrency(selectedPayslip.federal_tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State Tax</span>
                    <span>-{formatCurrency(selectedPayslip.state_tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Social Security</span>
                    <span>-{formatCurrency(selectedPayslip.social_security)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medicare</span>
                    <span>-{formatCurrency(selectedPayslip.medicare)}</span>
                  </div>
                  {selectedPayslip.health_insurance > 0 &&
                <div className="flex justify-between">
                      <span>Health Insurance</span>
                      <span>-{formatCurrency(selectedPayslip.health_insurance)}</span>
                    </div>
                }
                  {selectedPayslip.retirement_contribution > 0 &&
                <div className="flex justify-between">
                      <span>401(k) Contribution</span>
                      <span>-{formatCurrency(selectedPayslip.retirement_contribution)}</span>
                    </div>
                }
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total Deductions</span>
                    <span>-{formatCurrency(selectedPayslip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Net Pay */}
              <div className="bg-emerald-50 p-4 rounded-2xl">
                <div className="flex justify-between items-center text-xl font-bold text-emerald-800">
                  <span>Net Pay</span>
                  <span>{formatCurrency(selectedPayslip.net_pay)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => downloadPayslip(selectedPayslip)}>

                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setShowPreviewDialog(false)}>

                  Close
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

};

export default PayslipGeneration;