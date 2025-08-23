
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceThreshold {
  id?: number;
  metricType: string;
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  enabled: boolean;
}

const PerformanceThresholdManager: React.FC = () => {
  const [thresholds, setThresholds] = useState<PerformanceThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<PerformanceThreshold | null>(null);
  const [formData, setFormData] = useState<PerformanceThreshold>({
    metricType: '',
    metricName: '',
    warningThreshold: 0,
    criticalThreshold: 0,
    unit: 'ms',
    enabled: true
  });

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37307, {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'metric_type',
        IsAsc: true,
        Filters: []
      });

      if (error) throw new Error(error);
      setThresholds(data?.List || []);
    } catch (error) {
      console.error('Failed to load thresholds:', error);
      toast.error('Failed to load performance thresholds');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveThreshold = async () => {
    try {
      if (formData.warningThreshold >= formData.criticalThreshold) {
        toast.error('Warning threshold must be less than critical threshold');
        return;
      }

      if (editingThreshold?.id) {
        // Update existing threshold
        const { error } = await window.ezsite.apis.tableUpdate(37307, {
          ID: editingThreshold.id,
          metric_type: formData.metricType,
          metric_name: formData.metricName,
          warning_threshold: formData.warningThreshold,
          critical_threshold: formData.criticalThreshold,
          unit: formData.unit,
          enabled: formData.enabled
        });

        if (error) throw new Error(error);
        toast.success('Threshold updated successfully');
      } else {
        // Create new threshold
        const { error } = await window.ezsite.apis.tableCreate(37307, {
          metric_type: formData.metricType,
          metric_name: formData.metricName,
          warning_threshold: formData.warningThreshold,
          critical_threshold: formData.criticalThreshold,
          unit: formData.unit,
          enabled: formData.enabled
        });

        if (error) throw new Error(error);
        toast.success('Threshold created successfully');
      }

      setIsDialogOpen(false);
      setEditingThreshold(null);
      resetForm();
      loadThresholds();
    } catch (error) {
      console.error('Failed to save threshold:', error);
      toast.error('Failed to save threshold');
    }
  };

  const handleDeleteThreshold = async (id: number) => {
    if (!confirm('Are you sure you want to delete this threshold?')) return;

    try {
      const { error } = await window.ezsite.apis.tableDelete(37307, { ID: id });
      if (error) throw new Error(error);

      toast.success('Threshold deleted successfully');
      loadThresholds();
    } catch (error) {
      console.error('Failed to delete threshold:', error);
      toast.error('Failed to delete threshold');
    }
  };

  const handleEditThreshold = (threshold: any) => {
    setEditingThreshold(threshold);
    setFormData({
      metricType: threshold.metric_type,
      metricName: threshold.metric_name,
      warningThreshold: threshold.warning_threshold,
      criticalThreshold: threshold.critical_threshold,
      unit: threshold.unit,
      enabled: threshold.enabled
    });
    setIsDialogOpen(true);
  };

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(37307, {
        ID: id,
        enabled: enabled
      });

      if (error) throw new Error(error);
      toast.success(`Threshold ${enabled ? 'enabled' : 'disabled'}`);
      loadThresholds();
    } catch (error) {
      console.error('Failed to toggle threshold:', error);
      toast.error('Failed to update threshold');
    }
  };

  const resetForm = () => {
    setFormData({
      metricType: '',
      metricName: '',
      warningThreshold: 0,
      criticalThreshold: 0,
      unit: 'ms',
      enabled: true
    });
  };

  const openCreateDialog = () => {
    setEditingThreshold(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const metricTypes = [
  { value: 'load_time', label: 'Load Time' },
  { value: 'api_response', label: 'API Response' },
  { value: 'memory', label: 'Memory Usage' },
  { value: 'interaction', label: 'User Interaction' }];


  const metricNamesByType: Record<string, string[]> = {
    load_time: ['page_load', 'first_contentful_paint', 'largest_contentful_paint', 'dom_content_loaded'],
    api_response: ['api_call', 'database_query', 'external_service'],
    memory: ['heap_used', 'heap_total', 'heap_limit'],
    interaction: ['click_response', 'first_input_delay', 'scroll_response']
  };

  const units = [
  { value: 'ms', label: 'Milliseconds (ms)' },
  { value: 'MB', label: 'Megabytes (MB)' },
  { value: 'score', label: 'Score' },
  { value: 'count', label: 'Count' }];


  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) =>
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
            )}
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Performance Thresholds
              </CardTitle>
              <CardDescription>
                Configure performance monitoring thresholds and alerts
              </CardDescription>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Threshold
                </Button>
              </DialogTrigger>
              
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingThreshold ? 'Edit Threshold' : 'Create New Threshold'}
                  </DialogTitle>
                  <DialogDescription>
                    Set performance monitoring thresholds for alerts and notifications.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="metricType">Metric Type</Label>
                      <Select
                        value={formData.metricType}
                        onValueChange={(value) => setFormData({ ...formData, metricType: value, metricName: '' })}>

                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {metricTypes.map((type) =>
                          <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="metricName">Metric Name</Label>
                      <Select
                        value={formData.metricName}
                        onValueChange={(value) => setFormData({ ...formData, metricName: value })}
                        disabled={!formData.metricType}>

                        <SelectTrigger>
                          <SelectValue placeholder="Select metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.metricType && metricNamesByType[formData.metricType]?.map((name) =>
                          <SelectItem key={name} value={name}>
                              {name.replace('_', ' ')}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="warningThreshold">Warning Threshold</Label>
                      <Input
                        id="warningThreshold"
                        type="number"
                        value={formData.warningThreshold}
                        onChange={(e) => setFormData({ ...formData, warningThreshold: Number(e.target.value) })}
                        placeholder="Enter warning value" />

                    </div>
                    
                    <div>
                      <Label htmlFor="criticalThreshold">Critical Threshold</Label>
                      <Input
                        id="criticalThreshold"
                        type="number"
                        value={formData.criticalThreshold}
                        onChange={(e) => setFormData({ ...formData, criticalThreshold: Number(e.target.value) })}
                        placeholder="Enter critical value" />

                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) =>
                        <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} />

                    <Label htmlFor="enabled">Enable threshold monitoring</Label>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveThreshold}>
                    {editingThreshold ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {thresholds.length === 0 ?
          <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No performance thresholds configured</p>
              <p className="text-sm">Click "Add Threshold" to get started</p>
            </div> :

          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Warning</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((threshold: any) =>
              <TableRow key={threshold.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {threshold.metric_name?.replace('_', ' ') || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {threshold.metric_type?.replace('_', ' ') || 'Unknown'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        {threshold.warning_threshold}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        {threshold.critical_threshold}
                      </Badge>
                    </TableCell>
                    <TableCell>{threshold.unit}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                      checked={threshold.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(threshold.id, checked)} />

                        <span className="text-sm">
                          {threshold.enabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditThreshold(threshold)}>

                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteThreshold(threshold.id)}
                      className="text-red-600 hover:text-red-700">

                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              )}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>
    </div>);

};

export default PerformanceThresholdManager;