
import React, { useState, useCallback } from 'react';
import { DollarSign, CreditCard, Upload, Calculator, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePOS } from '@/contexts/POSContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethod, PaymentDetails, Invoice } from '@/types/pos';
import { useDropzone } from 'react-dropzone';

const PaymentComponent: React.FC = () => {
  const { state, setPaymentMethod, clearCart, getCartTotal } = usePOS();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalAmount = getCartTotal();
  const changeAmount = selectedPaymentMethod?.type === 'cash' ? Math.max(0, amountPaid - totalAmount) : 0;

  const paymentMethods: PaymentMethod[] = [
  { type: 'cash', name: 'Cash' },
  { type: 'external_device', name: 'Credit Card (External Device)' },
  { type: 'external_device', name: 'Debit Card (External Device)' },
  { type: 'external_device', name: 'Mobile Payment (External Device)' },
  { type: 'external_device', name: 'Gift Card (External Device)' }];


  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setProofFile(acceptedFiles[0]);
      toast({
        title: 'File Uploaded',
        description: `${acceptedFiles[0].name} uploaded successfully`
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPaymentMethod(method);

    // For external devices, set amount paid to exact total
    if (method.type === 'external_device') {
      setAmountPaid(totalAmount);
    } else {
      setAmountPaid(0);
    }
  };

  const validatePayment = (): string | null => {
    if (!selectedPaymentMethod) {
      return 'Please select a payment method';
    }

    if (selectedPaymentMethod.type === 'cash') {
      if (amountPaid < totalAmount) {
        return 'Cash amount must be at least the total amount';
      }
    } else {
      // External device payment
      if (!paymentReference) {
        return 'Payment reference is required for external device payments';
      }
      if (amountPaid !== totalAmount) {
        return 'Payment amount must equal the total amount';
      }
    }

    if (state.cart.length === 0) {
      return 'Cart is empty';
    }

    return null;
  };

  const generateInvoice = async (): Promise<Invoice> => {
    const { data: invoiceNumber } = await window.ezsite.apis.run({
      path: 'generateInvoiceNumber',
      param: []
    });

    const paymentDetails: PaymentDetails = {
      amountPaid,
      changeGiven: selectedPaymentMethod?.type === 'cash' ? changeAmount : undefined,
      proofImageUrl: proofFile ? URL.createObjectURL(proofFile) : undefined,
      referenceNumber: paymentReference || undefined
    };

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      customerId: state.customer?.id,
      customer: state.customer,
      items: [...state.cart],
      subtotal: state.cart.reduce((sum, item) => sum + item.subtotal, 0),
      orderDiscount: state.orderDiscount,
      orderDiscountType: state.orderDiscountType,
      taxAmount: 0, // Will be calculated
      totalAmount: totalAmount,
      paymentMethod: selectedPaymentMethod!,
      paymentDetails,
      cashierId: user?.id || '',
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    return invoice;
  };

  const handleProcessPayment = async () => {
    const validationError = validatePayment();
    if (validationError) {
      toast({
        title: 'Payment Error',
        description: validationError,
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const invoice = await generateInvoice();

      // TODO: Save invoice to database
      // TODO: Update stock levels
      // TODO: Process stock movements

      // Show success and print options
      setShowPaymentDialog(true);

      toast({
        title: 'Payment Processed',
        description: `Invoice ${invoice.invoiceNumber} created successfully`
      });

      // Clear cart for next transaction
      clearCart();
      setSelectedPaymentMethod(null);
      setAmountPaid(0);
      setPaymentReference('');
      setProofFile(null);

    } catch (error) {
      toast({
        title: 'Payment Error',
        description: 'Failed to process payment',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = (format: 'a4' | '80mm') => {
    // TODO: Implement PDF generation and printing
    toast({
      title: 'Printing',
      description: `Printing ${format.toUpperCase()} receipt...`
    });
  };

  if (state.cart.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Add items to cart to process payment</p>
        </CardContent>
      </Card>);

  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Total Amount */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-3xl font-bold text-blue-600">${totalAmount.toFixed(2)}</p>
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Payment Method</label>
            <div className="grid grid-cols-1 gap-2">
              {paymentMethods.map((method, index) =>
              <Button
                key={index}
                variant={selectedPaymentMethod?.name === method.name ? 'default' : 'outline'}
                onClick={() => handlePaymentMethodSelect(method)}
                className="justify-start">

                  {method.type === 'cash' ?
                <DollarSign className="h-4 w-4 mr-2" /> :

                <CreditCard className="h-4 w-4 mr-2" />
                }
                  {method.name}
                </Button>
              )}
            </div>
          </div>

          {selectedPaymentMethod &&
          <>
              {/* Cash Payment Details */}
              {selectedPaymentMethod.type === 'cash' &&
            <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Amount Received</label>
                    <Input
                  type="number"
                  step="0.01"
                  min={totalAmount}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  placeholder="0.00" />

                  </div>
                  
                  {amountPaid >= totalAmount &&
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Change:</span>
                        <span className="text-xl font-bold text-green-600">
                          ${changeAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
              }
                </div>
            }

              {/* External Device Payment Details */}
              {selectedPaymentMethod.type === 'external_device' &&
            <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Payment Amount</label>
                    <Input
                  type="number"
                  step="0.01"
                  value={totalAmount.toFixed(2)}
                  readOnly
                  className="bg-gray-50" />

                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Reference Number</label>
                    <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction reference from device" />

                  </div>

                  {/* Proof Upload */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Payment Proof (Optional)
                    </label>
                    <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`
                  }>

                      <input {...getInputProps()} />
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      {proofFile ?
                  <div>
                          <p className="font-medium">{proofFile.name}</p>
                          <p className="text-sm text-gray-500">File uploaded successfully</p>
                        </div> :

                  <div>
                          <p>Drag & drop receipt image here</p>
                          <p className="text-sm text-gray-500">or click to browse</p>
                        </div>
                  }
                    </div>
                  </div>
                </div>
            }

              {/* Process Payment Button */}
              <Separator />
              <Button
              onClick={handleProcessPayment}
              disabled={isProcessing || !validatePayment() === null}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg">

                {isProcessing ? 'Processing...' : `Process Payment - $${totalAmount.toFixed(2)}`}
              </Button>
            </>
          }
        </CardContent>
      </Card>

      {/* Payment Success Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">Payment Successful!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 font-semibold">Transaction Completed</p>
              <p className="text-2xl font-bold text-green-600">${totalAmount.toFixed(2)}</p>
              {changeAmount > 0 &&
              <p className="text-lg">Change: ${changeAmount.toFixed(2)}</p>
              }
            </div>
            
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => handlePrintReceipt('80mm')}
                variant="outline"
                className="flex-1">

                <FileText className="h-4 w-4 mr-2" />
                Print Receipt (80mm)
              </Button>
              <Button
                onClick={() => handlePrintReceipt('a4')}
                variant="outline"
                className="flex-1">

                <FileText className="h-4 w-4 mr-2" />
                Print Invoice (A4)
              </Button>
            </div>
            
            <Button
              onClick={() => setShowPaymentDialog(false)}
              className="w-full">

              New Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>);

};

export default PaymentComponent;