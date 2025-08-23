
import React, { useState, useRef } from 'react';
import { Printer, Download, Package, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory } from '@/contexts/InventoryContext';

interface BarcodeGenerationProps {
  isOpen: boolean;
  onClose: () => void;
}

const BarcodeGeneration: React.FC<BarcodeGenerationProps> = ({ isOpen, onClose }) => {
  const { products } = useInventory();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [labelSettings, setLabelSettings] = useState({
    format: 'standard', // standard, small, large
    includePrice: true,
    includeName: true,
    includeCategory: false,
    copies: 1
  });

  const labelFormats = [
    { value: 'standard', label: 'Standard Label (2.25" x 1.25")', width: 162, height: 90 },
    { value: 'small', label: 'Small Label (1.5" x 1")', width: 108, height: 72 },
    { value: 'large', label: 'Large Label (3" x 2")', width: 216, height: 144 }
  ];

  const generateBarcode = (text: string, width = 2) => {
    // Simple Code 128 barcode pattern generation
    const code128 = {
      '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10010011000',
      '4': '10010001100', '5': '10001001100', '6': '10011001000', '7': '10011000100',
      '8': '10001100100', '9': '11001001000', 'A': '11001000100', 'B': '11000100100'
    };
    
    let pattern = '11010000100'; // Start code B
    
    for (const char of text) {
      if (char in code128) {
        pattern += code128[char as keyof typeof code128];
      } else {
        pattern += code128['0']; // Default pattern
      }
    }
    
    pattern += '11000111010'; // Stop pattern
    
    return pattern;
  };

  const drawBarcode = (canvas: HTMLCanvasElement, data: any, settings: any) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const format = labelFormats.find(f => f.value === settings.format) || labelFormats[0];
    canvas.width = format.width;
    canvas.height = format.height;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    let y = 10;

    // Draw product name
    if (settings.includeName && data.name) {
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      const text = data.name.length > 25 ? data.name.substring(0, 22) + '...' : data.name;
      ctx.fillText(text, canvas.width / 2, y + 8);
      y += 15;
    }

    // Draw category
    if (settings.includeCategory && data.category_name) {
      ctx.font = '6px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(data.category_name, canvas.width / 2, y + 6);
      y += 12;
    }

    // Draw barcode
    const barcodeText = data.barcode || data.sku;
    const pattern = generateBarcode(barcodeText);
    
    const barcodeWidth = canvas.width - 20;
    const barcodeHeight = 30;
    const barWidth = barcodeWidth / pattern.length;
    
    let x = 10;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        ctx.fillRect(x, y, Math.max(1, barWidth), barcodeHeight);
      }
      x += barWidth;
    }
    y += barcodeHeight + 5;

    // Draw barcode text
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(barcodeText, canvas.width / 2, y + 6);
    y += 10;

    // Draw SKU
    ctx.font = '7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`SKU: ${data.sku}`, canvas.width / 2, y + 7);
    y += 10;

    // Draw price
    if (settings.includePrice) {
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`৳${data.selling_price}`, canvas.width / 2, y + 9);
    }
  };

  const generatePDF = () => {
    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id!));
    
    if (selectedProductsData.length === 0) {
      alert('Please select at least one product');
      return;
    }

    // Create a temporary canvas for each label
    const canvas = document.createElement('canvas');
    const format = labelFormats.find(f => f.value === labelSettings.format) || labelFormats[0];
    
    // Simple PDF generation using canvas - in a real app, use jsPDF
    const pdf = {
      content: [] as string[],
      addPage: function(dataUrl: string) {
        this.content.push(dataUrl);
      },
      download: function(filename: string) {
        // Create a simple HTML page with all labels
        let html = '<html><head><title>Barcode Labels</title></head><body style="margin:0;padding:10px;">';
        
        this.content.forEach((dataUrl, index) => {
          html += `<img src="${dataUrl}" style="margin:5px;border:1px solid #ccc;" />`;
          if ((index + 1) % 4 === 0) html += '<br/>';
        });
        
        html += '</body></html>';
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    };

    selectedProductsData.forEach(product => {
      for (let copy = 0; copy < labelSettings.copies; copy++) {
        drawBarcode(canvas, product, labelSettings);
        const dataUrl = canvas.toDataURL('image/png');
        pdf.addPage(dataUrl);
      }
    });

    pdf.download(`barcode_labels_${new Date().toISOString().split('T')[0]}.html`);
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllProducts = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id!));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Generate Barcode Labels
          </DialogTitle>
          <DialogDescription>
            Create printable barcode labels for your products
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column: Settings */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Label Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Label Format</Label>
                  <Select 
                    value={labelSettings.format}
                    onValueChange={(value) => setLabelSettings({ ...labelSettings, format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {labelFormats.map(format => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-name"
                      checked={labelSettings.includeName}
                      onCheckedChange={(checked) => 
                        setLabelSettings({ ...labelSettings, includeName: checked as boolean })
                      }
                    />
                    <Label htmlFor="include-name">Include Product Name</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-price"
                      checked={labelSettings.includePrice}
                      onCheckedChange={(checked) => 
                        setLabelSettings({ ...labelSettings, includePrice: checked as boolean })
                      }
                    />
                    <Label htmlFor="include-price">Include Price</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-category"
                      checked={labelSettings.includeCategory}
                      onCheckedChange={(checked) => 
                        setLabelSettings({ ...labelSettings, includeCategory: checked as boolean })
                      }
                    />
                    <Label htmlFor="include-category">Include Category</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="copies">Copies per Product</Label>
                  <Input
                    id="copies"
                    type="number"
                    min="1"
                    max="10"
                    value={labelSettings.copies}
                    onChange={(e) => 
                      setLabelSettings({ ...labelSettings, copies: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Label Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <canvas
                    ref={canvasRef}
                    className="border border-gray-300 max-w-full h-auto"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (products.length > 0 && canvasRef.current) {
                        drawBarcode(canvasRef.current, products[0], labelSettings);
                      }
                    }}
                  >
                    Update Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Product Selection */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Select Products</CardTitle>
                  <Button variant="outline" size="sm" onClick={selectAllProducts}>
                    {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <CardDescription>
                  {selectedProducts.length} of {products.length} products selected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {products.map(product => (
                    <div
                      key={product.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProducts.includes(product.id!) 
                          ? 'border-primary bg-primary/10' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleProductSelection(product.id!)}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id!)}
                        onChange={() => toggleProductSelection(product.id!)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku} • ৳{product.selling_price}
                        </p>
                      </div>
                    </div>
                  ))}

                  {products.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No products available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={generatePDF}
                disabled={selectedProducts.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Labels
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeGeneration;
