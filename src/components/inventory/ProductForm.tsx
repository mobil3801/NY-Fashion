
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
import { FormField } from '@/components/ui/form-field';
import { useInventory } from '@/contexts/InventoryContext';
import { useDropzone } from 'react-dropzone';
import { toast } from '@/hooks/use-toast';
import ImageUploadProgress from './ImageUploadProgress';
import ImageGallery from './ImageGallery';
import EnhancedFileUpload from '@/components/common/EnhancedFileUpload';

interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  alt_text: string;
  sort_order: number;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface ProductFormProps {
  product?: any;
  onClose: () => void;
  onSave: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSave }) => {
  const { categories, saveProduct } = useInventory();
  const [loading, setLoading] = useState(false);
  const [hasVariants, setHasVariants] = useState(product?.has_variants || false);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  // Load existing images when editing product
  useEffect(() => {
    if (product?.id) {
      loadProductImages(product.id);
    }
  }, [product?.id]);

  const loadProductImages = async (productId: number) => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'getProductImages',
        param: [productId]
      });

      if (error) {
        throw new Error(error);
      }

      setProductImages(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load product images",
        variant: "destructive"
      });
    }
  };

  const validateFiles = (files: File[]): {valid: File[];invalid: {file: File;error: string;}[];} => {
    const valid: File[] = [];
    const invalid: {file: File;error: string;}[] = [];

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const maxImages = 10;

    // Check total image count
    if (productImages.length + files.length > maxImages) {
      files.forEach((file) => {
        invalid.push({ file, error: `Maximum ${maxImages} images allowed per product` });
      });
      return { valid, invalid };
    }

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        invalid.push({ file, error: 'Only JPG, PNG, and WebP formats are allowed' });
      } else if (file.size > maxFileSize) {
        invalid.push({ file, error: 'File size must be less than 5MB' });
      } else {
        valid.push(file);
      }
    });

    return { valid, invalid };
  };

  const simulateProgress = (uploadId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }

      setUploadProgress((prev) =>
      prev.map((item) =>
      item.id === uploadId ?
      { ...item, progress: Math.min(progress, 100) } :
      item
      )
      );
    }, 200);

    return interval;
  };

  const onDrop = React.useCallback(async (uploadedFiles: any[]) => {
    if (!product?.id && !product) {
      toast({
        title: "Error",
        description: "Please save the product first before uploading images",
        variant: "destructive"
      });
      return;
    }

    try {
      const productId = product?.id || (await saveCurrentProduct());
      if (!productId) {
        throw new Error('Failed to get product ID');
      }

      const { data, error } = await window.ezsite.apis.run({
        path: 'uploadProductImages',
        param: [productId, uploadedFiles.map((file) => ({
          file: file.originalName,
          fileId: file.fileId,
          url: file.url,
          size: file.size,
          type: file.type,
          altText: `${product?.name || 'Product'} image`
        }))]
      });

      if (error) {
        throw new Error(error);
      }

      // Refresh product images
      await loadProductImages(productId);

      toast({
        title: "Success",
        description: data.message || `Successfully processed ${uploadedFiles.length} image(s)`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to process uploaded images",
        variant: "destructive"
      });
    }
  }, [product, productImages.length]);

  const saveCurrentProduct = async (): Promise<number | null> => {
    try {
      const formData = watch();
      const productData = {
        ...formData,
        has_variants: hasVariants,
        variants: hasVariants ? formData.variants : []
      };

      await saveProduct(productData);
      return product?.id || null; // This would need to be updated to return the new product ID
    } catch (error) {
      console.error('Error saving product:', error);
      return null;
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      const result = await window.ezsite.apis.run({
        path: 'deleteProductImage',
        param: [imageId]
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Refresh product images
      await loadProductImages();

      toast({
        title: "Success",
        description: result.data.message
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete image",
        variant: "destructive"
      });
    }
  };

  const handleReorderImages = async (newOrder: ProductImage[]) => {
    try {
      if (!product?.id) {
        throw new Error('Product ID is required');
      }

      const imageOrders = newOrder.map((image, index) => ({
        imageId: image.id,
        sortOrder: index
      }));

      const { data, error } = await window.ezsite.apis.run({
        path: 'reorderProductImages',
        param: [product.id, imageOrders]
      });

      if (error) {
        throw new Error(error);
      }

      // Update local state
      setProductImages(newOrder);

      toast({
        title: "Success",
        description: data.message || "Image order updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder images",
        variant: "destructive"
      });
    }
  };

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
            <FormField
              label="Product Name"
              error={errors.name?.message}
              required
              description="Enter the product name as it will appear to customers">

              <Input
                {...register('name', { required: 'Product name is required' })}
                placeholder="e.g., Cotton Saree"
                className="focus-visible-aa" />

            </FormField>

            {/* Bengali name field removed - English only */}
          </div>

          <FormField
            label="Description"
            description="Provide a detailed description of the product for customers">

            <Textarea
              {...register('description')}
              placeholder="Detailed product description..."
              rows={3}
              className="focus-visible-aa" />

          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Category"
              error={errors.category_id?.message}
              required
              description="Choose the appropriate product category">

              <Select onValueChange={(value) => setValue('category_id', parseInt(value))}>
                <SelectTrigger className="focus-visible-aa">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Fashion categories for women's clothing store */}
                  <SelectItem value="1">Saree</SelectItem>
                  <SelectItem value="2">Salwar Kameez/Three‑Piece</SelectItem>
                  <SelectItem value="3">Kurti/Tunic</SelectItem>
                  <SelectItem value="4">Lehenga/Bridal</SelectItem>
                  <SelectItem value="5">Abaya</SelectItem>
                  <SelectItem value="6">Hijab/Scarf</SelectItem>
                  <SelectItem value="7">Orna/Dupatta</SelectItem>
                  <SelectItem value="8">Blouse</SelectItem>
                  <SelectItem value="9">Petticoat</SelectItem>
                  <SelectItem value="10">Palazzo/Pant</SelectItem>
                  <SelectItem value="11">Skirt</SelectItem>
                  <SelectItem value="12">Shawl/Stole</SelectItem>
                  <SelectItem value="13">Winterwear</SelectItem>
                  <SelectItem value="14">Nightwear</SelectItem>
                  <SelectItem value="15">Maternity</SelectItem>
                  <SelectItem value="16">Kids (Girls) ethnic</SelectItem>
                  <SelectItem value="17">Accessories</SelectItem>
                  <SelectItem value="18">Tailoring</SelectItem>
                  
                  {/* Include any existing database categories if available */}
                  {categories && categories.length > 0 && categories.map((category) =>
                  <SelectItem key={`db-${category.id}`} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Brand"
              description="Enter the brand name (optional)">

              <Input
                {...register('brand')}
                placeholder="Brand name"
                className="focus-visible-aa" />

            </FormField>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enhanced Image Upload */}
            {product?.id ?
            <EnhancedFileUpload
              onUploadComplete={handleImageUpload}
              uploadType="product_image"
              entityId={product.id}
              maxFiles={10}
              maxSize={5 * 1024 * 1024}
              title="Upload Product Images"
              description="Drag & drop product images here, or click to select (PNG, JPG, WebP up to 5MB each)" /> :




            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Save the product first to upload images</p>
                  </div>
                </CardContent>
              </Card>
            }

            {/* Image Gallery */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Product Images ({productImages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGallery
                  images={productImages}
                  onDeleteImage={handleDeleteImage}
                  onReorderImages={handleReorderImages}
                  productId={product?.id} />



              </CardContent>
            </Card>
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