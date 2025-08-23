
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, Undo2, XCircle, CheckCircle, AlertCircle } from 'lucide-react';

interface BulkOperationsProps {
  selectedIds: string[];
  onOperationComplete: () => void;
}

interface BulkOperation {
  type: 'export' | 'print' | 'void' | 'refund';
  title: string;
  description: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive' | 'outline';
  requiresConfirmation: boolean;
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedIds,
  onOperationComplete
}) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<BulkOperation | null>(null);

  const operations: BulkOperation[] = [
  {
    type: 'export',
    title: 'Export Selected',
    description: 'Export sales data to CSV',
    icon: <Download className="w-4 h-4" />,
    variant: 'outline',
    requiresConfirmation: false
  },
  {
    type: 'print',
    title: 'Print Receipts',
    description: 'Print all selected receipts',
    icon: <Printer className="w-4 h-4" />,
    variant: 'outline',
    requiresConfirmation: false
  },
  {
    type: 'void',
    title: 'Void Sales',
    description: 'Mark selected sales as voided',
    icon: <XCircle className="w-4 h-4" />,
    variant: 'destructive',
    requiresConfirmation: true
  },
  {
    type: 'refund',
    title: 'Process Refunds',
    description: 'Initiate refund process',
    icon: <Undo2 className="w-4 h-4" />,
    variant: 'destructive',
    requiresConfirmation: true
  }];


  const handleOperation = async (operation: BulkOperation) => {
    if (operation.requiresConfirmation) {
      setPendingOperation(operation);
      setShowConfirmDialog(true);
      return;
    }

    await executeOperation(operation);
  };

  const executeOperation = async (operation: BulkOperation) => {
    try {
      setProcessing(true);
      setProgress(0);

      // Simulate progress for different operations
      const steps = selectedIds.length;
      let completed = 0;

      for (const saleId of selectedIds) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate processing time

        switch (operation.type) {
          case 'export':
            await exportSale(saleId);
            break;
          case 'print':
            await printReceipt(saleId);
            break;
          case 'void':
            await voidSale(saleId);
            break;
          case 'refund':
            await processSaleRefund(saleId);
            break;
        }

        completed++;
        setProgress(completed / steps * 100);
      }

      toast({
        title: "Operation Complete",
        description: `Successfully processed ${selectedIds.length} sales`
      });

      onOperationComplete();

    } catch (error) {
      console.error('Bulk operation error:', error);
      toast({
        title: "Operation Failed",
        description: "Some operations may have failed. Please check and try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
      setProgress(0);
      setShowConfirmDialog(false);
      setPendingOperation(null);
    }
  };

  const exportSale = async (saleId: string) => {
    // Implementation for exporting individual sale
    console.log(`Exporting sale ${saleId}`);
  };

  const printReceipt = async (saleId: string) => {
    // Implementation for printing individual receipt
    console.log(`Printing receipt for sale ${saleId}`);
  };

  const voidSale = async (saleId: string) => {
    // Implementation for voiding sale
    try {
      const { error } = await window.ezsite.apis.tableUpdate(36856, {
        ID: parseInt(saleId),
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_reason: 'Bulk void operation'
      });

      if (error) throw error;
    } catch (error) {
      throw new Error(`Failed to void sale ${saleId}: ${error}`);
    }
  };

  const processSaleRefund = async (saleId: string) => {
    // Implementation for processing refund
    try {
      // Update sale status
      const { error: saleError } = await window.ezsite.apis.tableUpdate(36856, {
        ID: parseInt(saleId),
        status: 'refunded',
        refunded_at: new Date().toISOString()
      });

      if (saleError) throw saleError;

      // Create return record
      const { error: returnError } = await window.ezsite.apis.tableCreate(36858, {
        sale_id: parseInt(saleId),
        return_type: 'refund',
        status: 'completed',
        processed_by: 'bulk_operation',
        created_at: new Date().toISOString()
      });

      if (returnError) throw returnError;

    } catch (error) {
      throw new Error(`Failed to process refund for sale ${saleId}: ${error}`);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="rounded-3xl border-0 shadow-sm bg-emerald-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Bulk Operations</span>
              </CardTitle>
              <CardDescription>
                {selectedIds.length} sales selected
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {selectedIds.length} items
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {processing ?
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600 text-center">
                Please wait while we process the selected items
              </p>
            </div> :

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {operations.map((operation) =>
            <Button
              key={operation.type}
              variant={operation.variant}
              size="sm"
              onClick={() => handleOperation(operation)}
              className="flex flex-col items-center space-y-1 h-auto py-3"
              disabled={processing}>

                  {operation.icon}
                  <span className="text-xs">{operation.title}</span>
                </Button>
            )}
            </div>
          }
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span>Confirm {pendingOperation?.title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pendingOperation?.description.toLowerCase()} for {selectedIds.length} selected sales? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingOperation && executeOperation(pendingOperation)}
              className="bg-red-600 hover:bg-red-700">

              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);

};

export default BulkOperations;