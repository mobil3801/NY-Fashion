
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, Filter, Download, TrendingUp, DollarSign,
  ShoppingCart, Users, Calendar, MoreHorizontal, Eye, RefreshCcw,
  X, WifiOff, AlertTriangle } from
'lucide-react';
import SalesAnalytics from '@/components/sales/SalesAnalytics';
import SalesDataTable from '@/components/sales/SalesDataTable';
import AdvancedFilters from '@/components/sales/AdvancedFilters';
import BulkOperations from '@/components/sales/BulkOperations';
import { NetworkAwareSaleForm } from '@/components/sales/NetworkAwareSaleForm';
import { EnhancedSalesForm } from '@/components/sales/EnhancedSalesForm';
import { useNetwork } from '@/contexts/NetworkContext';

interface SalesData {
  totalSales: number;
  todaySales: number;
  totalTransactions: number;
  averageOrderValue: number;
  topEmployee: string;
}

interface SalesFilters {
  dateRange: {from: Date | null;to: Date | null;};
  employee: string;
  paymentMethod: string;
  customer: string;
  status: string;
  minAmount: string;
  maxAmount: string;
}

const SalesPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { online, retryNow } = useNetwork();
  const [activeTab, setActiveTab] = useState('overview');
  const [salesData, setSalesData] = useState<SalesData>({
    totalSales: 0,
    todaySales: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    topEmployee: ''
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>({
    dateRange: { from: null, to: null },
    employee: '',
    paymentMethod: '',
    customer: '',
    status: '',
    minAmount: '',
    maxAmount: ''
  });
  const [selectedSales, setSelectedSales] = useState<string[]>([]);

  const canViewAllSales = hasPermission(user, 'view_all_sales');
  const canExportData = hasPermission(user, 'export_data');
  const canManageSales = hasPermission(user, 'manage_sales');

  useEffect(() => {
    loadSalesData();
  }, [filters]);

  const loadSalesData = async () => {
    try {
      setLoading(true);

      // Check if offline and show appropriate message
      if (!online) {
        toast({
          title: "Offline",
          description: "Cannot load latest data while offline. Showing cached data.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Build filters for API call
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
          op: 'StringContains',
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
      if (!canViewAllSales && user?.ID) {
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

      const sales = data?.List || [];

      // Calculate analytics
      const totalSales = sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
      const today = new Date().toISOString().split('T')[0];
      const todaySales = sales.
      filter((sale: any) => sale.created_at?.startsWith(today)).
      reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);

      const totalTransactions = sales.length;
      const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      setSalesData({
        totalSales,
        todaySales,
        totalTransactions,
        averageOrderValue,
        topEmployee: 'Loading...'
      });

    } catch (error) {
      console.error('Error loading sales data:', error);

      // Check if it's a network error
      const isNetworkError = error instanceof Error && (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.name === 'TypeError');


      if (isNetworkError && !online) {
        toast({
          title: "Connection Lost",
          description: "Unable to load data. Will retry when back online.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load sales data. Please try again.",
          variant: "destructive",
          action: online ?
          <Button variant="outline" size="sm" onClick={loadSalesData}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry
            </Button> :
          undefined
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      toast({
        title: "Export Started",
        description: "Your sales data is being exported..."
      });

      // Implementation for export functionality
      // This would generate CSV/Excel file

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export sales data",
        variant: "destructive"
      });
    }
  };

  const resetFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      employee: '',
      paymentMethod: '',
      customer: '',
      status: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{t('sales')}</h1>
            {!online &&
            <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline Mode
              </Badge>
            }
          </div>
          <p className="text-gray-600 mt-2">
            Manage and analyze your sales data
            {!online && " • Limited functionality while offline"}
          </p>
        </div>
        <div className="flex gap-2">
          {canExportData &&
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={handleExport}>

              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          }
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setShowFilters(!showFilters)}>

            <Filter className="w-4 h-4 mr-2" />
            Filters
            {Object.values(filters).some((v) => v !== '' && v !== null) &&
            <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            }
          </Button>
          <Button
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
            onClick={() => window.location.href = '/pos'}
            disabled={!online}
            aria-disabled={!online}
            title={!online ? "This action requires an active internet connection" : ""}>

            <Plus className="w-4 h-4 mr-2" />
            New Sale
            {!online && <WifiOff className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters &&
      <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Advanced Filters</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            canViewAllEmployees={canViewAllSales} />

          </CardContent>
        </Card>
      }

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${loading ? '...' : salesData.totalSales.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${loading ? '...' : salesData.todaySales.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : salesData.totalTransactions}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Order</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${loading ? '...' : salesData.averageOrderValue.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="new-sale">New Sale</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
                <CardDescription>Latest sales transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesDataTable
                  filters={filters}
                  selectedItems={selectedSales}
                  onSelectionChange={setSelectedSales}
                  pageSize={5}
                  canViewAll={canViewAllSales} />

              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common sales operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full justify-start bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                  variant="ghost"
                  onClick={() => window.location.href = '/pos'}
                  disabled={!online}
                  aria-disabled={!online}>

                  <Plus className="w-4 h-4 mr-2" />
                  Process New Sale
                  {!online && <WifiOff className="w-4 h-4 ml-2" />}
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={() => setActiveTab('transactions')}>

                  <Eye className="w-4 h-4 mr-2" />
                  View All Transactions
                </Button>
                {canExportData &&
                <Button
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={handleExport}>

                    <Download className="w-4 h-4 mr-2" />
                    Export Sales Data
                  </Button>
                }
                <Button
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={async () => {
                    if (!online) {
                      await retryNow();
                    }
                    await loadSalesData();
                  }}>

                  <RefreshCcw className="w-4 h-4 mr-2" />
                  {!online ? 'Retry Connection' : 'Refresh Data'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {selectedSales.length > 0 && canManageSales &&
          <BulkOperations
            selectedIds={selectedSales}
            onOperationComplete={() => {
              setSelectedSales([]);
              loadSalesData();
            }} />

          }
          
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete sales transaction history</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesDataTable
                filters={filters}
                selectedItems={selectedSales}
                onSelectionChange={setSelectedSales}
                pageSize={20}
                canViewAll={canViewAllSales}
                showBulkActions={canManageSales} />

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <SalesAnalytics filters={filters} canViewAll={canViewAllSales} />
        </TabsContent>

        <TabsContent value="new-sale" className="space-y-4">
          <div className="flex justify-center">
            <EnhancedSalesForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>);

};

export default SalesPage;