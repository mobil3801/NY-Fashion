
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UseFileUploadOptions {
  uploadType: 'product_image' | 'employee_photo' | 'invoice' | 'general';
  entityId?: string | number;
  maxFiles?: number;
  maxSize?: number;
  onUploadComplete?: (files: any[]) => void;
  onProgress?: (progress: number) => void;
}

export const useFileUpload = (options: UseFileUploadOptions) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    status: 'idle'
  });

  const validateFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      const result = await window.ezsite.apis.run({
        path: 'validateFileUpload',
        param: [file, options.uploadType]
      });

      if (result.error) {
        toast({
          title: "Validation Error",
          description: result.error,
          variant: "destructive"
        });
        return false;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message || "File validation failed",
        variant: "destructive"
      });
      return false;
    }
  }, [options.uploadType]);

  const uploadSingleFile = useCallback(async (file: File): Promise<any | null> => {
    try {
      setUploadProgress({ progress: 0, status: 'uploading' });

      // Validate file first
      const isValid = await validateFile(file);
      if (!isValid) {
        setUploadProgress({ progress: 0, status: 'error', error: 'Validation failed' });
        return null;
      }

      setUploadProgress({ progress: 20, status: 'uploading' });

      // Upload to storage
      const uploadResult = await window.ezsite.apis.upload({
        filename: file.name,
        file: file
      });

      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      setUploadProgress({ progress: 60, status: 'uploading' });

      // Get file URL
      const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
      if (urlResult.error) {
        throw new Error(urlResult.error);
      }

      setUploadProgress({ progress: 100, status: 'completed' });

      const uploadedFile = {
        originalName: file.name,
        url: urlResult.data,
        fileId: uploadResult.data,
        size: file.size,
        type: file.type
      };

      options.onUploadComplete?.([uploadedFile]);
      options.onProgress?.(100);

      return uploadedFile;

    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setUploadProgress({ progress: 0, status: 'error', error: errorMessage });

      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    }
  }, [validateFile, options]);

  const uploadMultipleFiles = useCallback(async (files: File[]): Promise<any[]> => {
    if (!files.length) return [];

    setUploadProgress({ progress: 0, status: 'uploading' });

    try {
      // Create upload session
      const sessionResult = await window.ezsite.apis.run({
        path: 'createUploadSession',
        param: [files.length, options.uploadType, options.entityId]
      });

      if (sessionResult.error) {
        throw new Error(sessionResult.error);
      }

      const sessionId = sessionResult.data.sessionId;
      const uploadedFiles = [];
      let completedCount = 0;
      let failedCount = 0;

      // Upload files with progress tracking
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          const progress = (i + 0.5) / files.length * 100;
          setUploadProgress({ progress, status: 'uploading' });
          options.onProgress?.(progress);

          const uploadedFile = await uploadSingleFile(file);
          if (uploadedFile) {
            uploadedFiles.push(uploadedFile);
            completedCount++;
          } else {
            failedCount++;
          }

          // Update session progress
          await window.ezsite.apis.run({
            path: 'updateUploadProgress',
            param: [sessionId, completedCount, failedCount]
          });

        } catch (error: any) {
          failedCount++;
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }

      setUploadProgress({
        progress: 100,
        status: failedCount === 0 ? 'completed' : 'error',
        error: failedCount > 0 ? `${failedCount} files failed to upload` : undefined
      });

      if (completedCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${completedCount} file(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
          variant: failedCount === 0 ? "default" : "destructive"
        });

        options.onUploadComplete?.(uploadedFiles);
      }

      return uploadedFiles;

    } catch (error: any) {
      setUploadProgress({ progress: 0, status: 'error', error: error.message });

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload files",
        variant: "destructive"
      });

      return [];
    }
  }, [uploadSingleFile, options]);

  const resetProgress = useCallback(() => {
    setUploadProgress({ progress: 0, status: 'idle' });
  }, []);

  return {
    uploadProgress,
    uploadSingleFile,
    uploadMultipleFiles,
    validateFile,
    resetProgress,
    isUploading: uploadProgress.status === 'uploading'
  };
};

export default useFileUpload;