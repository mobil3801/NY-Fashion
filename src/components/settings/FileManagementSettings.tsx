
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  HardDrive, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import FileManagerDashboard from '@/components/common/FileManagerDashboard';

interface FileSettings {
  maxFileSize: number;
  maxImagesPerProduct: number;
  allowedImageTypes: string[];
  allowedDocumentTypes: string[];
  autoCleanupEnabled: boolean;
  cleanupIntervalDays: number;
  compressionEnabled: boolean;
  thumbnailGeneration: boolean;
}

const FileManagementSettings: React.FC = () => {
  const [settings, setSettings] = useState<FileSettings>({
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxImagesPerProduct: 10,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedDocumentTypes: ['application/pdf', 'application/msword'],
    autoCleanupEnabled: false,
    cleanupIntervalDays: 30,
    compressionEnabled: true,
    thumbnailGeneration: true
  });

  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStorageInfo = async () => {
    try {
      const result = await window.ezsite.apis.run({
        path: 'getFileStatistics',
        param: []
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setStorageInfo(result.data);
    } catch (error: any) {
      console.error('Failed to load storage info:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    
    try {
      // Save settings to database (you could create a settings table for this)
      const settingsQuery = `
        INSERT INTO settings (key, value, updated_at) 
        VALUES ('file_management', $1, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET value = $1, updated_at = NOW()
      `;

      await window.ezsite.db.query(settingsQuery, [JSON.stringify(settings)]);
      
      toast({
        title: "Settings Saved",
        description: "File management settings have been updated successfully"
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">File Management Settings</h2>
        <Button onClick={saveSettings} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="storage">Storage Info</TabsTrigger>
          <TabsTrigger value="management">File Management</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Upload Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Maximum File Size (MB)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    value={settings.maxFileSize / (1024 * 1024)}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      maxFileSize: parseFloat(e.target.value) * 1024 * 1024
                    }))}
                    min="1"
                    max="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxImagesPerProduct">Max Images per Product</Label>
                  <Input
                    id="maxImagesPerProduct"
                    type="number"
                    value={settings.maxImagesPerProduct}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      maxImagesPerProduct: parseInt(e.target.value)
                    }))}
                    min="1"
                    max="20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compressionEnabled">Enable Image Compression</Label>
                  <Switch
                    id="compressionEnabled"
                    checked={settings.compressionEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      compressionEnabled: checked
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="thumbnailGeneration">Generate Thumbnails</Label>
                  <Switch
                    id="thumbnailGeneration"
                    checked={settings.thumbnailGeneration}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      thumbnailGeneration: checked
                    }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cleanup Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Automatic Cleanup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoCleanupEnabled">Enable Auto Cleanup</Label>
                  <Switch
                    id="autoCleanupEnabled"
                    checked={settings.autoCleanupEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      autoCleanupEnabled: checked
                    }))}
                  />
                </div>

                {settings.autoCleanupEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="cleanupInterval">Cleanup Interval (Days)</Label>
                    <Input
                      id="cleanupInterval"
                      type="number"
                      value={settings.cleanupIntervalDays}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        cleanupIntervalDays: parseInt(e.target.value)
                      }))}
                      min="1"
                      max="365"
                    />
                  </div>
                )}

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Auto cleanup will remove orphaned files that are no longer linked to database records.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* File Type Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Allowed File Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Image Types</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['image/jpeg', 'image/png', 'image/webp', 'image/gif'].map(type => (
                      <Badge
                        key={type}
                        variant={settings.allowedImageTypes.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSettings(prev => ({
                            ...prev,
                            allowedImageTypes: prev.allowedImageTypes.includes(type)
                              ? prev.allowedImageTypes.filter(t => t !== type)
                              : [...prev.allowedImageTypes, type]
                          }));
                        }}
                      >
                        {type.split('/')[1].toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Document Types</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['application/pdf', 'application/msword', 'text/plain'].map(type => (
                      <Badge
                        key={type}
                        variant={settings.allowedDocumentTypes.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setSettings(prev => ({
                            ...prev,
                            allowedDocumentTypes: prev.allowedDocumentTypes.includes(type)
                              ? prev.allowedDocumentTypes.filter(t => t !== type)
                              : [...prev.allowedDocumentTypes, type]
                          }));
                        }}
                      >
                        {type === 'application/pdf' ? 'PDF' : 
                         type === 'application/msword' ? 'DOC' : 
                         type === 'text/plain' ? 'TXT' : type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          {storageInfo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Storage Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Files:</span>
                      <Badge>{storageInfo.summary.totalFiles}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Size:</span>
                      <Badge variant="outline">{formatFileSize(storageInfo.summary.totalSize)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Orphaned Files:</span>
                      <Badge variant={storageInfo.summary.orphanedFiles > 0 ? "destructive" : "default"}>
                        {storageInfo.summary.orphanedFiles}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">File Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Product Images:</span>
                      <div className="text-right">
                        <div>{storageInfo.breakdown.productImages.count}</div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(storageInfo.breakdown.productImages.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Employee Photos:</span>
                      <div className="text-right">
                        <div>{storageInfo.breakdown.employeePhotos.count}</div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(storageInfo.breakdown.employeePhotos.size)}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Invoice Files:</span>
                      <div className="text-right">
                        <div>{storageInfo.breakdown.invoices.count}</div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(storageInfo.breakdown.invoices.size)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Health Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Storage Connected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {storageInfo.summary.orphanedFiles === 0 ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">No Orphaned Files</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">{storageInfo.summary.orphanedFiles} Orphaned Files</span>
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadStorageInfo}
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="management">
          <FileManagerDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FileManagementSettings;
