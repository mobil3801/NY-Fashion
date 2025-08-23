
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { WifiOff, CloudOff, RefreshCw, AlertTriangle, CheckCircle, Eye, Printer, Mail, Edit, Upload, Download } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { networkAPI } from '@/lib/network/api-wrapper';
import { ApiError, ERROR_CODES } from '@/lib/errors';
import { format } from 'date-fns';

interface InvoiceOperation {
  id: string;
  type: 'status_update' | 'payment_record' | 'email_send' | 'print_request';
  invoiceId: string;
  invoiceNumber: string;
  payload: any;
  timestamp: number;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'failed';
  customerName?: string;
  totalAmount?: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  total_amount: number;
  paid_amount?: number;
  status: 'pending' | 'paid' | 'partial' | 'voided' | 'overdue';
  created_at: string;
  due_date?: string;
  payment_method?: string;
}

interface StatusUpdateData {
  newStatus: 'pending' | 'paid' | 'partial' | 'voided';
  paymentAmount?: number;
  paymentMethod?: string;
  notes?: string;
}

export function EnhancedInvoiceOperations() {
  const { online, retryNow } = useNetwork();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedOperations, setQueuedOperations] = useState<InvoiceOperation[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState<StatusUpdateData>({
    newStatus: 'paid'
  });
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);

  // Load queued operations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('queued-invoice-operations');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQueuedOperations(parsed.map((op: any) => ({
          ...op,
          status: op.status || 'pending'
        })));
      } catch (error) {
        console.warn('Failed to load queued operations:', error);
        localStorage.removeItem('queued-invoice-operations');
      }
    }
  }, []);

  // Save queued operations to localStorage
  const saveQueuedOperations = useCallback((operations: InvoiceOperation[]) => {
    setQueuedOperations(operations);
    localStorage.setItem('queued-invoice-operations', JSON.stringify(operations));
  }, []);

  // Load invoices
  useEffect(() => {
    loadInvoices();
  }, []);

  // Process queued operations when coming online
  useEffect(() => {
    if (online && queuedOperations.length > 0 && !isSyncing) {
      processQueuedOperations();
    }
  }, [online, queuedOperations.length]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const { data, error } = await networkAPI.readWithRetry(
        () => window.ezsite.apis.tablePage(36856, {
          PageNo: 1,
          PageSize: 50,
          OrderByField: 'created_at',
          IsAsc: false,
          Filters: []
        })
      );

      if (error) throw error;

      setInvoices(data?.List || []);
    } catch (error) {
      console.error('Error loading invoices:', error);

      if (error instanceof ApiError && error.code !== ERROR_CODES.NETWORK_OFFLINE) {
        toast({
          title: "Error",
          description: "Failed to load invoices",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const generateIdempotencyKey = () => {
    return `invoice-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const executeStatusUpdate = async (invoiceId: string, operation: StatusUpdateData, idempotencyKey: string) => {
    const updateData: any = {
      ID: parseInt(invoiceId),
      status: operation.newStatus
    };

    if (operation.newStatus === 'paid' && operation.paymentAmount) {
      updateData.paid_amount = operation.paymentAmount;
      updateData.payment_date = new Date().toISOString();
      updateData.payment_method = operation.paymentMethod || 'cash';
    }

    if (operation.notes) {
      updateData.notes = operation.notes;
    }

    const { error } = await window.ezsite.apis.tableUpdate(36856, updateData);
    if (error) throw new Error(error);
  };

  const executeEmailSend = async (invoiceId: string, emailData: any, idempotencyKey: string) => {
    // In a real implementation, this would call an email service
    // For now, we'll simulate it
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Email sent for invoice:', invoiceId, emailData);
  };

  const executePrintRequest = async (invoiceId: string, printData: any, idempotencyKey: string) => {
    // In a real implementation, this would send to printer service
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('Print requested for invoice:', invoiceId, printData);
  };

  const processQueuedOperations = async () => {
    if (!online || queuedOperations.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setLastSyncAttempt(Date.now());

    const operationsToProcess = queuedOperations.filter((op) => op.status === 'pending');
    let processedCount = 0;
    let failedCount = 0;

    // Update all pending operations to syncing status
    const updatedOperations = queuedOperations.map((op) =>
    op.status === 'pending' ? { ...op, status: 'syncing' as const } : op
    );
    saveQueuedOperations(updatedOperations);

    for (const operation of operationsToProcess) {
      try {
        switch (operation.type) {
          case 'status_update':
            await executeStatusUpdate(operation.invoiceId, operation.payload, operation.idempotencyKey);
            break;
          case 'email_send':
            await executeEmailSend(operation.invoiceId, operation.payload, operation.idempotencyKey);
            break;
          case 'print_request':
            await executePrintRequest(operation.invoiceId, operation.payload, operation.idempotencyKey);
            break;
          default:
            console.warn('Unknown operation type:', operation.type);
            continue;
        }

        // Remove successfully processed operation
        const remainingOperations = queuedOperations.filter((op) => op.id !== operation.id);
        saveQueuedOperations(remainingOperations);
        processedCount++;
      } catch (error) {
        console.error('Failed to process queued operation:', error);

        // Mark as failed
        const failedOperations = queuedOperations.map((op) =>
        op.id === operation.id ?
        { ...op, status: 'failed' as const } :
        op
        );
        saveQueuedOperations(failedOperations);
        failedCount++;
      }
    }

    setIsSyncing(false);

    if (processedCount > 0) {
      toast({
        title: "Sync Complete",
        description: `${processedCount} offline operation(s) synced successfully`,
        variant: "default"
      });

      // Reload invoices to show updated data
      await loadInvoices();
    }

    if (failedCount > 0) {
      toast({
        title: "Sync Issues",
        description: `${failedCount} operation(s) failed to sync. Will retry later.`,
        variant: "destructive"
      });
    }
  };

  const handleStatusUpdate = async (invoice: Invoice, newStatus: StatusUpdateData) => {
    const idempotencyKey = generateIdempotencyKey();

    const operation: InvoiceOperation = {
      id: crypto.randomUUID(),
      type: 'status_update',
      invoiceId: invoice.id.toString(),
      invoiceNumber: invoice.invoice_number,
      payload: newStatus,
      timestamp: Date.now(),
      idempotencyKey,
      status: 'pending',
      customerName: invoice.customer_name,
      totalAmount: invoice.total_amount
    };

    try {
      if (online) {
        await networkAPI.updateWithOfflineSupport(
          () => executeStatusUpdate(invoice.id.toString(), newStatus, idempotencyKey),
          'Invoice status'
        );

        // Update local state
        setInvoices((prev) => prev.map((inv) =>
        inv.id === invoice.id ?
        { ...inv, status: newStatus.newStatus, paid_amount: newStatus.paymentAmount || inv.paid_amount } :
        inv
        ));
      } else {
        // Queue for offline processing
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);

        toast({
          title: "Saved Offline",
          description: "Status update saved offline – will sync when online",
          variant: "default"
        });
      }
    } catch (error) {
      if (error instanceof ApiError && (error.code === ERROR_CODES.QUEUED_OFFLINE || error.code === ERROR_CODES.NETWORK_OFFLINE)) {
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);
      }
    }

    setStatusUpdateDialog(false);
    setSelectedInvoice(null);
  };

  const handleEmailInvoice = async (invoice: Invoice) => {
    if (!invoice.customer_email) {
      toast({
        title: "No Email Address",
        description: "Customer email is not available",
        variant: "destructive"
      });
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    const operation: InvoiceOperation = {
      id: crypto.randomUUID(),
      type: 'email_send',
      invoiceId: invoice.id.toString(),
      invoiceNumber: invoice.invoice_number,
      payload: { email: invoice.customer_email, subject: `Invoice ${invoice.invoice_number}` },
      timestamp: Date.now(),
      idempotencyKey,
      status: 'pending',
      customerName: invoice.customer_name,
      totalAmount: invoice.total_amount
    };

    try {
      if (online) {
        await networkAPI.execute(
          () => executeEmailSend(invoice.id.toString(), operation.payload, idempotencyKey),
          { showSuccessToast: true, successMessage: 'Invoice email sent' }
        );
      } else {
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);

        toast({
          title: "Queued Offline",
          description: "Email will be sent when connection is restored",
          variant: "default"
        });
      }
    } catch (error) {
      if (error instanceof ApiError && (error.code === ERROR_CODES.QUEUED_OFFLINE || error.code === ERROR_CODES.NETWORK_OFFLINE)) {
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);
      }
    }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    const idempotencyKey = generateIdempotencyKey();
    const operation: InvoiceOperation = {
      id: crypto.randomUUID(),
      type: 'print_request',
      invoiceId: invoice.id.toString(),
      invoiceNumber: invoice.invoice_number,
      payload: { format: '80mm', copies: 1 },
      timestamp: Date.now(),
      idempotencyKey,
      status: 'pending',
      customerName: invoice.customer_name,
      totalAmount: invoice.total_amount
    };

    try {
      if (online) {
        await networkAPI.execute(
          () => executePrintRequest(invoice.id.toString(), operation.payload, idempotencyKey),
          { showSuccessToast: true, successMessage: 'Invoice sent to printer' }
        );
      } else {
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);

        toast({
          title: "Queued Offline",
          description: "Print job will be processed when connection is restored",
          variant: "default"
        });
      }
    } catch (error) {
      if (error instanceof ApiError && (error.code === ERROR_CODES.QUEUED_OFFLINE || error.code === ERROR_CODES.NETWORK_OFFLINE)) {
        const updatedQueue = [...queuedOperations, operation];
        saveQueuedOperations(updatedQueue);
      }
    }
  };

  const handleRetryNow = async () => {
    setLastSyncAttempt(Date.now());
    await retryNow();

    if (queuedOperations.length > 0) {
      await processQueuedOperations();
    }

    // Also try to reload invoices
    await loadInvoices();
  };

  const handleRetryOperation = async (operationId: string) => {
    const operation = queuedOperations.find((op) => op.id === operationId);
    if (!operation) return;

    try {
      setIsSyncing(true);

      switch (operation.type) {
        case 'status_update':
          await executeStatusUpdate(operation.invoiceId, operation.payload, operation.idempotencyKey);
          break;
        case 'email_send':
          await executeEmailSend(operation.invoiceId, operation.payload, operation.idempotencyKey);
          break;
        case 'print_request':
          await executePrintRequest(operation.invoiceId, operation.payload, operation.idempotencyKey);
          break;
      }

      const remainingOperations = queuedOperations.filter((op) => op.id !== operationId);
      saveQueuedOperations(remainingOperations);

      toast({
        title: "Retry Successful",
        description: "Operation completed successfully",
        variant: "default"
      });

      await loadInvoices();
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Failed to complete operation. Will try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':return 'bg-green-100 text-green-800';
      case 'pending':return 'bg-yellow-100 text-yellow-800';
      case 'partial':return 'bg-blue-100 text-blue-800';
      case 'voided':return 'bg-red-100 text-red-800';
      case 'overdue':return 'bg-red-100 text-red-800';
      default:return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => `$${amount?.toFixed(2) || '0.00'}`;
  const formatDate = (dateString: string) => format(new Date(dateString), 'MMM dd, yyyy');

  const pendingOperations = queuedOperations.filter((op) => op.status === 'pending');
  const failedOperations = queuedOperations.filter((op) => op.status === 'failed');
  const syncingOperations = queuedOperations.filter((op) => op.status === 'syncing');

  if (loading) {
    return (
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle>Invoice Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) =>
            <div key={i} className="animate-pulse h-16 bg-gray-200 rounded" />
            )}
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Invoice Operations</span>
          <div className="flex items-center gap-2">
            {!online &&
            <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            }
            {pendingOperations.length > 0 &&
            <Badge variant="outline" className="flex items-center gap-1">
                <CloudOff className="h-3 w-3" />
                {pendingOperations.length} queued
              </Badge>
            }
            {syncingOperations.length > 0 &&
            <Badge variant="default" className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {syncingOperations.length} syncing
              </Badge>
            }
            {failedOperations.length > 0 &&
            <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {failedOperations.length} failed
              </Badge>
            }
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryNow}
              disabled={isSyncing}
              className="flex items-center gap-2">

              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Recent Invoices */}
          <div className="grid gap-4">
            {invoices.slice(0, 10).map((invoice) =>
            <div
              key={invoice.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium">{invoice.invoice_number}</span>
                      <Badge className={getStatusBadgeColor(invoice.status)}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {invoice.customer_name} • {formatCurrency(invoice.total_amount)} • {formatDate(invoice.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePrintInvoice(invoice)}
                    disabled={!online && pendingOperations.length >= 10}
                    aria-disabled={!online && pendingOperations.length >= 10}
                    className="flex items-center gap-2">

                      <Printer className="h-4 w-4" />
                      Print
                    </Button>

                    {invoice.customer_email &&
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEmailInvoice(invoice)}
                    disabled={!online && pendingOperations.length >= 10}
                    aria-disabled={!online && pendingOperations.length >= 10}
                    className="flex items-center gap-2">

                        <Mail className="h-4 w-4" />
                        Email
                      </Button>
                  }

                    <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setStatusUpdateData({
                        newStatus: invoice.status === 'pending' ? 'paid' : 'pending',
                        paymentAmount: invoice.total_amount
                      });
                      setStatusUpdateDialog(true);
                    }}
                    disabled={!online && pendingOperations.length >= 10}
                    aria-disabled={!online && pendingOperations.length >= 10}
                    className="flex items-center gap-2">

                      <Edit className="h-4 w-4" />
                      Update Status
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Messages */}
          {!online &&
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>You're offline. Invoice operations will be saved locally and synced when connection is restored.</span>
              </div>
            </div>
          }

          {queuedOperations.length > 0 &&
          <div className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CloudOff className="h-4 w-4 text-blue-700" />
                  <span className="text-blue-700 font-medium">
                    {queuedOperations.length} offline operation(s) waiting to sync
                  </span>
                </div>
                {online && !isSyncing &&
              <Button
                variant="outline"
                size="sm"
                onClick={processQueuedOperations}
                className="text-blue-700 border-blue-300">

                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
              }
              </div>

              {failedOperations.length > 0 &&
            <div className="space-y-1">
                  {failedOperations.slice(0, 3).map((operation) =>
              <div key={operation.id} className="flex items-center justify-between text-xs">
                      <span>{operation.type} for {operation.invoiceNumber}</span>
                      <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRetryOperation(operation.id)}
                  className="h-6 px-2 text-red-600">

                        Retry
                      </Button>
                    </div>
              )}
                  {failedOperations.length > 3 &&
              <div className="text-xs text-gray-600">
                      ...and {failedOperations.length - 3} more
                    </div>
              }
                </div>
            }
            </div>
          }

          {lastSyncAttempt &&
          <div className="text-xs text-gray-500 text-center">
              Last sync attempt: {new Date(lastSyncAttempt).toLocaleTimeString()}
            </div>
          }
        </div>
      </CardContent>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice &&
          <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium">{selectedInvoice.invoice_number}</div>
                <div className="text-sm text-gray-600">
                  {selectedInvoice.customer_name} • {formatCurrency(selectedInvoice.total_amount)}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="newStatus">New Status</Label>
                  <Select
                  value={statusUpdateData.newStatus}
                  onValueChange={(value: any) =>
                  setStatusUpdateData((prev) => ({ ...prev, newStatus: value }))
                  }>

                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partially Paid</SelectItem>
                      <SelectItem value="voided">Voided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {statusUpdateData.newStatus === 'paid' &&
              <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="paymentAmount">Payment Amount</Label>
                      <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={statusUpdateData.paymentAmount || ''}
                    onChange={(e) =>
                    setStatusUpdateData((prev) => ({
                      ...prev,
                      paymentAmount: parseFloat(e.target.value)
                    }))
                    }
                    placeholder="0.00" />

                    </div>
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method</Label>
                      <Select
                    value={statusUpdateData.paymentMethod || 'cash'}
                    onValueChange={(value) =>
                    setStatusUpdateData((prev) => ({ ...prev, paymentMethod: value }))
                    }>

                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
              }

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                  id="notes"
                  value={statusUpdateData.notes || ''}
                  onChange={(e) =>
                  setStatusUpdateData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Additional notes" />

                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                variant="outline"
                onClick={() => setStatusUpdateDialog(false)}>

                  Cancel
                </Button>
                <Button
                onClick={() => handleStatusUpdate(selectedInvoice, statusUpdateData)}
                disabled={!online && pendingOperations.length >= 10}
                aria-disabled={!online && pendingOperations.length >= 10}>

                  {online ? 'Update Status' : 'Save Offline'}
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </Card>);

}