
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Eye, Star, GripVertical } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

interface ImageGalleryProps {
  images: ProductImage[];
  onDeleteImage: (imageId: number) => Promise<void>;
  onReorderImages: (newOrder: ProductImage[]) => Promise<void>;
  productId?: number;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  onDeleteImage, 
  onReorderImages,
  productId 
}) => {
  const [previewImage, setPreviewImage] = useState<ProductImage | null>(null);
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<ProductImage | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragStart = (e: React.DragEvent, image: ProductImage) => {
    setDraggedItem(image);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDraggedOverIndex(index);
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDraggedOverIndex(null);

    if (!draggedItem) return;

    const currentIndex = images.findIndex(img => img.id === draggedItem.id);
    if (currentIndex === -1 || currentIndex === dropIndex) return;

    // Create new order
    const reorderedImages = [...images];
    reorderedImages.splice(currentIndex, 1);
    reorderedImages.splice(dropIndex, 0, draggedItem);

    // Update sort_order values
    const updatedImages = reorderedImages.map((img, index) => ({
      ...img,
      sort_order: index
    }));

    try {
      await onReorderImages(updatedImages);
      toast({
        title: "Success",
        description: "Image order updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder images",
        variant: "destructive",
      });
    }

    setDraggedItem(null);
  };

  const handleDeleteImage = async () => {
    if (!deleteImageId) return;

    try {
      await onDeleteImage(deleteImageId);
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
    setDeleteImageId(null);
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No images uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <Card 
            key={image.id}
            className={`relative group cursor-move transition-all duration-200 ${
              draggedOverIndex === index ? 'ring-2 ring-primary' : ''
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, image)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            <CardContent className="p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                <img
                  src={image.image_url}
                  alt={image.alt_text}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                
                {/* Primary image badge */}
                {image.sort_order === 0 && (
                  <Badge className="absolute top-2 left-2 bg-yellow-500 text-white">
                    <Star className="h-3 w-3 mr-1" />
                    Primary
                  </Badge>
                )}

                {/* Drag handle */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-4 w-4 text-white drop-shadow-lg" />
                </div>

                {/* Action buttons overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewImage(image)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteImageId(image.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Image info */}
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground truncate">
                  {image.alt_text}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatFileSize(image.file_size)}</span>
                  <span>#{image.sort_order + 1}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.alt_text}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-lg">
                <img
                  src={previewImage.image_url}
                  alt={previewImage.alt_text}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">File size: </span>
                  {formatFileSize(previewImage.file_size)}
                </div>
                <div>
                  <span className="font-medium">Type: </span>
                  {previewImage.mime_type}
                </div>
                <div>
                  <span className="font-medium">Position: </span>
                  #{previewImage.sort_order + 1}
                  {previewImage.sort_order === 0 && (
                    <Badge className="ml-2 bg-yellow-500">Primary</Badge>
                  )}
                </div>
                <div>
                  <span className="font-medium">Uploaded: </span>
                  {new Date(previewImage.uploaded_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteImageId} onOpenChange={() => setDeleteImageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteImage} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ImageGallery;
