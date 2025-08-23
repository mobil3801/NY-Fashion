
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Printer, Mail, Undo2, Download, CheckCircle, Clock, 
  XCircle, AlertCircle, User, Calendar, CreditCard, FileText,
  Phone, MapPin
} from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceDetailModalProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  onEmail: () => void;
  onReturn: () => void;
  canManage: boolean;
  canProcessReturns: boolean;
}

interface InvoiceItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  sku?: string;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  open,
  onOpenChange,
  onPrint,
  onEmail,
  onReturn,
  canManage,
  canProcessReturns
}) => {
  const { toast } = useToast();
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

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
          }
        ]
      });

      if (error) throw error;
      setInvoiceItems(data?.List || []);

    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      partial: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      voided: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} border-0 text-sm px-3 py-1`}>
        <Icon className="w-4 h-4 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => `$${amount?.toFixed(2) || '0.00'}`;
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'hh:mm a');
    } catch {
      return 'Invalid time';
    }
  };

  const isOverdue = () => {
    if (invoice.status !== 'pending' || !invoice.due_date) return false;
    return new Date(invoice.due_date) < new Date();
  };

  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const totalDiscount = invoiceItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const taxAmount = (invoice.total_amount || 0) - subtotal + totalDiscount;

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span>Invoice {invoice.invoice_number}</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              {getStatusBadge(invoice.status)}
              {isOverdue() && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  OVERDUE
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Customer Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-lg">
                    {invoice.customer_name || 'Walk-in Customer'}
                  </p>
                  {invoice.customer_email && (
                    <p className="text-gray-600 flex items-center mt-1">
                      <Mail className="w-4 h-4 mr-2" />
                      {invoice.customer_email}
                    </p>
                  )}
                  {invoice.customer_phone && (
                    <p className="text-gray-600 flex items-center mt-1">
                      <Phone className="w-4 h-4 mr-2" />
                      {invoice.customer_phone}
                    </p>
                  )}
                  {invoice.customer_address && (
                    <p className="text-gray-600 flex items-center mt-1">
                      <MapPin className="w-4 h-4 mr-2" />
                      {invoice.customer_address}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Invoice Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-600">Invoice Date:</p>
                    <p>{formatDate(invoice.created_at)}</p>
                    <p className="text-gray-500">{formatTime(invoice.created_at)}</p>
                  </div>
                  {invoice.due_date && (
                    <div>
                      <p className="font-medium text-gray-600">Due Date:</p>
                      <p className={isOverdue() ? 'text-red-600 font-medium' : ''}>
                        {formatDate(invoice.due_date)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-600">Payment Method:</p>
                    <Badge variant="outline" className="capitalize">
                      <CreditCard className="w-3 h-3 mr-1" />
                      {invoice.payment_method?.replace('_', ' ') || 'N/A'}
                    </Badge>
                  </div>
                  {invoice.employee_name && (
                    <div>
                      <p className="font-medium text-gray-600">Processed by:</p>
                      <p>{invoice.employee_name}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
              <CardDescription>
                Items purchased in this transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              {item.sku && (
                                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right">
                            {item.discount_amount > 0 ? (
                              <span className="text-red-600">-{formatCurrency(item.discount_amount)}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.line_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Total Discount:</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(invoice.total_amount)}</span>
                </div>
                {invoice.status === 'partial' && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Amount Paid:</span>
                      <span>{formatCurrency(invoice.paid_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Balance Due:</span>
                      <span>{formatCurrency((invoice.total_amount || 0) - (invoice.paid_amount || 0))}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onPrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
            {invoice.customer_email && (
              <Button variant="outline" onClick={onEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Email Invoice
              </Button>
            )}
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            {canProcessReturns && invoice.status === 'paid' && (
              <Button variant="outline" onClick={onReturn}>
                <Undo2 className="w-4 h-4 mr-2" />
                Process Return
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailModal;
