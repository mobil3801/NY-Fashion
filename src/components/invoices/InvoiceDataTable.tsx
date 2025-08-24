
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  MoreHorizontal, Eye, Printer, Mail, Edit, Undo2,
  ChevronLeft, ChevronRight, RefreshCcw, CheckCircle,
  Clock, XCircle, AlertCircle } from
'lucide-react';
import { format } from 'date-fns';

interface InvoiceDataTableProps {
  filters: any;
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
  onInvoiceSelect: (invoice: any) => void;
  onPrintInvoice: (invoiceId: string) => void;
  onEmailInvoice: (invoiceId: string) => void;
  canViewAll: boolean;
  canManage: boolean;
  status?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  employee_id: number;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  due_date: string;
  notes?: string;
}

const InvoiceDataTable: React.FC<InvoiceDataTableProps> = ({
  filters,
  selectedItems,
  onSelectionChange,
  onInvoiceSelect,
  onPrintInvoice,
  onEmailInvoice,
  canViewAll,
  canManage,
  status = ''
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadInvoices();
  }, [filters, currentPage, status]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const apiFilters = [];

      // Apply status filter
      if (status) {
        apiFilters.push({
          name: 'status',
          op: 'Equal',
          value: status
        });
      }

      if (filters.dateRange.from) {
        apiFilters.push({
          name: 'created_at',
          op: 'GreaterThanOrEqual',
          value: filters.dateRange.from.toISOString().split('T')[0]
        });
      }

      if (filters.dateRange.to) {
        apiFilters.push({
          name: 'created_at',
          op: 'LessThanOrEqual',
          value: filters.dateRange.to.toISOString().split('T')[0]
        });
      }

      if (filters.employee) {
        apiFilters.push({
          name: 'employee_id',
          op: 'Equal',
          value: parseInt(filters.employee)
        });
      }

      if (filters.customer) {
        apiFilters.push({
          name: 'customer_name',
          op: 'StringContains',
          value: filters.customer
        });
      }

      if (filters.invoiceNumber) {
        apiFilters.push({
          name: 'invoice_number',
          op: 'StringContains',
          value: filters.invoiceNumber
        });
      }

      if (filters.minAmount) {
        apiFilters.push({
          name: 'total_amount',
          op: 'GreaterThanOrEqual',
          value: parseFloat(filters.minAmount)
        });
      }

      if (filters.maxAmount) {
        apiFilters.push({
          name: 'total_amount',
          op: 'LessThanOrEqual',
          value: parseFloat(filters.maxAmount)
        });
      }

      // If user is not admin/manager, only show their invoices
      if (!canViewAll && user?.ID) {
        apiFilters.push({
          name: 'employee_id',
          op: 'Equal',
          value: user.ID
        });
      }

      const { data, error } = await window.ezsite.apis.tablePage(36856, {
        PageNo: currentPage,
        PageSize: pageSize,
        OrderByField: 'created_at',
        IsAsc: false,
        Filters: apiFilters
      });

      if (error) throw error;

      setInvoices(data?.List || []);
      setTotalCount(data?.VirtualCount || 0);

    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(invoices.map((invoice) => invoice.id.toString()));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectItem = (invoiceId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedItems, invoiceId]);
    } else {
      onSelectionChange(selectedItems.filter((id) => id !== invoiceId));
    }
  };

  const handleStatusUpdate = async (invoiceId: number, newStatus: string) => {
    try {
      const updateData: any = {
        ID: invoiceId,
        status: newStatus
      };

      if (newStatus === 'paid') {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          updateData.paid_amount = invoice.total_amount;
          updateData.payment_date = new Date().toISOString();
        }
      }

      const { error } = await window.ezsite.apis.tableUpdate(36856, updateData);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Invoice status changed to ${newStatus}`
      });

      loadInvoices();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Unable to update invoice status",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    const status = invoice.status;
    const statusConfig = {
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      partial: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      voided: { color: 'bg-red-100 text-red-800', icon: XCircle },
      overdue: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    let finalStatus = status;
    let finalConfig = statusConfig.pending;

    // Check for overdue
    if (status === 'pending' && invoice.due_date) {
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      if (dueDate < today) {
        finalStatus = 'overdue';
        finalConfig = statusConfig.overdue;
      } else {
        finalConfig = statusConfig.pending;
      }
    } else if (statusConfig[status as keyof typeof statusConfig]) {
      finalConfig = statusConfig[status as keyof typeof statusConfig];
    }

    const Icon = finalConfig.icon;

    return (
      <Badge className={`${finalConfig.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1)}
      </Badge>);

  };

  const formatCurrency = (amount: number) => `$${amount?.toFixed(2) || '0.00'}`;
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status !== 'pending' || !invoice.due_date) return false;
    return new Date(invoice.due_date) < new Date();
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const isAllSelected = invoices.length > 0 && selectedItems.length === invoices.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < invoices.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) =>
        <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        )}
      </div>);

  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onCheckedChange={handleSelectAll} />

              </TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) =>
            <TableRow
              key={invoice.id}
              className={`${isOverdue(invoice) ? 'bg-red-50' : ''} cursor-pointer hover:bg-gray-50`}
              onClick={() => onInvoiceSelect(invoice)}>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                  checked={selectedItems.includes(invoice.id.toString())}
                  onCheckedChange={(checked) =>
                  handleSelectItem(invoice.id.toString(), checked as boolean)
                  } />

                </TableCell>
                <TableCell className="font-mono font-medium">
                  {invoice.invoice_number}
                  {isOverdue(invoice) &&
                <Badge variant="destructive" className="ml-2 text-xs">
                      OVERDUE
                    </Badge>
                }
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{invoice.customer_name || 'Walk-in Customer'}</div>
                    {invoice.customer_email &&
                  <div className="text-sm text-gray-500">{invoice.customer_email}</div>
                  }
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-semibold">{formatCurrency(invoice.total_amount)}</div>
                    {invoice.status === 'partial' &&
                  <div className="text-sm text-gray-500">
                        Paid: {formatCurrency(invoice.paid_amount || 0)}
                      </div>
                  }
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(invoice)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDate(invoice.created_at)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {invoice.due_date ? formatDate(invoice.due_date) : 'No due date'}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onInvoiceSelect(invoice)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPrintInvoice(invoice.id.toString())}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Invoice
                      </DropdownMenuItem>
                      {invoice.customer_email &&
                    <DropdownMenuItem onClick={() => onEmailInvoice(invoice.id.toString())}>
                          <Mail className="w-4 h-4 mr-2" />
                          Email Invoice
                        </DropdownMenuItem>
                    }
                      {canManage &&
                    <React.Fragment>
                          {invoice.status === 'pending' &&
                      <DropdownMenuItem onClick={() => handleStatusUpdate(invoice.id, 'paid')}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                      }
                          {invoice.status === 'paid' &&
                      <DropdownMenuItem onClick={() => handleStatusUpdate(invoice.id, 'pending')}>
                              <Clock className="w-4 h-4 mr-2" />
                              Mark as Pending
                            </DropdownMenuItem>
                      }
                          <DropdownMenuItem onClick={() => handleStatusUpdate(invoice.id, 'voided')}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Void Invoice
                          </DropdownMenuItem>
                        </React.Fragment>
                    }
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )}
            {invoices.length === 0 &&
            <TableRow>
                <TableCell
                colSpan={8}
                className="text-center py-12 text-gray-500">

                  No invoices found matching the current filters
                </TableCell>
              </TableRow>
            }
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 &&
      <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage <= 1}>

              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8 h-8 p-0">

                    {pageNum}
                  </Button>);

            })}
            </div>
            <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages}>

              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      }

      {/* Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600 pt-4 border-t">
        <div className="space-x-4">
          <span>
            Total Amount: <span className="font-semibold text-gray-900">
              {formatCurrency(invoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0))}
            </span>
          </span>
          {status === 'pending' &&
          <span>
              Overdue: <span className="font-semibold text-red-600">
                {invoices.filter((inv) => isOverdue(inv)).length}
              </span>
            </span>
          }
        </div>
        <Button variant="ghost" size="sm" onClick={loadInvoices}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>);

};

export default InvoiceDataTable;