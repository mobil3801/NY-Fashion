
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Image as ImageIcon, Eye, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import ImageGallery from './ImageGallery';

interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  alt_text: string;
  sort_order: number;
  file_size: number;
  mime_type: string;
  file_id?: string;
  uploaded_at: string;
}

interface EnhancedProductImageUploadProps {
  productId: number;
  onImagesChange?: (images: ProductImage[]) => void;
}

const EnhancedProductImageUpload: React.FC<EnhancedProductImageUploadProps> = ({
  productId,
  onImagesChange
}) => {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const loadImages = async () => {
    try {
      const query = `
        SELECT * FROM product_images 
        WHERE product_id = $1 
        ORDER BY sort_order ASC
      `;
      const result = await window.ezsite.db.query(query, [productId]);
      setImages(result || []);
      onImagesChange?.(result || []);
    } catch (error) {
      console.error('Failed to load product images:', error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (images.length + acceptedFiles.length > 10) {
      toast({
        title: "Upload Limit",
        description: `Cannot upload ${acceptedFiles.length} images. Maximum 10 images per product allowed.`,
        variant: "destructive"
      });
      return;
    }

    setPendingFiles(acceptedFiles);
    await uploadImages(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    multiple: true,
    maxSize: 5 * 1024 * 1024, // 5MB
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

  const uploadImages = async (files: File[]) => {
    if (!files.length) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create upload session
      const sessionResult = await window.ezsite.apis.run({
        path: 'createUploadSession',
        param: [files.length, 'product_image', productId]
      });

      if (sessionResult.error) {
        throw new Error(sessionResult.error);
      }

      const sessionId = sessionResult.data.sessionId;
      let completedCount = 0;

      // Upload files with progress tracking
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          // Update progress
          setUploadProgress(((i + 0.5) / files.length) * 100);

          // Upload file
          const uploadResult = await window.ezsite.apis.upload({
            filename: `product_${productId}_${Date.now()}_${i}.${file.name.split('.').pop()}`,
            file: file
          });

          if (uploadResult.error) {
            throw new Error(uploadResult.error);
          }

          const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
          if (urlResult.error) {
            throw new Error(urlResult.error);
          }

          // Save to database
          const insertQuery = `
            INSERT INTO product_images (
              product_id, image_url, alt_text, sort_order, file_size, mime_type, file_id, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, image_url, alt_text, sort_order, file_size, mime_type, file_id, uploaded_at
          `;

          const insertResult = await window.ezsite.db.query(insertQuery, [
            productId,
            urlResult.data,
            `Product image ${images.length + i + 1}`,
            images.length + i,
            file.size,
            file.type,
            uploadResult.data
          ]);

          completedCount++;
          setUploadProgress(((i + 1) / files.length) * 100);

          // Update session
          await window.ezsite.apis.run({
            path: 'updateUploadProgress',
            param: [sessionId, completedCount, 0]
          });

        } catch (error: any) {
          console.error(`Failed to upload file ${file.name}:`, error);
          
          // Update session with failure
          await window.ezsite.apis.run({
            path: 'updateUploadProgress',
            param: [sessionId, completedCount, files.length - completedCount]
          });
        }
      }

      // Refresh images
      await loadImages();

      if (completedCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${completedCount} image(s) uploaded successfully`,
          variant: completedCount === files.length ? "default" : "destructive"
        });
      }

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload images",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setPendingFiles([]);
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

      await loadImages();
      
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
      const result = await window.ezsite.apis.run({
        path: 'reorderProductImages',
        param: [productId, newOrder]
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImages(newOrder);
      onImagesChange?.(newOrder);
      
      toast({
        title: "Success",
        description: result.data.message
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder images",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (productId) {
      loadImages();
    }
  }, [productId]);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Product Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600">Drop the images here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop product images here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  PNG, JPG, WebP up to 5MB each (max {10 - images.length} more images)
                </p>
              </div>
            )}
          </div>

          {uploading && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading images...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <div className="text-xs text-gray-500">
                Processing {pendingFiles.length} file(s)
              </div>
            </div>
          )}

          {images.length >= 10 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Maximum of 10 images per product reached. Delete some images to upload new ones.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Image Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Product Images ({images.length}/10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageGallery
            images={images}
            onDeleteImage={handleDeleteImage}
            onReorderImages={handleReorderImages}
            productId={productId}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedProductImageUpload;
