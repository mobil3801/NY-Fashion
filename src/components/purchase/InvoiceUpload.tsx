
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePurchaseOrder } from '@/contexts/PurchaseOrderContext';
import { PurchaseOrder } from '@/types/purchase';
import { useLoadingState } from '@/hooks/use-loading-state';
import { toast } from '@/hooks/use-toast';

interface InvoiceUploadProps {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
}

interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
  fileId?: string;
}

const InvoiceUpload: React.FC<InvoiceUploadProps> = ({ purchaseOrder, onClose }) => {
  const { uploadInvoice } = usePurchaseOrder();
  const { loading, startLoading, stopLoading } = useLoadingState();
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: purchaseOrder.total_cost,
    currency: purchaseOrder.currency || 'USD'
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));
    
    setUploadProgress(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const errors = rejection.errors.map(e => e.message).join(', ');
        toast({
          title: "File Rejected",
          description: `${rejection.file.name}: ${errors}`,
          variant: "destructive"
        });
      });
    }
  });

  const removeFile = (index: number) => {
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'uploading':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const uploadFiles = async () => {
    if (uploadProgress.length === 0) return;

    startLoading();

    try {
      // Create upload session
      const sessionResult = await window.ezsite.apis.run({
        path: 'createUploadSession',
        param: [uploadProgress.length, 'invoice', purchaseOrder.id]
      });

      if (sessionResult.error) {
        throw new Error(sessionResult.error);
      }

      const sessionId = sessionResult.data.sessionId;
      let completedCount = 0;
      let failedCount = 0;

      // Upload files one by one
      for (let i = 0; i < uploadProgress.length; i++) {
        const fileProgress = uploadProgress[i];
        
        try {
          // Update status to uploading
          setUploadProgress(prev => prev.map((fp, index) => 
            index === i ? { ...fp, status: 'uploading', progress: 0 } : fp
          ));

          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => prev.map((fp, index) => 
              index === i ? { 
                ...fp, 
                progress: Math.min(fp.progress + Math.random() * 15, 90) 
              } : fp
            ));
          }, 300);

          // Upload file
          const uploadResult = await window.ezsite.apis.run({
            path: 'uploadInvoiceFile',
            param: [purchaseOrder.id, invoiceData, fileProgress.file]
          });

          clearInterval(progressInterval);

          if (uploadResult.error) {
            throw new Error(uploadResult.error);
          }

          // Update to completed
          setUploadProgress(prev => prev.map((fp, index) => 
            index === i ? { 
              ...fp, 
              status: 'completed', 
              progress: 100,
              url: uploadResult.data.invoice?.file_url,
              fileId: uploadResult.data.invoice?.id
            } : fp
          ));

          completedCount++;

        } catch (error: any) {
          // Update to error
          setUploadProgress(prev => prev.map((fp, index) => 
            index === i ? { 
              ...fp, 
              status: 'error', 
              error: error.message 
            } : fp
          ));

          failedCount++;
        }

        // Update session progress
        await window.ezsite.apis.run({
          path: 'updateUploadProgress',
          param: [sessionId, completedCount, failedCount]
        });
      }

      if (completedCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${completedCount} invoice(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
          variant: completedCount === uploadProgress.length ? "default" : "destructive"
        });

        // Auto-close if all uploads succeeded
        if (failedCount === 0) {
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      }

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload invoices",
        variant: "destructive"
      });
    } finally {
      stopLoading();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploadProgress.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please upload at least one file",
        variant: "destructive"
      });
      return;
    }

    if (!invoiceData.invoice_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Invoice number is required",
        variant: "destructive"
      });
      return;
    }

    await uploadFiles();
  };

  const overallProgress = uploadProgress.length > 0 ? 
    (uploadProgress.filter(fp => fp.status === 'completed').length / uploadProgress.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">PO Number</p>
              <p className="font-semibold">{purchaseOrder.po_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Supplier</p>
              <p className="font-semibold">{purchaseOrder.supplier_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">PO Total</p>
              <p className="font-semibold">{purchaseOrder.currency} {purchaseOrder.total_cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <Badge variant="outline">{purchaseOrder.status.toUpperCase()}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input
                  id="invoice_number"
                  value={invoiceData.invoice_number}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="Enter invoice number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Invoice Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={invoiceData.amount}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={invoiceData.invoice_date}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, invoice_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={invoiceData.due_date}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${loading ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600">Drop the files here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag & drop invoice files here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports: JPG, PNG, PDF, DOC, DOCX (up to 10MB each)
                  </p>
                </div>
              )}
            </div>

            {/* File list with progress */}
            {uploadProgress.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Files ({uploadProgress.length})</h4>
                  {!loading && uploadProgress.some(fp => fp.status === 'pending') && (
                    <Button size="sm" onClick={uploadFiles}>
                      Upload All
                    </Button>
                  )}
                </div>

                {uploadProgress.map((fileProgress, index) => (
                  <div 
                    key={index} 
                    className={`p-3 border rounded-lg ${getStatusColor(fileProgress.status)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        {getFileIcon(fileProgress.file)}
                        <span className="text-sm font-medium truncate">
                          {fileProgress.file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({(fileProgress.file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        {getStatusIcon(fileProgress.status)}
                      </div>
                      
                      {fileProgress.status === 'pending' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {fileProgress.status === 'uploading' && (
                      <Progress value={fileProgress.progress} className="h-2" />
                    )}

                    {fileProgress.status === 'error' && fileProgress.error && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {fileProgress.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {fileProgress.status === 'completed' && (
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          ✓ Uploaded successfully
                        </Badge>
                        {fileProgress.url && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(fileProgress.url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Overall progress */}
                {loading && uploadProgress.length > 0 && (
                  <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Overall Progress</span>
                      <span>
                        {uploadProgress.filter(fp => fp.status === 'completed').length} / {uploadProgress.length}
                      </span>
                    </div>
                    <Progress value={overallProgress} className="h-3" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || uploadProgress.length === 0 || !invoiceData.invoice_number.trim()}
          >
            {loading ? 'Uploading...' : 'Upload Invoices'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceUpload;
