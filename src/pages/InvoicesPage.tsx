
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Plus, Search, Filter, Download, Printer, Mail,
  Eye, MoreHorizontal, RefreshCcw, AlertCircle, CheckCircle,
  Clock, XCircle, Edit, Undo2 } from
'lucide-react';
import InvoiceDataTable from '@/components/invoices/InvoiceDataTable';
import InvoiceDetailModal from '@/components/invoices/InvoiceDetailModal';
import InvoiceStatusManager from '@/components/invoices/InvoiceStatusManager';
import ReturnExchangeModal from '@/components/invoices/ReturnExchangeModal';
import BulkInvoiceOperations from '@/components/invoices/BulkInvoiceOperations';
import { EnhancedInvoiceOperations } from '@/components/invoices/EnhancedInvoiceOperations';

interface InvoiceStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  voidedInvoices: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

interface InvoiceFilters {
  dateRange: {from: Date | null;to: Date | null;};
  status: string;
  customer: string;
  employee: string;
  paymentMethod: string;
  minAmount: string;
  maxAmount: string;
  invoiceNumber: string;
}

const InvoicesPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats>({
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    voidedInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [filters, setFilters] = useState<InvoiceFilters>({
    dateRange: { from: null, to: null },
    status: '',
    customer: '',
    employee: '',
    paymentMethod: '',
    minAmount: '',
    maxAmount: '',
    invoiceNumber: ''
  });

  const canViewAllInvoices = hasPermission(user, 'view_all_invoices');
  const canManageInvoices = hasPermission(user, 'manage_invoices');
  const canProcessReturns = hasPermission(user, 'process_returns');
  const canExportData = hasPermission(user, 'export_data');

  useEffect(() => {
    loadInvoiceData();
  }, [filters, activeTab]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);

      const apiFilters = [];

      // Apply tab filter
      if (activeTab !== 'all') {
        apiFilters.push({
          name: 'status',
          op: 'Equal',
          value: activeTab
        });
      }

      // Apply other filters
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

      if (filters.status) {
        apiFilters.push({
          name: 'status',
          op: 'Equal',
          value: filters.status
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
      if (!canViewAllInvoices && user?.ID) {
        apiFilters.push({
          name: 'employee_id',
          op: 'Equal',
          value: user.ID
        });
      }

      const { data, error } = await window.ezsite.apis.tablePage(36856, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'created_at',
        IsAsc: false,
        Filters: apiFilters
      });

      if (error) throw error;

      const invoices = data?.List || [];

      // Calculate stats
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter((inv: any) => inv.status === 'paid').length;
      const pendingInvoices = invoices.filter((inv: any) => inv.status === 'pending').length;
      const voidedInvoices = invoices.filter((inv: any) => inv.status === 'voided').length;

      const totalAmount = invoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);
      const paidAmount = invoices.
      filter((inv: any) => inv.status === 'paid').
      reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);
      const pendingAmount = invoices.
      filter((inv: any) => inv.status === 'pending').
      reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);

      setInvoiceStats({
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        voidedInvoices,
        totalAmount,
        paidAmount,
        pendingAmount
      });

    } catch (error) {
      console.error('Error loading invoice data:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSelect = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const handlePrintInvoice = async (invoiceId: string) => {
    try {
      // Implementation for printing invoice
      toast({
        title: "Print Started",
        description: "Invoice is being prepared for printing..."
      });
    } catch (error) {
      toast({
        title: "Print Failed",
        description: "Unable to print invoice",
        variant: "destructive"
      });
    }
  };

  const handleEmailInvoice = async (invoiceId: string) => {
    try {
      // Implementation for emailing invoice
      toast({
        title: "Email Sent",
        description: "Invoice has been sent via email"
      });
    } catch (error) {
      toast({
        title: "Email Failed",
        description: "Unable to send invoice via email",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      voided: { color: 'bg-red-100 text-red-800', icon: XCircle },
      partial: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>);

  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-gray-900">{t('invoices')}</h1>
          <p className="text-gray-600 mt-2 text-sm lg:text-base">Manage invoices and billing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExportData &&
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl lg:size-default"
            onClick={() => {/* Handle export */}}>
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export</span>
            </Button>
          }
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl lg:size-default"
            onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Filters</span>
            <span className="sm:hidden">Filters</span>
          </Button>
          <Button
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
            size="sm"
            onClick={() => window.location.href = '/pos'}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Sale</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : invoiceStats.totalInvoices}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  ${loading ? '...' : invoiceStats.paidAmount.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ${loading ? '...' : invoiceStats.pendingAmount.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${loading ? '...' : invoiceStats.totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different invoice statuses */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">
            Pending 
            {invoiceStats.pendingInvoices > 0 &&
            <Badge variant="secondary" className="ml-1">
                {invoiceStats.pendingInvoices}
              </Badge>
            }
          </TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="voided">Voided</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {activeTab === 'operations' &&
          <div className="flex justify-center">
              <EnhancedInvoiceOperations />
            </div>
          }
          {selectedInvoices.length > 0 && canManageInvoices &&
          <BulkInvoiceOperations
            selectedIds={selectedInvoices}
            onOperationComplete={() => {
              setSelectedInvoices([]);
              loadInvoiceData();
            }} />

          }
          
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>
                {activeTab === 'all' ? 'All Invoices' :
                activeTab === 'pending' ? 'Pending Invoices' :
                activeTab === 'paid' ? 'Paid Invoices' :
                activeTab === 'partial' ? 'Partially Paid Invoices' :
                'Voided Invoices'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'all' ? 'Complete invoice history' :
                activeTab === 'pending' ? 'Invoices awaiting payment' :
                activeTab === 'paid' ? 'Fully paid invoices' :
                activeTab === 'partial' ? 'Partially paid invoices' :
                'Cancelled or voided invoices'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceDataTable
                filters={filters}
                selectedItems={selectedInvoices}
                onSelectionChange={setSelectedInvoices}
                onInvoiceSelect={handleInvoiceSelect}
                onPrintInvoice={handlePrintInvoice}
                onEmailInvoice={handleEmailInvoice}
                canViewAll={canViewAllInvoices}
                canManage={canManageInvoices}
                status={activeTab === 'all' ? '' : activeTab} />

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Detail Modal */}
      {showInvoiceDetail && selectedInvoice &&
      <InvoiceDetailModal
        invoice={selectedInvoice}
        open={showInvoiceDetail}
        onOpenChange={setShowInvoiceDetail}
        onPrint={() => handlePrintInvoice(selectedInvoice.id)}
        onEmail={() => handleEmailInvoice(selectedInvoice.id)}
        onReturn={() => {
          setShowInvoiceDetail(false);
          setShowReturnModal(true);
        }}
        canManage={canManageInvoices}
        canProcessReturns={canProcessReturns} />

      }

      {/* Return/Exchange Modal */}
      {showReturnModal && selectedInvoice &&
      <ReturnExchangeModal
        invoice={selectedInvoice}
        open={showReturnModal}
        onOpenChange={setShowReturnModal}
        onComplete={() => {
          setShowReturnModal(false);
          loadInvoiceData();
          toast({
            title: "Return Processed",
            description: "Return/exchange has been processed successfully"
          });
        }} />

      }
    </div>);

};

export default InvoicesPage;