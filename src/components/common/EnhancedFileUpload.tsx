
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
  fileId?: string;
}

interface EnhancedFileUploadProps {
  onUploadComplete: (files: any[]) => void;
  uploadType: 'product_image' | 'employee_photo' | 'invoice' | 'general';
  entityId?: string | number;
  maxFiles?: number;
  maxSize?: number;
  allowedTypes?: string[];
  multiple?: boolean;
  title?: string;
  description?: string;
}

const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onUploadComplete,
  uploadType,
  entityId,
  maxFiles = 10,
  maxSize = 5 * 1024 * 1024, // 5MB default
  allowedTypes,
  multiple = true,
  title = "Upload Files",
  description = "Drag & drop files here, or click to select"
}) => {
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const getDefaultAllowedTypes = () => {
    switch (uploadType) {
      case 'product_image':
      case 'employee_photo':
        return {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp']
        };
      case 'invoice':
        return {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
          'application/pdf': ['.pdf'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        };
      default:
        return {
          'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
          'application/pdf': ['.pdf']
        };
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadProgress((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedTypes || getDefaultAllowedTypes(),
    multiple,
    maxFiles,
    maxSize,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const errors = rejection.errors.map((e) => e.message).join(', ');
        toast({
          title: "File Rejected",
          description: `${rejection.file.name}: ${errors}`,
          variant: "destructive"
        });
      });
    }
  });

  const removeFile = (index: number) => {
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (uploadProgress.length === 0) return;

    setIsUploading(true);

    try {
      // Create upload session
      const sessionResult = await window.ezsite.apis.run({
        path: 'createUploadSession',
        param: [uploadProgress.length, uploadType, entityId]
      });

      if (sessionResult.error) {
        throw new Error(sessionResult.error);
      }

      const sessionId = sessionResult.data.sessionId;
      setSessionId(sessionId);

      const uploadedFiles = [];
      let completedCount = 0;
      let failedCount = 0;

      // Upload files one by one with progress tracking
      for (let i = 0; i < uploadProgress.length; i++) {
        const fileProgress = uploadProgress[i];

        try {
          // Update status to uploading
          setUploadProgress((prev) => prev.map((fp, index) =>
          index === i ? { ...fp, status: 'uploading', progress: 0 } : fp
          ));

          // Validate file first
          const validationResult = await window.ezsite.apis.run({
            path: 'validateFileUpload',
            param: [fileProgress.file, uploadType]
          });

          if (validationResult.error) {
            throw new Error(validationResult.error);
          }

          // Simulate progress updates during upload
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => prev.map((fp, index) =>
            index === i ? {
              ...fp,
              progress: Math.min(fp.progress + Math.random() * 20, 90)
            } : fp
            ));
          }, 200);

          // Upload to storage
          const uploadResult = await window.ezsite.apis.upload({
            filename: fileProgress.file.name,
            file: fileProgress.file
          });

          clearInterval(progressInterval);

          if (uploadResult.error) {
            throw new Error(uploadResult.error);
          }

          // Get file URL
          const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
          if (urlResult.error) {
            throw new Error(urlResult.error);
          }

          // Update progress to completed
          setUploadProgress((prev) => prev.map((fp, index) =>
          index === i ? {
            ...fp,
            status: 'completed',
            progress: 100,
            url: urlResult.data,
            fileId: uploadResult.data
          } : fp
          ));

          uploadedFiles.push({
            originalName: fileProgress.file.name,
            url: urlResult.data,
            fileId: uploadResult.data,
            size: fileProgress.file.size,
            type: fileProgress.file.type
          });

          completedCount++;

        } catch (error) {
          // Update progress to error
          setUploadProgress((prev) => prev.map((fp, index) =>
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

      // Complete upload session
      if (completedCount > 0) {
        onUploadComplete(uploadedFiles);
        toast({
          title: "Upload Complete",
          description: `${completedCount} file(s) uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
          variant: completedCount === uploadProgress.length ? "default" : "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}>

          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          {isDragActive ?
          <p className="text-blue-600">Drop the files here...</p> :

          <div>
              <p className="text-gray-600 mb-2">{description}</p>
              <p className="text-xs text-gray-500">
                Max {maxFiles} files, {(maxSize / (1024 * 1024)).toFixed(1)}MB each
              </p>
            </div>
          }
        </div>

        {/* File list */}
        {uploadProgress.length > 0 &&
        <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Files ({uploadProgress.length})</h4>
              {uploadProgress.length > 0 && !isUploading &&
            <Button
              onClick={uploadFiles}
              disabled={uploadProgress.every((fp) => fp.status === 'completed')}>

                  Upload All
                </Button>
            }
            </div>

            {uploadProgress.map((fileProgress, index) =>
          <div
            key={index}
            className={`p-3 border rounded-lg ${getStatusColor(fileProgress.status)}`}>

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
                  
                  {fileProgress.status === 'pending' &&
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={isUploading}>

                      <X className="h-4 w-4" />
                    </Button>
              }
                </div>

                {fileProgress.status === 'uploading' &&
            <Progress value={fileProgress.progress} className="h-2" />
            }

                {fileProgress.status === 'error' && fileProgress.error &&
            <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {fileProgress.error}
                    </AlertDescription>
                  </Alert>
            }

                {fileProgress.status === 'completed' &&
            <div className="mt-2">
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      ✓ Uploaded successfully
                    </Badge>
                  </div>
            }
              </div>
          )}
          </div>
        }

        {/* Overall progress */}
        {isUploading && uploadProgress.length > 0 &&
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>
                {uploadProgress.filter((fp) => fp.status === 'completed').length} / {uploadProgress.length}
              </span>
            </div>
            <Progress
            value={uploadProgress.filter((fp) => fp.status === 'completed').length / uploadProgress.length * 100}
            className="h-2" />

          </div>
        }
      </CardContent>
    </Card>);

};

export default EnhancedFileUpload;