
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, CalendarDays, Plus, Play, Pause, Check, X, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

interface PayrollRun {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'processing' | 'completed' | 'cancelled';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  created_at: string;
  created_by: string;
}

const PayrollRunManagement: React.FC = () => {
  const { toast } = useToast();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [newPayrollRun, setNewPayrollRun] = useState({
    name: '',
    start_date: format(addDays(new Date(), -14), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    pay_period_type: 'biweekly'
  });

  useEffect(() => {
    loadPayrollRuns();
  }, [selectedStatus]);

  const loadPayrollRuns = async () => {
    try {
      setLoading(true);
      const filters = selectedStatus !== 'all' ? [
        { name: 'status', op: 'Equal', value: selectedStatus }
      ] : [];

      const { data, error } = await window.ezsite.apis.tablePage(36862, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'created_at',
        IsAsc: false,
        Filters: filters
      });

      if (error) throw error;
      setPayrollRuns(data?.List || []);
    } catch (error) {
      console.error('Failed to load payroll runs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payroll runs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createPayrollRun = async () => {
    try {
      if (!newPayrollRun.name || !newPayrollRun.start_date || !newPayrollRun.end_date) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive'
        });
        return;
      }

      setLoading(true);
      const { error } = await window.ezsite.apis.tableCreate(36862, {
        ...newPayrollRun,
        status: 'draft',
        total_gross: 0,
        total_deductions: 0,
        total_net: 0,
        employee_count: 0
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payroll run created successfully'
      });

      setShowCreateDialog(false);
      setNewPayrollRun({
        name: '',
        start_date: format(addDays(new Date(), -14), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
        pay_period_type: 'biweekly'
      });
      loadPayrollRuns();
    } catch (error) {
      console.error('Failed to create payroll run:', error);
      toast({
        title: 'Error',
        description: 'Failed to create payroll run',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const processPayrollRun = async (runId: number) => {
    try {
      setLoading(true);
      // Calculate payroll for all employees in the date range
      const { error } = await window.ezsite.apis.run({
        path: 'processPayrollRun',
        param: [runId]
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payroll run processed successfully'
      });
      loadPayrollRuns();
    } catch (error) {
      console.error('Failed to process payroll run:', error);
      toast({
        title: 'Error',
        description: 'Failed to process payroll run',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
      completed: { color: 'bg-emerald-100 text-emerald-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={`${config.color} rounded-xl`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll Runs</h2>
          <p className="text-gray-600">Manage and process payroll runs</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              New Payroll Run
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Create New Payroll Run</DialogTitle>
              <DialogDescription>
                Set up a new payroll run for a specific date range
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Payroll Run Name</Label>
                <Input
                  id="name"
                  className="rounded-2xl"
                  placeholder="e.g., December 2024 - Bi-weekly"
                  value={newPayrollRun.name}
                  onChange={(e) => setNewPayrollRun({...newPayrollRun, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    className="rounded-2xl"
                    value={newPayrollRun.start_date}
                    onChange={(e) => setNewPayrollRun({...newPayrollRun, start_date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    className="rounded-2xl"
                    value={newPayrollRun.end_date}
                    onChange={(e) => setNewPayrollRun({...newPayrollRun, end_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay_period_type">Pay Period Type</Label>
                <Select value={newPayrollRun.pay_period_type} onValueChange={(value) => 
                  setNewPayrollRun({...newPayrollRun, pay_period_type: value})}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                className="rounded-2xl"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                onClick={createPayrollRun}
                disabled={loading}
              >
                Create Payroll Run
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48 rounded-2xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
          <CardDescription>Manage payroll processing for different pay periods</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payroll runs...</div>
          ) : payrollRuns.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No payroll runs found</h3>
              <p className="text-gray-600 mb-4">Create your first payroll run to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Total Net</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(run.start_date), 'MMM dd, yyyy')}</div>
                        <div className="text-gray-500">to {format(new Date(run.end_date), 'MMM dd, yyyy')}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="text-right">{run.employee_count}</TableCell>
                    <TableCell className="text-right">
                      ${run.total_net?.toLocaleString() || '0.00'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {run.status === 'draft' && (
                          <Button
                            size="sm"
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => processPayrollRun(run.id)}
                            disabled={loading}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PayrollRunManagement;
