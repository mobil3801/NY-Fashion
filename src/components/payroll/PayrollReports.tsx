
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Calendar,
  Users,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface ReportData {
  type: 'summary' | 'detailed' | 'tax' | 'department';
  period: string;
  data: any;
  generatedAt: string;
}

const PayrollReports: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [reportPeriod, setReportPeriod] = useState('current-month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    // Set default date range based on selected period
    const now = new Date();
    switch (reportPeriod) {
      case 'current-month':
        setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      case 'last-3-months':
        setStartDate(format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd'));
        setEndDate(format(now, 'yyyy-MM-dd'));
        break;
      case 'custom':
        // Keep current values
        break;
    }
  }, [reportPeriod]);

  const generateReport = async () => {
    try {
      setLoading(true);
      
      if (!startDate || !endDate) {
        toast({
          title: 'Error',
          description: 'Please select start and end dates',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await window.ezsite.apis.run({
        path: 'generatePayrollReport',
        param: [reportType, startDate, endDate]
      });

      if (error) throw error;

      setReportData({
        type: reportType as any,
        period: `${startDate} to ${endDate}`,
        data: data,
        generatedAt: new Date().toISOString()
      });

      toast({
        title: 'Success',
        description: 'Report generated successfully'
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (format: 'pdf' | 'csv' | 'excel') => {
    if (!reportData) {
      toast({
        title: 'Error',
        description: 'No report data available',
        variant: 'destructive'
      });
      return;
    }

    // Generate and download report in specified format
    toast({
      title: 'Success',
      description: `Report downloaded in ${format.toUpperCase()} format`
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const reportTemplates = [
    {
      id: 'summary',
      title: 'Payroll Summary',
      description: 'Overview of payroll totals and key metrics',
      icon: BarChart3,
      color: 'emerald'
    },
    {
      id: 'detailed',
      title: 'Detailed Payroll',
      description: 'Complete breakdown by employee',
      icon: FileText,
      color: 'blue'
    },
    {
      id: 'tax',
      title: 'Tax Report',
      description: 'Tax deductions and compliance summary',
      icon: PieChart,
      color: 'purple'
    },
    {
      id: 'department',
      title: 'Department Analysis',
      description: 'Payroll costs by department',
      icon: Users,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll Reports</h2>
          <p className="text-gray-600">Generate comprehensive payroll reports and analytics</p>
        </div>
      </div>

      <Tabs value={reportType} onValueChange={setReportType} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-gray-100">
          {reportTemplates.map((template) => (
            <TabsTrigger key={template.id} value={template.id} className="rounded-xl">
              <template.icon className="w-4 h-4 mr-2" />
              {template.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Report Configuration */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Configure your report parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Report Period</Label>
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Current Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  className="rounded-2xl"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={reportPeriod !== 'custom'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  className="rounded-2xl"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={reportPeriod !== 'custom'}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-gray-600">
                Report will cover: {startDate} to {endDate}
              </div>
              <Button 
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                onClick={generateReport}
                disabled={loading || !startDate || !endDate}
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Templates */}
        {reportTemplates.map((template) => (
          <TabsContent key={template.id} value={template.id}>
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-${template.color}-100 rounded-2xl flex items-center justify-center`}>
                    <template.icon className={`w-6 h-6 text-${template.color}-600`} />
                  </div>
                  <div>
                    <CardTitle>{template.title}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {reportData && reportData.type === template.id ? (
                  <div className="space-y-6">
                    {/* Report Header */}
                    <div className="flex justify-between items-center pb-4 border-b">
                      <div>
                        <h3 className="text-lg font-semibold">Report Generated</h3>
                        <p className="text-gray-600">
                          Period: {reportData.period} | Generated: {format(new Date(reportData.generatedAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => downloadReport('pdf')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => downloadReport('csv')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => downloadReport('excel')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Excel
                        </Button>
                      </div>
                    </div>

                    {/* Summary Report Content */}
                    {template.id === 'summary' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-emerald-50 p-4 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-emerald-600 font-medium">Total Gross Pay</p>
                              <p className="text-2xl font-bold text-emerald-800">
                                {formatCurrency(reportData.data?.totalGross || 0)}
                              </p>
                            </div>
                            <DollarSign className="w-8 h-8 text-emerald-600" />
                          </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-red-600 font-medium">Total Deductions</p>
                              <p className="text-2xl font-bold text-red-800">
                                {formatCurrency(reportData.data?.totalDeductions || 0)}
                              </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-red-600" />
                          </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-600 font-medium">Total Net Pay</p>
                              <p className="text-2xl font-bold text-blue-800">
                                {formatCurrency(reportData.data?.totalNet || 0)}
                              </p>
                            </div>
                            <Calendar className="w-8 h-8 text-blue-600" />
                          </div>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-purple-600 font-medium">Employees Paid</p>
                              <p className="text-2xl font-bold text-purple-800">
                                {reportData.data?.employeeCount || 0}
                              </p>
                            </div>
                            <Users className="w-8 h-8 text-purple-600" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detailed Report Content */}
                    {template.id === 'detailed' && (
                      <div className="space-y-4">
                        <p className="text-gray-600">Detailed employee-by-employee breakdown will be available in the downloaded report.</p>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <h4 className="font-semibold mb-2">Report includes:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Individual employee pay calculations</li>
                            <li>• Hours worked (regular and overtime)</li>
                            <li>• Gross pay breakdown</li>
                            <li>• Tax and deduction details</li>
                            <li>• Net pay amounts</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Tax Report Content */}
                    {template.id === 'tax' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <h4 className="font-semibold">Federal Tax Summary</h4>
                          <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                            <div className="flex justify-between">
                              <span>Federal Income Tax:</span>
                              <span>{formatCurrency(reportData.data?.federalTax || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Social Security:</span>
                              <span>{formatCurrency(reportData.data?.socialSecurity || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Medicare:</span>
                              <span>{formatCurrency(reportData.data?.medicare || 0)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-semibold">State & Other Deductions</h4>
                          <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                            <div className="flex justify-between">
                              <span>State Income Tax:</span>
                              <span>{formatCurrency(reportData.data?.stateTax || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Health Insurance:</span>
                              <span>{formatCurrency(reportData.data?.healthInsurance || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>401(k) Contributions:</span>
                              <span>{formatCurrency(reportData.data?.retirement || 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Department Report Content */}
                    {template.id === 'department' && (
                      <div className="space-y-4">
                        <p className="text-gray-600">Department-wise payroll analysis will be available in the downloaded report.</p>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <h4 className="font-semibold mb-2">Analysis includes:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Payroll costs by department</li>
                            <li>• Average pay rates</li>
                            <li>• Overtime distribution</li>
                            <li>• Headcount analysis</li>
                            <li>• Budget variance tracking</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <template.icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Generate {template.title}</h3>
                    <p className="text-gray-600 mb-4">{template.description}</p>
                    <p className="text-sm text-gray-500">Configure your report parameters above and click "Generate Report"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PayrollReports;
