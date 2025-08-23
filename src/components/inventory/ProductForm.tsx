
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Minus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInventory } from '@/contexts/InventoryContext';
import { useDropzone } from 'react-dropzone';

interface ProductFormProps {
  product?: any;
  onClose: () => void;
  onSave: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSave }) => {
  const { categories, saveProduct } = useInventory();
  const [loading, setLoading] = useState(false);
  const [hasVariants, setHasVariants] = useState(product?.has_variants || false);

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      category_id: product?.category_id || '',
      brand: product?.brand || '',
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      cost_price: product?.cost_price || 0,
      selling_price: product?.selling_price || 0,
      msrp: product?.msrp || 0,
      min_stock_level: product?.min_stock_level || 0,
      max_stock_level: product?.max_stock_level || 100,
      unit: product?.unit || 'pcs',
      weight: product?.weight || '',
      dimensions: product?.dimensions || '',
      tags: product?.tags || '',
      variants: product?.variants || [
      {
        variant_name: 'Default',
        sku: '',
        barcode: '',
        size: '',
        color: '',
        material: '',
        cost_price: 0,
        selling_price: 0,
        msrp: 0,
        current_stock: 0
      }]

    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants'
  });

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    // TODO: Implement image upload to EasySite storage
    console.log('Files to upload:', acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true
  });

  const generateSKU = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `WW${timestamp}${random}`;
  };

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      const productData = {
        ...data,
        id: product?.id,
        has_variants: hasVariants,
        variants: hasVariants ? data.variants : []
      };

      await saveProduct(productData);
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setLoading(false);
    }
  };

  const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '36', '38', '40', '42', '44', '46'];
  const commonColors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Pink', 'Yellow', 'Purple', 'Orange', 'Maroon'];
  const commonMaterials = ['Cotton', 'Silk', 'Chiffon', 'Georgette', 'Crepe', 'Linen', 'Polyester', 'Rayon'];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Product name is required' })}
                placeholder="e.g., Cotton Saree" />

              {errors.name &&
              <p className="text-sm text-red-500">{errors.name.message}</p>
              }
            </div>

            {/* Bengali name field removed - English only */}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Detailed product description..."
              rows={3} />

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Category *</Label>
              <Select onValueChange={(value) => setValue('category_id', parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) =>
                  <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                {...register('brand')}
                placeholder="Brand name" />

            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <div className="flex gap-2">
                <Input
                  id="sku"
                  {...register('sku', { required: 'SKU is required' })}
                  placeholder="Product SKU" />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setValue('sku', generateSKU())}>

                  Generate
                </Button>
              </div>
              {errors.sku &&
              <p className="text-sm text-red-500">{errors.sku.message}</p>
              }
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                {...register('barcode')}
                placeholder="Barcode" />

            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select onValueChange={(value) => setValue('unit', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                  <SelectItem value="pair">Pair</SelectItem>
                  <SelectItem value="meter">Meter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                {...register('weight')}
                placeholder="0.50" />

            </div>

            <div className="space-y-2">
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                {...register('dimensions')}
                placeholder="Length x Width x Height" />

            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              {...register('tags')}
              placeholder="casual, formal, wedding, cotton (comma separated)" />

          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price ($) *</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                {...register('cost_price', { required: 'Cost price is required', min: 0 })}
                placeholder="0.00" />

              {errors.cost_price &&
              <p className="text-sm text-red-500">{errors.cost_price.message}</p>
              }
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price ($) *</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                {...register('selling_price', { required: 'Selling price is required', min: 0 })}
                placeholder="0.00" />

              {errors.selling_price &&
              <p className="text-sm text-red-500">{errors.selling_price.message}</p>
              }
            </div>

            <div className="space-y-2">
              <Label htmlFor="msrp">MSRP ($)</Label>
              <Input
                id="msrp"
                type="number"
                step="0.01"
                {...register('msrp', { min: 0 })}
                placeholder="0.00" />

            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
              <Input
                id="min_stock_level"
                type="number"
                {...register('min_stock_level', { min: 0 })}
                placeholder="0" />

            </div>

            <div className="space-y-2">
              <Label htmlFor="max_stock_level">Maximum Stock Level</Label>
              <Input
                id="max_stock_level"
                type="number"
                {...register('max_stock_level', { min: 0 })}
                placeholder="100" />

            </div>
          </div>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-medium">Product Variants</h3>
              <p className="text-sm text-muted-foreground">
                Enable variants for products with different sizes, colors, or materials
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="has-variants">Enable Variants</Label>
              <Switch
                id="has-variants"
                checked={hasVariants}
                onCheckedChange={setHasVariants} />

            </div>
          </div>

          {hasVariants &&
          <div className="space-y-4">
              <Button
              type="button"
              variant="outline"
              onClick={() => append({
                variant_name: '',
                sku: '',
                barcode: '',
                size: '',
                color: '',
                material: '',
                cost_price: 0,
                selling_price: 0,
                msrp: 0,
                current_stock: 0
              })}>

                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>

              {fields.map((field, index) =>
            <Card key={field.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Variant {index + 1}</CardTitle>
                      {fields.length > 1 &&
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}>

                          <X className="h-4 w-4" />
                        </Button>
                  }
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Variant Name</Label>
                        <Input
                      {...register(`variants.${index}.variant_name`)}
                      placeholder="e.g., Red Small" />

                      </div>

                      <div className="space-y-2">
                        <Label>SKU</Label>
                        <Input
                      {...register(`variants.${index}.sku`)}
                      placeholder="Variant SKU" />

                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Size</Label>
                        <Select onValueChange={(value) => setValue(`variants.${index}.size`, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {commonSizes.map((size) =>
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                        )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Color</Label>
                        <Select onValueChange={(value) => setValue(`variants.${index}.color`, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                          <SelectContent>
                            {commonColors.map((color) =>
                        <SelectItem key={color} value={color}>{color}</SelectItem>
                        )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Material</Label>
                        <Select onValueChange={(value) => setValue(`variants.${index}.material`, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {commonMaterials.map((material) =>
                        <SelectItem key={material} value={material}>{material}</SelectItem>
                        )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Cost Price ($)</Label>
                        <Input
                      type="number"
                      step="0.01"
                      {...register(`variants.${index}.cost_price`)}
                      placeholder="0.00" />

                      </div>

                      <div className="space-y-2">
                        <Label>Selling Price ($)</Label>
                        <Input
                      type="number"
                      step="0.01"
                      {...register(`variants.${index}.selling_price`)}
                      placeholder="0.00" />

                      </div>

                      <div className="space-y-2">
                        <Label>MSRP ($)</Label>
                        <Input
                      type="number"
                      step="0.01"
                      {...register(`variants.${index}.msrp`)}
                      placeholder="0.00" />

                      </div>

                      <div className="space-y-2">
                        <Label>Stock</Label>
                        <Input
                      type="number"
                      {...register(`variants.${index}.current_stock`)}
                      placeholder="0" />

                      </div>
                    </div>
                  </CardContent>
                </Card>
            )}
            </div>
          }
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Product Images</h3>
              <p className="text-sm text-muted-foreground">
                Upload high-quality images of your product. First image will be used as primary.
              </p>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ?
              'border-primary bg-primary/10' :
              'border-muted-foreground/25 hover:border-primary/50'}`
              }>

              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ?
              <p>Drop the images here ...</p> :

              <div>
                  <p className="text-lg mb-2">Drag & drop images here, or click to select</p>
                  <p className="text-sm text-muted-foreground">
                    Supports: JPG, PNG, WebP (Max 5MB each)
                  </p>
                </div>
              }
            </div>

            <div className="grid grid-cols-4 gap-4">
              {/* TODO: Display uploaded images */}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>);

};

export default ProductForm;