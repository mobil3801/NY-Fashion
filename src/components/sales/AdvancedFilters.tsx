
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AdvancedFiltersProps {
  filters: any;
  onFiltersChange: (filters: any) => void;
  canViewAllEmployees: boolean;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  canViewAllEmployees
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (canViewAllEmployees) {
      loadEmployees();
    }
    loadCustomers();
  }, [canViewAllEmployees]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(36859, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'first_name',
        IsAsc: true,
        Filters: [
        {
          name: 'status',
          op: 'Equal',
          value: 'active'
        }]

      });

      if (error) throw error;
      setEmployees(data?.List || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(36852, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'name',
        IsAsc: true,
        Filters: []
      });

      if (error) throw error;
      setCustomers(data?.List || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (type: 'from' | 'to', date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [type]: date || null
      }
    });
  };

  const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'mobile_payment', label: 'Mobile Payment' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'store_credit', label: 'Store Credit' }];


  const statuses = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'voided', label: 'Voided' },
  { value: 'refunded', label: 'Refunded' }];


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* Date Range */}
      <div className="space-y-2">
        <Label>Date Range</Label>
        <div className="flex space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateRange.from && "text-muted-foreground"
                )}>

                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange.from ?
                format(filters.dateRange.from, "PPP") :

                <span>From date</span>
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateRange.from}
                onSelect={(date) => handleDateRangeChange('from', date)}
                initialFocus />

            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateRange.to && "text-muted-foreground"
                )}>

                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange.to ?
                format(filters.dateRange.to, "PPP") :

                <span>To date</span>
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateRange.to}
                onSelect={(date) => handleDateRangeChange('to', date)}
                initialFocus />

            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Employee Filter */}
      {canViewAllEmployees &&
      <div className="space-y-2">
          <Label>Employee</Label>
          <Select
          value={filters.employee}
          onValueChange={(value) => handleFilterChange('employee', value)}>

            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Employees</SelectItem>
              {employees.map((employee) =>
            <SelectItem key={employee.id} value={employee.id.toString()}>
                  {employee.first_name} {employee.last_name}
                </SelectItem>
            )}
            </SelectContent>
          </Select>
        </div>
      }

      {/* Payment Method */}
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <Select
          value={filters.paymentMethod}
          onValueChange={(value) => handleFilterChange('paymentMethod', value)}>

          <SelectTrigger>
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Methods</SelectItem>
            {paymentMethods.map((method) =>
            <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={filters.status}
          onValueChange={(value) => handleFilterChange('status', value)}>

          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {statuses.map((status) =>
            <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Customer Search */}
      <div className="space-y-2">
        <Label>Customer</Label>
        <Input
          type="text"
          placeholder="Search customer..."
          value={filters.customer}
          onChange={(e) => handleFilterChange('customer', e.target.value)} />

      </div>

      {/* Amount Range */}
      <div className="space-y-2">
        <Label>Min Amount</Label>
        <Input
          type="number"
          placeholder="0.00"
          value={filters.minAmount}
          onChange={(e) => handleFilterChange('minAmount', e.target.value)}
          step="0.01"
          min="0" />

      </div>

      <div className="space-y-2">
        <Label>Max Amount</Label>
        <Input
          type="number"
          placeholder="999.99"
          value={filters.maxAmount}
          onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
          step="0.01"
          min="0" />

      </div>

      {/* Quick Date Filters */}
      <div className="space-y-2 md:col-span-2 lg:col-span-3 xl:col-span-4">
        <Label>Quick Filters</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              handleDateRangeChange('from', today);
              handleDateRangeChange('to', today);
            }}>

            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              handleDateRangeChange('from', yesterday);
              handleDateRangeChange('to', yesterday);
            }}>

            Yesterday
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);
              handleDateRangeChange('from', weekAgo);
              handleDateRangeChange('to', today);
            }}>

            Last 7 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const monthAgo = new Date(today);
              monthAgo.setDate(monthAgo.getDate() - 30);
              handleDateRangeChange('from', monthAgo);
              handleDateRangeChange('to', today);
            }}>

            Last 30 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              handleDateRangeChange('from', startOfMonth);
              handleDateRangeChange('to', today);
            }}>

            This Month
          </Button>
        </div>
      </div>
    </div>);

};

export default AdvancedFilters;