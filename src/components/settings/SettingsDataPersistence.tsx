import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePageLifecycle } from '@/hooks/usePageLifecycle';
import { useToast } from '@/hooks/use-toast';
import { Save, Download, Upload, Trash2 } from 'lucide-react';

interface SettingsData {
  autoSave: boolean;
  syncInterval: number;
  lastSync: string | null;
  pendingChanges: boolean;
}

export function SettingsDataPersistence() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<SettingsData>({
    autoSave: true,
    syncInterval: 30000, // 30 seconds
    lastSync: null,
    pendingChanges: false
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Use modern lifecycle hook for data persistence
  const { isVisible, flushData, getPersistedData, clearPersistedData } = usePageLifecycle({
    persistenceKey: 'ny-fashion-settings',
    autoFlushData: {
      url: '/api/settings/autosave',
      getData: () => ({
        settings,
        hasUnsavedChanges,
        timestamp: Date.now()
      })
    },
    onVisibilityChange: (visible) => {
      if (!visible && hasUnsavedChanges) {
        // Page became hidden with unsaved changes - auto-save
        handleAutoSave();
      }
    },
    onPageHide: () => {
      // Page is being unloaded - final save attempt
      if (hasUnsavedChanges) {
        handleAutoSave();
      }
    }
  });

  // Load persisted data on mount
  React.useEffect(() => {
    const persistedData = getPersistedData();
    if (persistedData?.data?.settings) {
      setSettings(persistedData.data.settings);
      setHasUnsavedChanges(persistedData.data.hasUnsavedChanges || false);
    }
  }, [getPersistedData]);

  const handleAutoSave = React.useCallback(async () => {
    if (!hasUnsavedChanges) return;

    try {
      const success = await flushData('/api/settings/save', {
        settings,
        timestamp: Date.now()
      });

      if (success) {
        setHasUnsavedChanges(false);
        setSettings(prev => ({
          ...prev,
          lastSync: new Date().toISOString()
        }));
        
        toast({
          title: "Settings auto-saved",
          description: "Your settings have been automatically saved.",
        });
      }
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }, [hasUnsavedChanges, settings, flushData, toast]);

  const handleSettingChange = (key: keyof SettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleManualSave = async () => {
    await handleAutoSave();
  };

  const handleExportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ny-fashion-settings-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        setSettings(importedSettings);
        setHasUnsavedChanges(true);
        
        toast({
          title: "Settings imported",
          description: "Settings have been imported successfully.",
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Failed to parse settings file.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const handleClearPersistedData = () => {
    clearPersistedData();
    toast({
      title: "Cache cleared",
      description: "Local settings cache has been cleared.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Data Persistence
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-600">
                Unsaved Changes
              </Badge>
            )}
            {!isVisible && (
              <Badge variant="secondary">
                Page Hidden
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Modern data persistence using pagehide + visibilitychange events.
            No unload handlers - BFCache compatible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-save"
              checked={settings.autoSave}
              onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
            />
            <Label htmlFor="auto-save">Enable auto-save</Label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Last sync:</Label>
              <p className="text-sm text-muted-foreground">
                {settings.lastSync 
                  ? new Date(settings.lastSync).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleManualSave} disabled={!hasUnsavedChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save Now
            </Button>
            
            <Button variant="outline" onClick={handleExportSettings}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Button variant="outline" asChild>
              <Label htmlFor="import-file" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Label>
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportSettings}
            />
            
            <Button variant="outline" onClick={handleClearPersistedData}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cache
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>✅ Uses modern pagehide + visibilitychange events</p>
            <p>✅ BFCache compatible - no unload handlers</p>
            <p>✅ Automatic data flushing with navigator.sendBeacon</p>
            <p>✅ Fallback to fetch with keepalive</p>
            <p>✅ Works reliably on mobile Safari</p>
          </div>
        </CardContent>
      </Card>

      {import.meta.env.DEV && (
        <Card>
          <CardHeader>
            <CardTitle>Development Tools</CardTitle>
            <CardDescription>
              Debug utilities for lifecycle management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={() => {
                import('@/devtools/assertNoUnload').then(({ reportUnloadHandlers }) => {
                  const handlers = reportUnloadHandlers();
                  toast({
                    title: "Unload Handlers Check",
                    description: handlers.length > 0 
                      ? `Found ${handlers.length} problematic handlers`
                      : "No problematic unload handlers found",
                    variant: handlers.length > 0 ? "destructive" : "default"
                  });
                });
              }}
            >
              Check for Unload Handlers
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SettingsDataPersistence;