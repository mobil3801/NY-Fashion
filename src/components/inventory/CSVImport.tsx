
import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useInventory } from '@/contexts/InventoryContext';
import { useDropzone } from 'react-dropzone';

interface CSVImportProps {
  isOpen: boolean;
  onClose: () => void;
}

const CSVImport: React.FC<CSVImportProps> = ({ isOpen, onClose }) => {
  const { importProductsFromCSV } = useInventory();
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim());
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const data = lines.slice(1).map((line, index) => {
      const values = line.split(',').map((v) => v.trim());
      const row: any = { row_number: index + 2 };

      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });

      return row;
    });

    setCsvData(data);
    setStep('preview');
  };

  const validateRow = (row: any) => {
    const errors = [];

    if (!row.name) errors.push('Product name is required');
    if (!row.sku) errors.push('SKU is required');
    if (!row.category_id && !row.category_name) errors.push('Category is required');
    if (row.cost_price && isNaN(parseFloat(row.cost_price))) errors.push('Invalid cost price');
    if (row.selling_price && isNaN(parseFloat(row.selling_price))) errors.push('Invalid selling price');

    return errors;
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');

    const results = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const errors = validateRow(row);

      setImportProgress((i + 1) / csvData.length * 100);

      if (errors.length === 0) {
        try {
          // Transform CSV data to product format
          const productData = {
            name: row.name,
            name_bn: row.name_bn || '',
            description: row.description || '',
            category_id: parseInt(row.category_id) || 1,
            brand: row.brand || '',
            sku: row.sku,
            barcode: row.barcode || '',
            cost_price: parseFloat(row.cost_price) || 0,
            selling_price: parseFloat(row.selling_price) || 0,
            msrp: parseFloat(row.msrp) || 0,
            min_stock_level: parseInt(row.min_stock_level) || 0,
            max_stock_level: parseInt(row.max_stock_level) || 100,
            unit: row.unit || 'pcs',
            weight: parseFloat(row.weight) || 0,
            dimensions: row.dimensions || '',
            tags: row.tags || '',
            has_variants: false
          };

          // TODO: Call actual import API
          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate API call

          results.push({
            row_number: row.row_number,
            product_name: row.name,
            status: 'success',
            message: 'Imported successfully'
          });
        } catch (error) {
          results.push({
            row_number: row.row_number,
            product_name: row.name,
            status: 'error',
            message: error instanceof Error ? error.message : 'Import failed'
          });
        }
      } else {
        results.push({
          row_number: row.row_number,
          product_name: row.name,
          status: 'error',
          message: errors.join(', ')
        });
      }
    }

    setImportResults(results);
    setImporting(false);
    setStep('results');
  };

  const downloadTemplate = () => {
    const template = `name,name_bn,description,category_id,brand,sku,barcode,cost_price,selling_price,msrp,min_stock_level,max_stock_level,unit,weight,dimensions,tags
Cotton Saree,কটন শাড়ি,Beautiful cotton saree,1,Local Brand,SAR001,,1500,2500,3000,5,50,pcs,0.5,Length: 6m,cotton saree formal
Silk Salwar Kameez,সিল্ক সালোয়ার কামিজ,Elegant silk three piece,2,Premium Brand,SK002,,2500,4000,4500,3,30,set,0.8,Set of 3 pieces,silk salwar formal`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'product_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetImport = () => {
    setCsvData([]);
    setImportResults([]);
    setImportProgress(0);
    setStep('upload');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Products from CSV
          </DialogTitle>
          <DialogDescription>
            Import multiple products at once using a CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Upload */}
          {step === 'upload' &&
          <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Step 1: Upload CSV File</h3>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ?
              'border-primary bg-primary/10' :
              'border-muted-foreground/25 hover:border-primary/50'}`
              }>

                <input {...getInputProps()} />
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ?
              <p>Drop the CSV file here ...</p> :

              <div>
                    <p className="text-lg mb-2">Drag & drop CSV file here, or click to select</p>
                    <p className="text-sm text-muted-foreground">
                      Only CSV files are accepted
                    </p>
                  </div>
              }
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-700">CSV Format Requirements</CardTitle>
                </CardHeader>
                <CardContent className="text-blue-600">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Required columns: name, sku, category_id</li>
                    <li>Optional columns: name_bn, description, brand, barcode, cost_price, selling_price, msrp</li>
                    <li>Stock columns: min_stock_level, max_stock_level, unit</li>
                    <li>Additional: weight, dimensions, tags</li>
                    <li>Use category_id (1=Saree, 2=Salwar Kameez, etc.) or download template</li>
                  </ul>
                </CardContent>
              </Card>
            </>
          }

          {/* Step Preview */}
          {step === 'preview' &&
          <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Step 2: Preview Data ({csvData.length} rows)</h3>
                <div className="space-x-2">
                  <Button variant="outline" onClick={resetImport}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Products
                  </Button>
                </div>
              </div>

              <div className="max-h-96 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 10).map((row, index) => {
                    const errors = validateRow(row);
                    return (
                      <TableRow key={index}>
                          <TableCell>{row.row_number}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="font-mono">{row.sku}</TableCell>
                          <TableCell>{row.category_id || row.category_name}</TableCell>
                          <TableCell>৳{row.selling_price}</TableCell>
                          <TableCell>
                            {errors.length === 0 ?
                          <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Valid
                              </Badge> :

                          <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errors.length} errors
                              </Badge>
                          }
                          </TableCell>
                        </TableRow>);

                  })}
                  </TableBody>
                </Table>
              </div>

              {csvData.length > 10 &&
            <p className="text-sm text-muted-foreground text-center">
                  Showing first 10 rows. {csvData.length - 10} more rows will be imported.
                </p>
            }
            </>
          }

          {/* Step Importing */}
          {step === 'importing' &&
          <div className="space-y-4">
              <h3 className="text-lg font-medium">Step 3: Importing Products...</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we import your products...
              </p>
            </div>
          }

          {/* Step Results */}
          {step === 'results' &&
          <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Import Results</h3>
                <Button onClick={resetImport}>
                  Import Another File
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-600">Successful</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {importResults.filter((r) => r.status === 'success').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-600">Failed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {importResults.filter((r) => r.status === 'error').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {importResults.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="max-h-64 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((result, index) =>
                  <TableRow key={index}>
                        <TableCell>{result.row_number}</TableCell>
                        <TableCell>{result.product_name}</TableCell>
                        <TableCell>
                          {result.status === 'success' ?
                      <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge> :

                      <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                      }
                        </TableCell>
                        <TableCell className="text-sm">{result.message}</TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          }
        </div>
      </DialogContent>
    </Dialog>);

};

export default CSVImport;