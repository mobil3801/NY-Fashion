
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Undo2, RefreshCcw, AlertCircle, CheckCircle } from 'lucide-react';

interface ReturnExchangeModalProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface InvoiceItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku?: string;
  returnedQuantity?: number;
}

interface ReturnItem {
  itemId: number;
  returnQuantity: number;
  reason: string;
  condition: string;
  refundAmount: number;
}

const ReturnExchangeModal: React.FC<ReturnExchangeModalProps> = ({
  invoice,
  open,
  onOpenChange,
  onComplete
}) => {
  const { toast } = useToast();
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      loadInvoiceItems();
    }
  }, [open, invoice]);

  const loadInvoiceItems = async () => {
    if (!invoice?.id) return;

    try {
      setLoading(true);

      const { data, error } = await window.ezsite.apis.tablePage(36857, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: true,
        Filters: [
        {
          name: 'sale_id',
          op: 'Equal',
          value: invoice.id
        }]

      });

      if (error) throw error;

      const items = data?.List || [];
      setInvoiceItems(items);

      // Initialize return items
      setReturnItems(items.map((item: InvoiceItem) => ({
        itemId: item.id,
        returnQuantity: 0,
        reason: '',
        condition: 'good',
        refundAmount: 0
      })));

    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnQuantityChange = (itemId: number, quantity: number) => {
    const item = invoiceItems.find((i) => i.id === itemId);
    if (!item) return;

    const maxQuantity = item.quantity - (item.returnedQuantity || 0);
    const validQuantity = Math.min(Math.max(0, quantity), maxQuantity);

    setReturnItems((prev) =>
    prev.map((returnItem) =>
    returnItem.itemId === itemId ?
    {
      ...returnItem,
      returnQuantity: validQuantity,
      refundAmount: validQuantity * item.unit_price
    } :
    returnItem
    )
    );
  };

  const handleReasonChange = (itemId: number, reason: string) => {
    setReturnItems((prev) =>
    prev.map((returnItem) =>
    returnItem.itemId === itemId ?
    { ...returnItem, reason } :
    returnItem
    )
    );
  };

  const handleConditionChange = (itemId: number, condition: string) => {
    setReturnItems((prev) =>
    prev.map((returnItem) =>
    returnItem.itemId === itemId ?
    { ...returnItem, condition } :
    returnItem
    )
    );
  };

  const processReturn = async () => {
    try {
      setProcessing(true);

      const itemsToReturn = returnItems.filter((item) => item.returnQuantity > 0);

      if (itemsToReturn.length === 0) {
        toast({
          title: "No Items Selected",
          description: "Please select at least one item to return",
          variant: "destructive"
        });
        return;
      }

      if (!returnReason) {
        toast({
          title: "Missing Information",
          description: "Please provide a return reason",
          variant: "destructive"
        });
        return;
      }

      if (returnType === 'return' && !refundMethod) {
        toast({
          title: "Missing Information",
          description: "Please select a refund method",
          variant: "destructive"
        });
        return;
      }

      // Calculate total refund amount
      const totalRefund = itemsToReturn.reduce((sum, item) => sum + item.refundAmount, 0);

      // Create return record
      const { data: returnData, error: returnError } = await window.ezsite.apis.tableCreate(36858, {
        sale_id: invoice.id,
        invoice_number: invoice.invoice_number,
        return_type: returnType,
        total_amount: totalRefund,
        refund_method: refundMethod,
        reason: returnReason,
        notes: notes,
        status: 'completed',
        processed_by: 'current_user', // You might want to get this from auth context
        created_at: new Date().toISOString()
      });

      if (returnError) throw returnError;

      const returnId = returnData;

      // Create return items
      for (const returnItem of itemsToReturn) {
        const invoiceItem = invoiceItems.find((item) => item.id === returnItem.itemId);
        if (!invoiceItem) continue;

        await window.ezsite.apis.tableCreate(36858, { // Assuming return items table exists
          return_id: returnId,
          product_name: invoiceItem.product_name,
          quantity: returnItem.returnQuantity,
          unit_price: invoiceItem.unit_price,
          total_amount: returnItem.refundAmount,
          condition: returnItem.condition,
          reason: returnItem.reason
        });

        // Update stock if returning to inventory
        if (returnItem.condition === 'good') {






































          // Here you would update inventory quantities
          // This would depend on your inventory system
        }} // Update original sale if fully returned
      const totalReturnQuantity = itemsToReturn.reduce((sum, item) => sum + item.returnQuantity, 0);const totalOriginalQuantity = invoiceItems.reduce((sum, item) => sum + item.quantity, 0);if (totalReturnQuantity === totalOriginalQuantity) {await window.ezsite.apis.tableUpdate(36856, { ID: invoice.id, status: 'refunded', refunded_amount: totalRefund, refunded_at: new Date().toISOString() });}toast({ title: "Return Processed", description: `Successfully processed ${returnType} for ${formatCurrency(totalRefund)}` });onComplete();} catch (error) {console.error('Error processing return:', error);toast({ title: "Process Failed", description: "Unable to process the return/exchange", variant: "destructive" });} finally {setProcessing(false);}};const formatCurrency = (amount: number) => `$${amount?.toFixed(2) || '0.00'}`;const returnReasons = ['Defective/Damaged', 'Wrong Size/Color',
  'Customer Changed Mind',
  'Not as Described',
  'Duplicate Order',
  'Quality Issues',
  'Other'];


  const refundMethods = [
  'Original Payment Method',
  'Cash',
  'Store Credit',
  'Gift Card',
  'Bank Transfer'];


  const itemConditions = [
  { value: 'good', label: 'Good - Can Resell' },
  { value: 'damaged', label: 'Damaged - Cannot Resell' },
  { value: 'opened', label: 'Opened - May Resell' },
  { value: 'defective', label: 'Defective - Return to Supplier' }];


  const totalRefundAmount = returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
  const selectedItemsCount = returnItems.filter((item) => item.returnQuantity > 0).length;

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Undo2 className="w-5 h-5 text-orange-600" />
            <span>Process Return/Exchange - Invoice {invoice.invoice_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Return Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Return Type</CardTitle>
              <CardDescription>Select the type of transaction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={returnType === 'return' ? 'default' : 'outline'}
                  onClick={() => setReturnType('return')}
                  className="h-20 flex flex-col">

                  <Undo2 className="w-6 h-6 mb-2" />
                  <span>Return for Refund</span>
                </Button>
                <Button
                  variant={returnType === 'exchange' ? 'default' : 'outline'}
                  onClick={() => setReturnType('exchange')}
                  className="h-20 flex flex-col">

                  <RefreshCcw className="w-6 h-6 mb-2" />
                  <span>Exchange</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Return Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Return Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="return-reason">Return Reason *</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnReasons.map((reason) =>
                      <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {returnType === 'return' &&
                <div>
                    <Label htmlFor="refund-method">Refund Method *</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select refund method" />
                      </SelectTrigger>
                      <SelectContent>
                        {refundMethods.map((method) =>
                      <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                }

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes about the return..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3} />

                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Return Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Items Selected:</span>
                    <Badge variant="secondary">{selectedItemsCount}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Return Type:</span>
                    <Badge variant="outline" className="capitalize">{returnType}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total {returnType === 'return' ? 'Refund' : 'Exchange'} Amount:</span>
                    <span className="text-emerald-600">{formatCurrency(totalRefundAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items to Return */}
          <Card>
            <CardHeader>
              <CardTitle>Select Items to Return</CardTitle>
              <CardDescription>Choose quantities and conditions for returned items</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ?
              <div className="text-center py-8">Loading items...</div> :

              <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Original Qty</TableHead>
                        <TableHead className="text-center">Return Qty</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Refund Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item) => {
                      const returnItem = returnItems.find((ri) => ri.itemId === item.id);
                      const maxReturnQty = item.quantity - (item.returnedQuantity || 0);

                      return (
                        <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.sku &&
                              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                              }
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-center">
                              <Input
                              type="number"
                              min="0"
                              max={maxReturnQty}
                              value={returnItem?.returnQuantity || 0}
                              onChange={(e) =>
                              handleReturnQuantityChange(item.id, parseInt(e.target.value) || 0)
                              }
                              className="w-20 text-center" />

                            </TableCell>
                            <TableCell>
                              <Select
                              value={returnItem?.condition || 'good'}
                              onValueChange={(value) => handleConditionChange(item.id, value)}
                              disabled={!returnItem?.returnQuantity}>

                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {itemConditions.map((condition) =>
                                <SelectItem key={condition.value} value={condition.value}>
                                      {condition.label}
                                    </SelectItem>
                                )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                              value={returnItem?.reason || ''}
                              onValueChange={(value) => handleReasonChange(item.id, value)}
                              disabled={!returnItem?.returnQuantity}>

                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                  {returnReasons.map((reason) =>
                                <SelectItem key={reason} value={reason}>
                                      {reason}
                                    </SelectItem>
                                )}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(returnItem?.refundAmount || 0)}
                            </TableCell>
                          </TableRow>);

                    })}
                    </TableBody>
                  </Table>
                </div>
              }
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>This action will create a return record and may update inventory levels</span>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={processReturn}
                disabled={processing || selectedItemsCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700">

                {processing ?
                <>Processing...</> :

                <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Process {returnType === 'return' ? 'Return' : 'Exchange'}
                  </>
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

};

export default ReturnExchangeModal;