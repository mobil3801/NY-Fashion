
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Edit, Save, X, Clock, TrendingUp, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployee } from '@/contexts/EmployeeContext';

interface PayStructure {
  employee_id: number;
  employee_name: string;
  pay_type: 'hourly' | 'salary' | 'commission';
  hourly_rate?: number;
  annual_salary?: number;
  commission_rate?: number;
  overtime_eligible: boolean;
  health_insurance_deduction?: number;
  retirement_contribution?: number;
  status: 'active' | 'pending_approval' | 'inactive';
}

const PayStructureManagement: React.FC = () => {
  const { toast } = useToast();
  const { employees, loadEmployees } = useEmployee();
  const [payStructures, setPayStructures] = useState<PayStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  
  const [editForm, setEditForm] = useState<Partial<PayStructure>>({});

  useEffect(() => {
    loadEmployees();
    loadPayStructures();
  }, [loadEmployees]);

  const loadPayStructures = async () => {
    try {
      setLoading(true);
      const { data, error } = await window.ezsite.apis.tablePage(36859, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'first_name',
        IsAsc: true
      });

      if (error) throw error;

      // Transform employee data to pay structure format
      const structures = (data?.List || []).map((emp: any) => ({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        pay_type: emp.pay_type || 'hourly',
        hourly_rate: parseFloat(emp.hourly_rate || '0'),
        annual_salary: parseFloat(emp.annual_salary || '0'),
        commission_rate: parseFloat(emp.commission_rate || '0'),
        overtime_eligible: emp.overtime_eligible === true || emp.overtime_eligible === 'true',
        health_insurance_deduction: parseFloat(emp.health_insurance_deduction || '0'),
        retirement_contribution: parseFloat(emp.retirement_contribution || '0'),
        status: emp.pay_structure_status || 'active'
      }));

      setPayStructures(structures);
    } catch (error) {
      console.error('Failed to load pay structures:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pay structures',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (employeeId: number) => {
    const structure = payStructures.find(s => s.employee_id === employeeId);
    if (structure) {
      setEditForm({ ...structure });
      setEditingEmployee(employeeId);
    }
  };

  const savePayStructure = async () => {
    try {
      if (!editingEmployee || !editForm) return;

      setLoading(true);
      const { error } = await window.ezsite.apis.tableUpdate(36859, {
        id: editingEmployee,
        pay_type: editForm.pay_type,
        hourly_rate: editForm.hourly_rate?.toString(),
        annual_salary: editForm.annual_salary?.toString(),
        commission_rate: editForm.commission_rate?.toString(),
        overtime_eligible: editForm.overtime_eligible,
        health_insurance_deduction: editForm.health_insurance_deduction?.toString(),
        retirement_contribution: editForm.retirement_contribution?.toString(),
        pay_structure_status: editForm.status || 'active'
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Pay structure updated successfully'
      });

      setEditingEmployee(null);
      setEditForm({});
      loadPayStructures();
    } catch (error) {
      console.error('Failed to save pay structure:', error);
      toast({
        title: 'Error',
        description: 'Failed to save pay structure',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelEditing = () => {
    setEditingEmployee(null);
    setEditForm({});
  };

  const getPayTypeBadge = (payType: string) => {
    const config = {
      hourly: { color: 'bg-blue-100 text-blue-800', label: 'Hourly', icon: Clock },
      salary: { color: 'bg-emerald-100 text-emerald-800', label: 'Salary', icon: DollarSign },
      commission: { color: 'bg-purple-100 text-purple-800', label: 'Commission', icon: TrendingUp }
    };

    const typeConfig = config[payType as keyof typeof config] || config.hourly;
    const IconComponent = typeConfig.icon;

    return (
      <Badge className={`${typeConfig.color} rounded-xl flex items-center gap-1`}>
        <IconComponent className="w-3 h-3" />
        {typeConfig.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | undefined) => {
    return amount ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pay Structures</h2>
          <p className="text-gray-600">Manage employee compensation and benefits</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hourly Employees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {payStructures.filter(s => s.pay_type === 'hourly').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Salary Employees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {payStructures.filter(s => s.pay_type === 'salary').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Commission-based</p>
                <p className="text-2xl font-bold text-gray-900">
                  {payStructures.filter(s => s.pay_type === 'commission').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Employee Pay Structures</CardTitle>
          <CardDescription>Configure compensation for each employee</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading pay structures...</div>
          ) : payStructures.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
              <p className="text-gray-600">Add employees to configure their pay structures</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Type</TableHead>
                  <TableHead>Rate/Salary</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payStructures.map((structure) => (
                  <TableRow key={structure.employee_id}>
                    <TableCell className="font-medium">
                      {structure.employee_name}
                    </TableCell>
                    
                    <TableCell>
                      {editingEmployee === structure.employee_id ? (
                        <Select 
                          value={editForm.pay_type} 
                          onValueChange={(value) => setEditForm({...editForm, pay_type: value as any})}
                        >
                          <SelectTrigger className="w-32 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="commission">Commission</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getPayTypeBadge(structure.pay_type)
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === structure.employee_id ? (
                        <div className="space-y-2">
                          {editForm.pay_type === 'hourly' && (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Hourly rate"
                              className="w-24 rounded-xl"
                              value={editForm.hourly_rate || ''}
                              onChange={(e) => setEditForm({...editForm, hourly_rate: parseFloat(e.target.value) || 0})}
                            />
                          )}
                          {editForm.pay_type === 'salary' && (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Annual salary"
                              className="w-32 rounded-xl"
                              value={editForm.annual_salary || ''}
                              onChange={(e) => setEditForm({...editForm, annual_salary: parseFloat(e.target.value) || 0})}
                            />
                          )}
                        </div>
                      ) : (
                        <div>
                          {structure.pay_type === 'hourly' && formatCurrency(structure.hourly_rate) + '/hr'}
                          {structure.pay_type === 'salary' && formatCurrency(structure.annual_salary) + '/year'}
                          {structure.pay_type === 'commission' && 'Commission-based'}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === structure.employee_id ? (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Commission %"
                          className="w-20 rounded-xl"
                          value={editForm.commission_rate || ''}
                          onChange={(e) => setEditForm({...editForm, commission_rate: parseFloat(e.target.value) || 0})}
                        />
                      ) : (
                        structure.commission_rate ? `${structure.commission_rate}%` : '-'
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === structure.employee_id ? (
                        <Switch
                          checked={editForm.overtime_eligible || false}
                          onCheckedChange={(checked) => setEditForm({...editForm, overtime_eligible: checked})}
                        />
                      ) : (
                        <Badge variant={structure.overtime_eligible ? 'default' : 'secondary'} className="rounded-xl">
                          {structure.overtime_eligible ? 'Eligible' : 'Not Eligible'}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === structure.employee_id ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Health insurance"
                            className="w-24 rounded-xl text-xs"
                            value={editForm.health_insurance_deduction || ''}
                            onChange={(e) => setEditForm({...editForm, health_insurance_deduction: parseFloat(e.target.value) || 0})}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Retirement"
                            className="w-24 rounded-xl text-xs"
                            value={editForm.retirement_contribution || ''}
                            onChange={(e) => setEditForm({...editForm, retirement_contribution: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      ) : (
                        <div className="text-sm">
                          <div>Health: {formatCurrency(structure.health_insurance_deduction)}</div>
                          <div className="text-gray-500">401k: {formatCurrency(structure.retirement_contribution)}</div>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex space-x-2">
                        {editingEmployee === structure.employee_id ? (
                          <>
                            <Button
                              size="sm"
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                              onClick={savePayStructure}
                              disabled={loading}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={cancelEditing}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => startEditing(structure.employee_id)}
                          >
                            <Edit className="w-4 h-4" />
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

export default PayStructureManagement;
