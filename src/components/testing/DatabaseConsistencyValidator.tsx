import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Play, 
  RotateCcw,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

interface ValidationResult {
  id: string;
  check: string;
  table: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

interface TableIntegrityCheck {
  name: string;
  table: string;
  description: string;
  executor: () => Promise<{ valid: boolean; message: string; details?: any }>;
  critical: boolean;
}

const DatabaseConsistencyValidator: React.FC = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentCheck, setCurrentCheck] = useState<string | null>(null);

  const integrityChecks: TableIntegrityCheck[] = [
    {
      name: 'Product SKU Uniqueness',
      table: 'products',
      description: 'Verify all product SKUs are unique',
      critical: true,
      executor: async () => {
        const result = await window.ezsite.apis.tablePage(36848, {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'ID',
          IsAsc: true
        });
        
        if (result.error) throw new Error(result.error);
        
        const products = result.data.List;
        const skus = products.map((p: any) => p.sku).filter(Boolean);
        const uniqueSkus = new Set(skus);
        
        if (skus.length !== uniqueSkus.size) {
          const duplicates = skus.filter((sku: string, index: number) => 
            skus.indexOf(sku) !== index
          );
          return {
            valid: false,
            message: `Found ${duplicates.length} duplicate SKUs`,
            details: { duplicates: [...new Set(duplicates)] }
          };
        }
        
        return {
          valid: true,
          message: `All ${skus.length} SKUs are unique`
        };
      }
    },
    {
      name: 'Stock Movement Balance',
      table: 'stock_movements',
      description: 'Verify stock movements balance with current inventory',
      critical: true,
      executor: async () => {
        const [stockResult, movementResult] = await Promise.all([
          window.ezsite.apis.tablePage(36848, { PageNo: 1, PageSize: 100 }),
          window.ezsite.apis.tablePage(36851, { PageNo: 1, PageSize: 1000 })
        ]);
        
        if (stockResult.error) throw new Error(stockResult.error);
        if (movementResult.error) throw new Error(movementResult.error);
        
        const products = stockResult.data.List;
        const movements = movementResult.data.List;
        
        const inconsistencies: any[] = [];
        
        for (const product of products) {
          const productMovements = movements.filter((m: any) => m.product_id === product.id);
          const calculatedStock = productMovements.reduce((total: number, movement: any) => {
            return movement.type === 'in' ? total + movement.quantity : total - movement.quantity;
          }, 0);
          
          if (Math.abs(calculatedStock - product.stock_quantity) > 0.01) {
            inconsistencies.push({
              productId: product.id,
              productName: product.name,
              currentStock: product.stock_quantity,
              calculatedStock
            });
          }
        }
        
        if (inconsistencies.length > 0) {
          return {
            valid: false,
            message: `Found ${inconsistencies.length} stock inconsistencies`,
            details: { inconsistencies }
          };
        }
        
        return {
          valid: true,
          message: `All ${products.length} products have consistent stock levels`
        };
      }
    },
    {
      name: 'Customer Data Integrity',
      table: 'customers',
      description: 'Verify customer email uniqueness and required fields',
      critical: true,
      executor: async () => {
        const result = await window.ezsite.apis.tablePage(36852, {
          PageNo: 1,
          PageSize: 1000
        });
        
        if (result.error) throw new Error(result.error);
        
        const customers = result.data.List;
        const emails = customers.map((c: any) => c.email).filter(Boolean);
        const uniqueEmails = new Set(emails);
        
        const issues: string[] = [];
        
        if (emails.length !== uniqueEmails.size) {
          issues.push('Duplicate email addresses found');
        }
        
        const missingRequired = customers.filter((c: any) => !c.name || !c.email);
        if (missingRequired.length > 0) {
          issues.push(`${missingRequired.length} customers missing required fields`);
        }
        
        if (issues.length > 0) {
          return {
            valid: false,
            message: issues.join(', '),
            details: { issues }
          };
        }
        
        return {
          valid: true,
          message: `All ${customers.length} customers have valid data`
        };
      }
    },
    {
      name: 'Employee Data Completeness',
      table: 'employees',
      description: 'Check for complete employee records',
      critical: false,
      executor: async () => {
        const result = await window.ezsite.apis.tablePage(36859, {
          PageNo: 1,
          PageSize: 1000
        });
        
        if (result.error) throw new Error(result.error);
        
        const employees = result.data.List;
        const incomplete = employees.filter((e: any) => 
          !e.first_name || !e.last_name || !e.email || !e.hire_date
        );
        
        if (incomplete.length > 0) {
          return {
            valid: false,
            message: `${incomplete.length} employees have incomplete records`,
            details: { incomplete: incomplete.map((e: any) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })) }
          };
        }
        
        return {
          valid: true,
          message: `All ${employees.length} employees have complete records`
        };
      }
    },
    {
      name: 'Purchase Order Consistency',
      table: 'purchase_orders',
      description: 'Verify PO totals match item totals',
      critical: true,
      executor: async () => {
        const [poResult, itemsResult] = await Promise.all([
          window.ezsite.apis.tablePage(36854, { PageNo: 1, PageSize: 100 }),
          window.ezsite.apis.tablePage(36855, { PageNo: 1, PageSize: 1000 })
        ]);
        
        if (poResult.error) throw new Error(poResult.error);
        if (itemsResult.error) throw new Error(itemsResult.error);
        
        const purchaseOrders = poResult.data.List;
        const items = itemsResult.data.List;
        
        const inconsistencies: any[] = [];
        
        for (const po of purchaseOrders) {
          const poItems = items.filter((item: any) => item.purchase_order_id === po.id);
          const calculatedTotal = poItems.reduce((total: number, item: any) => 
            total + (item.quantity * item.unit_cost), 0
          );
          
          if (Math.abs(calculatedTotal - po.total) > 0.01) {
            inconsistencies.push({
              poId: po.id,
              poTotal: po.total,
              calculatedTotal
            });
          }
        }
        
        if (inconsistencies.length > 0) {
          return {
            valid: false,
            message: `Found ${inconsistencies.length} PO total inconsistencies`,
            details: { inconsistencies }
          };
        }
        
        return {
          valid: true,
          message: `All ${purchaseOrders.length} purchase orders have consistent totals`
        };
      }
    },
    {
      name: 'Sales Data Integrity',
      table: 'sales',
      description: 'Verify sales totals and item relationships',
      critical: true,
      executor: async () => {
        const [salesResult, itemsResult] = await Promise.all([
          window.ezsite.apis.tablePage(36856, { PageNo: 1, PageSize: 100 }),
          window.ezsite.apis.tablePage(36857, { PageNo: 1, PageSize: 1000 })
        ]);
        
        if (salesResult.error) throw new Error(salesResult.error);
        if (itemsResult.error) throw new Error(itemsResult.error);
        
        const sales = salesResult.data.List;
        const items = itemsResult.data.List;
        
        const issues: any[] = [];
        
        for (const sale of sales) {
          const saleItems = items.filter((item: any) => item.sale_id === sale.id);
          
          if (saleItems.length === 0) {
            issues.push({
              type: 'no_items',
              saleId: sale.id,
              message: 'Sale has no items'
            });
            continue;
          }
          
          const calculatedTotal = saleItems.reduce((total: number, item: any) => 
            total + (item.quantity * item.unit_price), 0
          );
          
          if (Math.abs(calculatedTotal - sale.total) > 0.01) {
            issues.push({
              type: 'total_mismatch',
              saleId: sale.id,
              saleTotal: sale.total,
              calculatedTotal
            });
          }
        }
        
        if (issues.length > 0) {
          return {
            valid: false,
            message: `Found ${issues.length} sales data issues`,
            details: { issues }
          };
        }
        
        return {
          valid: true,
          message: `All ${sales.length} sales records are consistent`
        };
      }
    },
    {
      name: 'Time Tracking Completeness',
      table: 'time_entries',
      description: 'Check for incomplete time entries',
      critical: false,
      executor: async () => {
        const result = await window.ezsite.apis.tablePage(36861, {
          PageNo: 1,
          PageSize: 1000,
          OrderByField: 'clock_in',
          IsAsc: false
        });
        
        if (result.error) throw new Error(result.error);
        
        const timeEntries = result.data.List;
        const incomplete = timeEntries.filter((entry: any) => 
          entry.clock_in && !entry.clock_out
        );
        
        if (incomplete.length > 0) {
          return {
            valid: false,
            message: `${incomplete.length} time entries are still open (no clock out)`,
            details: { incomplete }
          };
        }
        
        return {
          valid: true,
          message: `All time entries are complete`
        };
      }
    },
    {
      name: 'Orphaned Records Check',
      table: 'multiple',
      description: 'Find records without valid foreign key relationships',
      critical: false,
      executor: async () => {
        const [productsResult, categoriesResult] = await Promise.all([
          window.ezsite.apis.tablePage(36848, { PageNo: 1, PageSize: 1000 }),
          window.ezsite.apis.tablePage(36847, { PageNo: 1, PageSize: 100 })
        ]);
        
        if (productsResult.error) throw new Error(productsResult.error);
        if (categoriesResult.error) throw new Error(categoriesResult.error);
        
        const products = productsResult.data.List;
        const categories = categoriesResult.data.List;
        const categoryIds = new Set(categories.map((c: any) => c.id));
        
        const orphanedProducts = products.filter((p: any) => 
          p.category_id && !categoryIds.has(p.category_id)
        );
        
        if (orphanedProducts.length > 0) {
          return {
            valid: false,
            message: `Found ${orphanedProducts.length} products with invalid category references`,
            details: { orphanedProducts }
          };
        }
        
        return {
          valid: true,
          message: 'No orphaned records found'
        };
      }
    }
  ];

  const runValidation = useCallback(async () => {
    setIsValidating(true);
    setResults([]);
    setProgress(0);
    
    const totalChecks = integrityChecks.length;
    let completedChecks = 0;

    try {
      for (const check of integrityChecks) {
        setCurrentCheck(check.name);
        const startTime = performance.now();

        try {
          const result = await check.executor();
          const duration = performance.now() - startTime;

          setResults(prev => [...prev, {
            id: `${check.table}-${check.name}-${Date.now()}`,
            check: check.name,
            table: check.table,
            status: result.valid ? 'passed' : (check.critical ? 'failed' : 'warning'),
            message: result.message,
            details: result.details,
            timestamp: new Date().toISOString()
          }]);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          setResults(prev => [...prev, {
            id: `${check.table}-${check.name}-${Date.now()}`,
            check: check.name,
            table: check.table,
            status: check.critical ? 'failed' : 'warning',
            message: `Validation failed: ${errorMessage}`,
            timestamp: new Date().toISOString()
          }]);
        }

        completedChecks++;
        setProgress((completedChecks / totalChecks) * 100);
        
        // Small delay between checks
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const passedChecks = results.filter(r => r.status === 'passed').length;
      const failedChecks = results.filter(r => r.status === 'failed').length;
      const warningChecks = results.filter(r => r.status === 'warning').length;

      toast.success(
        `Database validation completed: ${passedChecks} passed, ${failedChecks} failed, ${warningChecks} warnings`
      );

    } catch (error) {
      toast.error('Database validation interrupted');
    } finally {
      setIsValidating(false);
      setCurrentCheck(null);
    }
  }, [results, integrityChecks]);

  const resetValidation = useCallback(() => {
    setResults([]);
    setProgress(0);
    setCurrentCheck(null);
    toast.info('Validation results reset');
  }, []);

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const statusCounts = React.useMemo(() => {
    return {
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warning: results.filter(r => r.status === 'warning').length
    };
  }, [results]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Consistency Validator</h2>
          <p className="text-muted-foreground">
            Verify data integrity and consistency across all database tables
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={runValidation}
            disabled={isValidating}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isValidating ? 'Validating...' : 'Run Validation'}
          </Button>
          
          <Button
            variant="outline"
            onClick={resetValidation}
            disabled={isValidating}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {isValidating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Validation Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentCheck && (
                <p className="text-sm text-muted-foreground">
                  Running: {currentCheck}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statusCounts.passed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.warning}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Validation Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {results.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No validation results available. Click "Run Validation" to check database consistency.
                  </AlertDescription>
                </Alert>
              ) : (
                results.map((result) => (
                  <Card key={result.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <div>
                          <h4 className="font-medium">{result.check}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {result.table}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.message}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          result.status === 'passed' ? 'secondary' :
                          result.status === 'failed' ? 'destructive' :
                          'outline'
                        }
                      >
                        {result.status}
                      </Badge>
                    </div>
                    
                    {result.details && (
                      <div className="mt-3 p-2 bg-muted rounded text-xs">
                        <pre>{JSON.stringify(result.details, null, 2)}</pre>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseConsistencyValidator;