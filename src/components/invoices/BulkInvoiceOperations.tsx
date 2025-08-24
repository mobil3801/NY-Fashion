
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BulkInvoiceOperationsProps {
  selectedIds: string[];
  onOperationComplete: () => void;
}

interface BulkOperation {
  type: 'export' | 'print' | 'email' | 'markPaid' | 'void';
  title: string;
  description: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive' | 'outline';
  requiresConfirmation: boolean;
}

const BulkInvoiceOperations: React.FC<BulkInvoiceOperationsProps> = ({
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
    description: 'Export invoice data to CSV',
    icon: <Download className="w-4 h-4" />,
    variant: 'outline',
    requiresConfirmation: false
  },
  {
    type: 'print',
    title: 'Print All',
    description: 'Print all selected invoices',
    icon: <Printer className="w-4 h-4" />,
    variant: 'outline',
    requiresConfirmation: false
  },
  {
    type: 'email',
    title: 'Email All',
    description: 'Send invoices via email',
    icon: <Mail className="w-4 h-4" />,
    variant: 'outline',
    requiresConfirmation: true
  },
  {
    type: 'markPaid',
    title: 'Mark as Paid',
    description: 'Mark all as paid',
    icon: <CheckCircle className="w-4 h-4" />,
    variant: 'default',
    requiresConfirmation: true
  },
  {
    type: 'void',
    title: 'Void Invoices',
    description: 'Mark invoices as voided',
    icon: <XCircle className="w-4 h-4" />,
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

      const steps = selectedIds.length;
      let completed = 0;

      for (const invoiceId of selectedIds) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate processing time

        switch (operation.type) {
          case 'export':
            await exportInvoice(invoiceId);
            break;
          case 'print':
            await printInvoice(invoiceId);
            break;
          case 'email':
            await emailInvoice(invoiceId);
            break;
          case 'markPaid':
            await markInvoiceAsPaid(invoiceId);
            break;
          case 'void':
            await voidInvoice(invoiceId);
            break;
        }

        completed++;
        setProgress(completed / steps * 100);
      }

      toast({
        title: "Operation Complete",
        description: `Successfully processed ${selectedIds.length} invoices`
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

  const exportInvoice = async (invoiceId: string) => {
    // Implementation for exporting individual invoice
    console.log(`Exporting invoice ${invoiceId}`);
  };

  const printInvoice = async (invoiceId: string) => {
    // Implementation for printing individual invoice
    console.log(`Printing invoice ${invoiceId}`);
  };

  const emailInvoice = async (invoiceId: string) => {
    // Implementation for emailing individual invoice
    try {
      // Get invoice details first
      const { data, error } = await window.ezsite.apis.tablePage(36856, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
          name: 'id',
          op: 'Equal',
          value: parseInt(invoiceId)
        }]

      });

      if (error) throw error;

      const invoice = data?.List?.[0];
      if (!invoice || !invoice.customer_email) {
        throw new Error(`Invoice ${invoiceId} has no email address`);
      }

      // Here you would integrate with your email service
      console.log(`Emailing invoice ${invoiceId} to ${invoice.customer_email}`);

    } catch (error) {
      throw new Error(`Failed to email invoice ${invoiceId}: ${error}`);
    }
  };

  const markInvoiceAsPaid = async (invoiceId: string) => {
    try {
      // Get current invoice details
      const { data, error: fetchError } = await window.ezsite.apis.tablePage(36856, {
        PageNo: 1,
        PageSize: 1,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
          name: 'id',
          op: 'Equal',
          value: parseInt(invoiceId)
        }]

      });

      if (fetchError) throw fetchError;

      const invoice = data?.List?.[0];
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Update invoice status
      const { error } = await window.ezsite.apis.tableUpdate(36856, {
        ID: parseInt(invoiceId),
        status: 'paid',
        paid_amount: invoice.total_amount,
        payment_date: new Date().toISOString()
      });

      if (error) throw error;

    } catch (error) {
      throw new Error(`Failed to mark invoice ${invoiceId} as paid: ${error}`);
    }
  };

  const voidInvoice = async (invoiceId: string) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(36856, {
        ID: parseInt(invoiceId),
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_reason: 'Bulk void operation'
      });

      if (error) throw error;

    } catch (error) {
      throw new Error(`Failed to void invoice ${invoiceId}: ${error}`);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <React.Fragment>
      <Card className="rounded-3xl border-0 shadow-sm bg-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span>Bulk Invoice Operations</span>
              </CardTitle>
              <CardDescription>
                {selectedIds.length} invoices selected
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {selectedIds.length} items
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {processing ?
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing invoices...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-600 text-center">
                Please wait while we process the selected invoices
              </p>
            </div> :

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {operations.map((operation) =>
            <Button
              key={operation.type}
              variant={operation.variant}
              size="sm"
              onClick={() => handleOperation(operation)}
              className="flex flex-col items-center space-y-1 h-auto py-3"
              disabled={processing}>

                  {operation.icon}
                  <span className="text-xs text-center">{operation.title}</span>
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
              Are you sure you want to {pendingOperation?.description.toLowerCase()} for {selectedIds.length} selected invoices? 
              {pendingOperation?.type === 'markPaid' &&
              <span className="block mt-2 text-orange-600 font-medium">
                  This will mark all selected invoices as paid with full payment amounts.
                </span>
              }
              {pendingOperation?.type === 'void' &&
              <span className="block mt-2 text-red-600 font-medium">
                  This action cannot be undone.
                </span>
              }
              {pendingOperation?.type === 'email' &&
              <span className="block mt-2 text-blue-600 font-medium">
                  Emails will only be sent to invoices with customer email addresses.
                </span>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingOperation && executeOperation(pendingOperation)}
              className={`${
              pendingOperation?.variant === 'destructive' ?
              'bg-red-600 hover:bg-red-700' :
              'bg-emerald-600 hover:bg-emerald-700'}`
              }>

              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>);

};

export default BulkInvoiceOperations;