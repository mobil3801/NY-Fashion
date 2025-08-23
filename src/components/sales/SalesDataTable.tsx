
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MoreHorizontal, Eye, Printer, RefreshCcw, Undo2, 
  ChevronLeft, ChevronRight, Download, Mail 
} from 'lucide-react';
import { format } from 'date-fns';

interface SalesDataTableProps {
  filters: any;
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
  pageSize?: number;
  canViewAll: boolean;
  showBulkActions?: boolean;
}

interface Sale {
  id: number;
  invoice_number: string;
  customer_name: string;
  employee_id: number;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  notes?: string;
}

const SalesDataTable: React.FC<SalesDataTableProps> = ({
  filters,
  selectedItems,
  onSelectionChange,
  pageSize = 20,
  canViewAll,
  showBulkActions = false
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadSales();
  }, [filters, currentPage, pageSize]);

  const loadSales = async () => {
    try {
      setLoading(true);
      
      const apiFilters = [];
      
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

      if (filters.paymentMethod) {
        apiFilters.push({
          name: 'payment_method',
          op: 'Equal',
          value: filters.paymentMethod
        });
      }

      if (filters.status) {
        apiFilters.push({
          name: 'status',
          op: 'Equal',
          value: filters.status
        });
      }

      if (filters.customer) {
        apiFilters.push({
          name: 'customer_name',
          op: 'StringContains',
          value: filters.customer
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

      // If user is not admin/manager, only show their sales
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

      setSales(data?.List || []);
      setTotalCount(data?.VirtualCount || 0);

    } catch (error) {
      console.error('Error loading sales:', error);
      toast({
        title: "Error",
        description: "Failed to load sales data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(sales.map(sale => sale.id.toString()));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectItem = (saleId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedItems, saleId]);
    } else {
      onSelectionChange(selectedItems.filter(id => id !== saleId));
    }
  };

  const handleViewDetails = (sale: Sale) => {
    // Navigate to invoice detail page or open modal
    window.location.href = `/invoices?invoice=${sale.invoice_number}`;
  };

  const handlePrintReceipt = async (sale: Sale) => {
    try {
      toast({
        title: "Print Started",
        description: "Receipt is being prepared for printing...",
      });
      // Implementation for printing receipt
    } catch (error) {
      toast({
        title: "Print Failed",
        description: "Unable to print receipt",
        variant: "destructive",
      });
    }
  };

  const handleRefund = async (sale: Sale) => {
    try {
      // Navigate to refund process
      window.location.href = `/pos/returns?invoice=${sale.invoice_number}`;
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to process refund",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      voided: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={statusConfig[status as keyof typeof statusConfig] || 'bg-gray-100 text-gray-800'}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => `$${amount?.toFixed(2) || '0.00'}`;
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const isAllSelected = sales.length > 0 && selectedItems.length === sales.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < sales.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {showBulkActions && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                {showBulkActions && (
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.includes(sale.id.toString())}
                      onCheckedChange={(checked) => 
                        handleSelectItem(sale.id.toString(), checked as boolean)
                      }
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono font-medium">
                  {sale.invoice_number}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{sale.customer_name || 'Walk-in Customer'}</div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(sale.total_amount)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {sale.payment_method?.replace('_', ' ') || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getStatusBadge(sale.status)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDate(sale.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(sale)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrintReceipt(sale)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Receipt
                      </DropdownMenuItem>
                      {sale.status === 'completed' && (
                        <DropdownMenuItem onClick={() => handleRefund(sale)}>
                          <Undo2 className="w-4 h-4 mr-2" />
                          Process Refund
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && (
              <TableRow>
                <TableCell 
                  colSpan={showBulkActions ? 8 : 7} 
                  className="text-center py-12 text-gray-500"
                >
                  No sales found matching the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
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
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600 pt-4 border-t">
        <div>
          Total Revenue: <span className="font-semibold text-gray-900">
            {formatCurrency(sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0))}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadSales}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default SalesDataTable;
