
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle, XCircle } from 'lucide-react';

interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface ImageUploadProgressProps {
  uploads: UploadProgressItem[];
  onClose: () => void;
}

const ImageUploadProgress: React.FC<ImageUploadProgressProps> = ({ uploads, onClose }) => {
  const allCompleted = uploads.every((upload) => upload.status === 'completed' || upload.status === 'error');

  React.useEffect(() => {
    if (allCompleted && uploads.length > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, uploads.length, onClose]);

  if (uploads.length === 0) return null;

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="space-y-3">
          {uploads.map((upload) =>
          <div key={upload.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  {upload.status === 'uploading' && <Upload className="h-4 w-4 text-blue-500 animate-spin" />}
                  {upload.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {upload.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  <span className="font-medium truncate max-w-48">{upload.fileName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {upload.status === 'uploading' && `${upload.progress}%`}
                  {upload.status === 'completed' && 'Complete'}
                  {upload.status === 'error' && 'Failed'}
                </span>
              </div>
              
              {upload.status === 'uploading' &&
            <Progress value={upload.progress} className="h-2" />
            }
              
              {upload.status === 'error' && upload.error &&
            <p className="text-xs text-red-600">{upload.error}</p>
            }
            </div>
          )}
        </div>
      </CardContent>
    </Card>);

};

export default ImageUploadProgress;