
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Image,
  Trash2,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock } from
'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLoadingState } from '@/hooks/use-loading-state';

interface FileStats {
  totalFiles: number;
  totalSize: number;
  productImages: number;
  employeePhotos: number;
  invoices: number;
  orphanedFiles: number;
}

interface UploadSession {
  session_id: string;
  upload_type: string;
  entity_id: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const FileManagerDashboard: React.FC = () => {
  const { loading, startLoading, stopLoading } = useLoadingState();
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [cleanupProgress, setCleanupProgress] = useState<number | null>(null);

  const loadFileStats = async () => {
    try {
      // Get file statistics from database
      const productImagesQuery = `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM product_images`;
      const employeePhotosQuery = `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM employee_photos WHERE front_image_url IS NOT NULL`;
      const invoicesQuery = `SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM purchase_order_invoices`;

      const [productResult, employeeResult, invoiceResult] = await Promise.all([
      window.ezsite.db.query(productImagesQuery),
      window.ezsite.db.query(employeePhotosQuery),
      window.ezsite.db.query(invoicesQuery)]
      );

      const stats: FileStats = {
        totalFiles: (productResult[0]?.count || 0) + (employeeResult[0]?.count || 0) + (invoiceResult[0]?.count || 0),
        totalSize: (productResult[0]?.size || 0) + (employeeResult[0]?.size || 0) + (invoiceResult[0]?.size || 0),
        productImages: productResult[0]?.count || 0,
        employeePhotos: employeeResult[0]?.count || 0,
        invoices: invoiceResult[0]?.count || 0,
        orphanedFiles: 0 // Will be calculated separately if needed
      };

      setFileStats(stats);

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load file statistics",
        variant: "destructive"
      });
    }
  };

  const loadUploadSessions = async () => {
    try {
      const sessionsQuery = `
        SELECT * FROM upload_sessions 
        ORDER BY created_at DESC 
        LIMIT 20
      `;
      const result = await window.ezsite.db.query(sessionsQuery);
      setUploadSessions(result || []);
    } catch (error: any) {
      console.error('Failed to load upload sessions:', error);
    }
  };

  const cleanupOrphanedFiles = async () => {
    startLoading();
    setCleanupProgress(0);

    try {
      const result = await window.ezsite.apis.run({
        path: 'cleanupOrphanedFiles',
        param: []
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setCleanupProgress(100);

      toast({
        title: "Cleanup Complete",
        description: result.data.message
      });

      // Refresh stats
      await loadFileStats();

    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup orphaned files",
        variant: "destructive"
      });
    } finally {
      stopLoading();
      setTimeout(() => setCleanupProgress(null), 3000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'in_progress': { variant: 'default' as const, icon: Clock, text: 'In Progress' },
      'completed': { variant: 'default' as const, icon: CheckCircle, text: 'Completed' },
      'completed_with_errors': { variant: 'destructive' as const, icon: AlertTriangle, text: 'Partial' },
      'failed': { variant: 'destructive' as const, icon: AlertTriangle, text: 'Failed' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.failed;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.text}
      </Badge>);

  };

  useEffect(() => {
    loadFileStats();
    loadUploadSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">File Management</h2>
        <Button onClick={() => {loadFileStats();loadUploadSessions();}} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* File Statistics */}
      {fileStats &&
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{fileStats.totalFiles}</div>
                <div className="text-sm text-gray-600">Total Files</div>
                <div className="text-xs text-gray-500 mt-1">{formatFileSize(fileStats.totalSize)}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{fileStats.productImages}</div>
                <div className="text-sm text-gray-600">Product Images</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{fileStats.employeePhotos}</div>
                <div className="text-sm text-gray-600">Employee Photos</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{fileStats.invoices}</div>
                <div className="text-sm text-gray-600">Invoice Files</div>
              </div>
            </CardContent>
          </Card>
        </div>
      }

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList>
          <TabsTrigger value="sessions">Upload Sessions</TabsTrigger>
          <TabsTrigger value="cleanup">File Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Upload Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {uploadSessions.length === 0 ?
              <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent upload sessions</p>
                </div> :

              <div className="space-y-3">
                  {uploadSessions.map((session) =>
                <div key={session.session_id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium">{session.upload_type.replace('_', ' ').toUpperCase()}</div>
                          <div className="text-sm text-gray-600">
                            Session: {session.session_id}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(session.created_at).toLocaleString()}
                          </div>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{session.completed_files} / {session.total_files} files</span>
                        </div>
                        
                        <Progress
                      value={session.completed_files / session.total_files * 100}
                      className="h-2" />


                        {session.failed_files > 0 &&
                    <div className="text-sm text-red-600">
                            {session.failed_files} file(s) failed to upload
                          </div>
                    }
                      </div>
                    </div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Cleanup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will remove orphaned files that are no longer associated with any records.
                  This action cannot be undone.
                </AlertDescription>
              </Alert>

              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Cleanup Orphaned Files</h4>
                  <p className="text-sm text-gray-600">
                    Remove files from storage that are no longer linked to database records
                  </p>
                </div>
                
                <Button
                  onClick={cleanupOrphanedFiles}
                  disabled={loading}
                  variant="outline">

                  {loading ?
                  <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Cleaning...
                    </> :

                  <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Start Cleanup
                    </>
                  }
                </Button>
              </div>

              {cleanupProgress !== null &&
              <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cleanup Progress</span>
                    <span>{cleanupProgress}%</span>
                  </div>
                  <Progress value={cleanupProgress} className="h-2" />
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default FileManagerDashboard;