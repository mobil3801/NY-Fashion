
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import SettingsDataPersistence from '@/components/settings/SettingsDataPersistence';
import FileManagementSettings from '@/components/settings/FileManagementSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Settings, Store, DollarSign, CreditCard, Globe, Shield,
  Database, Upload, Save, RefreshCw, User, MapPin, Phone,
  Clock, FileText, Printer, Smartphone, Lock, Eye, Bell,
  Download, Key, AlertTriangle } from
'lucide-react';
import { hasPermission } from '@/utils/permissions';

interface SettingItem {
  id?: number;
  category: string;
  key: string;
  value: string;
  data_type: string;
  description: string;
  required_role: string;
}

interface StoreSettings {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  hours: string;
  tax_id: string;
  business_registration: string;
  logo_url: string;
}

interface FinancialSettings {
  tax_rate: number;
  nyc_tax_rate: number;
  currency: string;
  currency_symbol: string;
  currency_position: string;
  decimal_places: number;
  invoice_prefix: string;
  invoice_start_number: number;
  discount_threshold_cashier: number;
  discount_threshold_manager: number;
  auto_calculate_tax: boolean;
}

const SettingsPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const isAdmin = hasPermission(user, 'admin');
  const isManager = hasPermission(user, 'manager');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await window.ezsite.apis.tablePage(36865, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: "category",
        IsAsc: true
      });

      if (error) throw new Error(error);

      const settingsMap: Record<string, any> = {};
      data.List.forEach((setting: SettingItem) => {
        if (!settingsMap[setting.category]) {
          settingsMap[setting.category] = {};
        }

        let value = setting.value;
        try {
          if (setting.data_type === 'object' || setting.data_type === 'array') {
            value = JSON.parse(setting.value);
          } else if (setting.data_type === 'number') {
            value = parseFloat(setting.value);
          } else if (setting.data_type === 'boolean') {
            value = setting.value === 'true';
          }
        } catch (e) {
          console.warn('Failed to parse setting value:', setting.key, setting.value);
        }

        settingsMap[setting.category][setting.key] = value;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (category: string, key: string, value: any, dataType: string = 'string', requiredRole: string = 'Administrator') => {
    try {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // Check if setting exists
      const { data: existingData, error: searchError } = await window.ezsite.apis.tablePage(36865, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: "category", op: "Equal", value: category },
        { name: "key", op: "Equal", value: key }]

      });

      if (searchError) throw new Error(searchError);

      const settingData = {
        category,
        key,
        value: stringValue,
        data_type: dataType,
        description: `${category} setting: ${key}`,
        required_role: requiredRole,
        updated_at: new Date().toISOString()
      };

      if (existingData.List.length > 0) {
        // Update existing setting
        const { error } = await window.ezsite.apis.tableUpdate(36865, {
          id: existingData.List[0].id,
          ...settingData
        });
        if (error) throw new Error(error);
      } else {
        // Create new setting
        const { error } = await window.ezsite.apis.tableCreate(36865, {
          ...settingData,
          created_at: new Date().toISOString()
        });
        if (error) throw new Error(error);
      }

      // Update local state
      setSettings((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      }));

      return true;
    } catch (error) {
      console.error('Failed to update setting:', error);
      throw error;
    }
  };

  const handleSettingChange = (category: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setUnsavedChanges(true);
  };

  const saveSettings = async () => {
    try {
      setLoading(true);

      // Save all settings in current tab
      const currentSettings = settings[activeTab] || {};

      for (const [key, value] of Object.entries(currentSettings)) {
        const dataType = typeof value === 'object' ? 'object' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string';
        await updateSetting(activeTab, key, value, dataType);
      }

      setUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const { data: fileId, error } = await window.ezsite.apis.upload({
        filename: file.name,
        file: file
      });

      if (error) throw new Error(error);

      const { data: logoUrl, error: urlError } = await window.ezsite.apis.getUploadUrl(fileId);
      if (urlError) throw new Error(urlError);

      handleSettingChange('store', 'logo_url', logoUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully"
      });
    } catch (error) {
      console.error('Failed to upload logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive"
      });
    }
  };

  const initializeDefaultSettings = async () => {
    const defaults = [
    // Store settings
    { category: 'store', key: 'name', value: 'Jackson Heights POS', dataType: 'string' },
    { category: 'store', key: 'address', value: '123 Main Street', dataType: 'string' },
    { category: 'store', key: 'city', value: 'Jackson Heights', dataType: 'string' },
    { category: 'store', key: 'state', value: 'NY', dataType: 'string' },
    { category: 'store', key: 'zip', value: '11372', dataType: 'string' },
    { category: 'store', key: 'phone', value: '(718) 555-0123', dataType: 'string' },
    { category: 'store', key: 'hours', value: 'Mon-Sat: 9AM-9PM, Sun: 10AM-6PM', dataType: 'string' },

    // Financial settings
    { category: 'financial', key: 'tax_rate', value: '8.25', dataType: 'number' },
    { category: 'financial', key: 'nyc_tax_rate', value: '8.25', dataType: 'number' },
    { category: 'financial', key: 'currency', value: 'USD', dataType: 'string' },
    { category: 'financial', key: 'currency_symbol', value: '$', dataType: 'string' },
    { category: 'financial', key: 'invoice_prefix', value: 'INV', dataType: 'string' },
    { category: 'financial', key: 'invoice_start_number', value: '1001', dataType: 'number' },

    // Security settings
    { category: 'security', key: 'session_timeout', value: '480', dataType: 'number' },
    { category: 'security', key: 'password_min_length', value: '8', dataType: 'number' },
    { category: 'security', key: 'audit_log_retention', value: '90', dataType: 'number' }];


    for (const setting of defaults) {
      try {
        await updateSetting(setting.category, setting.key, setting.value, setting.dataType);
      } catch (error) {
        console.warn('Failed to initialize default setting:', setting.key);
      }
    }
  };

  if (loading && Object.keys(settings).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>);

  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('settings')}</h1>
          <p className="text-gray-600 mt-2">Comprehensive system configuration and management</p>
        </div>
        {unsavedChanges &&
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Unsaved Changes
          </Badge>
        }
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={saveSettings}
          disabled={loading || !unsavedChanges}
          className="bg-emerald-600 hover:bg-emerald-700">

          {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
        <Button
          variant="outline"
          onClick={initializeDefaultSettings}
          disabled={loading}>

          <Download className="w-4 h-4 mr-2" />
          Initialize Defaults
        </Button>
        <Button variant="outline" onClick={loadSettings} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 rounded-2xl">
          <TabsTrigger value="store" className="rounded-xl">
            <Store className="w-4 h-4 mr-2" />
            Store
          </TabsTrigger>
          <TabsTrigger value="financial" className="rounded-xl">
            <DollarSign className="w-4 h-4 mr-2" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="payment" className="rounded-xl">
            <CreditCard className="w-4 h-4 mr-2" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="i18n" className="rounded-xl">
            <Globe className="w-4 h-4 mr-2" />
            Localization
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-xl">
            <FileText className="w-4 h-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl">
            <Database className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Store className="w-5 h-5 mr-2" />
                Store Information
              </CardTitle>
              <CardDescription>Basic store details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="store-name">Store Name</Label>
                  <Input
                    id="store-name"
                    value={settings.store?.name || ''}
                    onChange={(e) => handleSettingChange('store', 'name', e.target.value)}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="store-phone">Phone</Label>
                  <Input
                    id="store-phone"
                    value={settings.store?.phone || ''}
                    onChange={(e) => handleSettingChange('store', 'phone', e.target.value)}
                    className="rounded-2xl" />

                </div>
              </div>

              <div>
                <Label htmlFor="store-address">Address</Label>
                <Input
                  id="store-address"
                  value={settings.store?.address || ''}
                  onChange={(e) => handleSettingChange('store', 'address', e.target.value)}
                  className="rounded-2xl"
                  placeholder="123 Main Street" />

              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="store-city">City</Label>
                  <Input
                    id="store-city"
                    value={settings.store?.city || 'Jackson Heights'}
                    onChange={(e) => handleSettingChange('store', 'city', e.target.value)}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="store-state">State</Label>
                  <Input
                    id="store-state"
                    value={settings.store?.state || 'NY'}
                    onChange={(e) => handleSettingChange('store', 'state', e.target.value)}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="store-zip">ZIP Code</Label>
                  <Input
                    id="store-zip"
                    value={settings.store?.zip || '11372'}
                    onChange={(e) => handleSettingChange('store', 'zip', e.target.value)}
                    className="rounded-2xl" />

                </div>
              </div>

              <div>
                <Label htmlFor="store-hours">Business Hours</Label>
                <Textarea
                  id="store-hours"
                  value={settings.store?.hours || ''}
                  onChange={(e) => handleSettingChange('store', 'hours', e.target.value)}
                  className="rounded-2xl"
                  placeholder="Mon-Sat: 9AM-9PM, Sun: 10AM-6PM"
                  rows={2} />

              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax-id">Tax ID</Label>
                  <Input
                    id="tax-id"
                    value={settings.store?.tax_id || ''}
                    onChange={(e) => handleSettingChange('store', 'tax_id', e.target.value)}
                    className="rounded-2xl"
                    placeholder="XX-XXXXXXX" />

                </div>
                <div>
                  <Label htmlFor="business-reg">Business Registration</Label>
                  <Input
                    id="business-reg"
                    value={settings.store?.business_registration || ''}
                    onChange={(e) => handleSettingChange('store', 'business_registration', e.target.value)}
                    className="rounded-2xl" />

                </div>
              </div>

              <div>
                <Label>Store Logo</Label>
                <div className="mt-2 flex items-center space-x-4">
                  {settings.store?.logo_url &&
                  <img
                    src={settings.store.logo_url}
                    alt="Store logo"
                    className="h-16 w-16 object-cover rounded-lg border" />

                  }
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                      className="rounded-2xl" />

                    <p className="text-xs text-gray-500 mt-1">Recommended: 200x200px, PNG/JPG</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Tax Configuration
              </CardTitle>
              <CardDescription>NYC tax rates and calculation settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax-rate">Standard Tax Rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.financial?.tax_rate || 8.25}
                    onChange={(e) => handleSettingChange('financial', 'tax_rate', parseFloat(e.target.value))}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="nyc-tax-rate">NYC Combined Tax Rate (%)</Label>
                  <Input
                    id="nyc-tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.financial?.nyc_tax_rate || 8.25}
                    onChange={(e) => handleSettingChange('financial', 'nyc_tax_rate', parseFloat(e.target.value))}
                    className="rounded-2xl" />

                  <p className="text-xs text-gray-500 mt-1">NY State (4%) + NYC (4.25%)</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Calculate Tax</Label>
                  <p className="text-sm text-gray-600">Automatically add tax to transactions</p>
                </div>
                <Switch
                  checked={settings.financial?.auto_calculate_tax !== false}
                  onCheckedChange={(checked) => handleSettingChange('financial', 'auto_calculate_tax', checked)} />

              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Currency & Formatting</CardTitle>
              <CardDescription>Currency display and formatting preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={settings.financial?.currency || 'USD'}
                    onValueChange={(value) => handleSettingChange('financial', 'currency', value)}>

                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency-symbol">Currency Symbol</Label>
                  <Input
                    id="currency-symbol"
                    value={settings.financial?.currency_symbol || '$'}
                    onChange={(e) => handleSettingChange('financial', 'currency_symbol', e.target.value)}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="decimal-places">Decimal Places</Label>
                  <Select
                    value={String(settings.financial?.decimal_places || 2)}
                    onValueChange={(value) => handleSettingChange('financial', 'decimal_places', parseInt(value))}>

                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
              <CardDescription>Invoice numbering and formatting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix"
                    value={settings.financial?.invoice_prefix || 'INV'}
                    onChange={(e) => handleSettingChange('financial', 'invoice_prefix', e.target.value)}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="invoice-start">Starting Number</Label>
                  <Input
                    id="invoice-start"
                    type="number"
                    min="1"
                    value={settings.financial?.invoice_start_number || 1001}
                    onChange={(e) => handleSettingChange('financial', 'invoice_start_number', parseInt(e.target.value))}
                    className="rounded-2xl" />

                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Discount Authorization</CardTitle>
              <CardDescription>Role-based discount approval thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cashier-discount">Cashier Max Discount (%)</Label>
                  <Input
                    id="cashier-discount"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.financial?.discount_threshold_cashier || 5}
                    onChange={(e) => handleSettingChange('financial', 'discount_threshold_cashier', parseFloat(e.target.value))}
                    className="rounded-2xl" />

                </div>
                <div>
                  <Label htmlFor="manager-discount">Manager Max Discount (%)</Label>
                  <Input
                    id="manager-discount"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.financial?.discount_threshold_manager || 20}
                    onChange={(e) => handleSettingChange('financial', 'discount_threshold_manager', parseFloat(e.target.value))}
                    className="rounded-2xl" />

                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Payment Methods
              </CardTitle>
              <CardDescription>Enable or disable payment options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
              { key: 'cash', label: 'Cash', icon: '💵' },
              { key: 'credit_card', label: 'Credit Card', icon: '💳' },
              { key: 'debit_card', label: 'Debit Card', icon: '💳' },
              { key: 'mobile_payment', label: 'Mobile Payment', icon: '📱' },
              { key: 'gift_card', label: 'Gift Card', icon: '🎁' },
              { key: 'store_credit', label: 'Store Credit', icon: '🏪' }].
              map((method) =>
              <div key={method.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{method.icon}</span>
                    <Label>{method.label}</Label>
                  </div>
                  <Switch
                  checked={settings.payment?.[`${method.key}_enabled`] !== false}
                  onCheckedChange={(checked) => handleSettingChange('payment', `${method.key}_enabled`, checked)} />

                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Printer className="w-5 h-5 mr-2" />
                Hardware Configuration
              </CardTitle>
              <CardDescription>Cash drawer and receipt printer settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-open Cash Drawer</Label>
                    <p className="text-sm text-gray-600">Open drawer on cash transactions</p>
                  </div>
                  <Switch
                    checked={settings.payment?.auto_open_drawer !== false}
                    onCheckedChange={(checked) => handleSettingChange('payment', 'auto_open_drawer', checked)} />

                </div>

                <div>
                  <Label htmlFor="receipt-printer">Receipt Printer</Label>
                  <Select
                    value={settings.payment?.receipt_printer || 'none'}
                    onValueChange={(value) => handleSettingChange('payment', 'receipt_printer', value)}>

                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Printer</SelectItem>
                      <SelectItem value="star_tsp100">Star TSP100</SelectItem>
                      <SelectItem value="epson_tm_t20">Epson TM-T20</SelectItem>
                      <SelectItem value="generic_thermal">Generic Thermal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-print Receipts</Label>
                    <p className="text-sm text-gray-600">Automatically print after transaction</p>
                  </div>
                  <Switch
                    checked={settings.payment?.auto_print_receipt !== false}
                    onCheckedChange={(checked) => handleSettingChange('payment', 'auto_print_receipt', checked)} />

                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="i18n" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Localization
              </CardTitle>
              <CardDescription>Configure regional settings and formatting preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Current Language</Label>
                  <p className="text-sm text-gray-600">Interface display language: English</p>
                </div>
                <Badge variant="secondary" className="rounded-xl">
                  English Only
                </Badge>
              </div>

              <Separator />

              <div>
                <Label htmlFor="date-format">Date Format</Label>
                <Select
                  value={settings.i18n?.date_format || 'MM/dd/yyyy'}
                  onValueChange={(value) => handleSettingChange('i18n', 'date_format', value)}>

                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/dd/yyyy">MM/dd/yyyy (US)</SelectItem>
                    <SelectItem value="dd/MM/yyyy">dd/MM/yyyy (International)</SelectItem>
                    <SelectItem value="yyyy-MM-dd">yyyy-MM-dd (ISO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="time-format">Time Format</Label>
                <Select
                  value={settings.i18n?.time_format || '12h'}
                  onValueChange={(value) => handleSettingChange('i18n', 'time_format', value)}>

                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24 Hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency-position">Currency Symbol Position</Label>
                <Select
                  value={settings.i18n?.currency_position || 'before'}
                  onValueChange={(value) => handleSettingChange('i18n', 'currency_position', value)}>

                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before amount ($10.00)</SelectItem>
                    <SelectItem value="after">After amount (10.00$)</SelectItem>
                    <SelectItem value="before_space">Before with space ($ 10.00)</SelectItem>
                    <SelectItem value="after_space">After with space (10.00 $)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {!isAdmin &&
          <Card className="rounded-3xl border-0 shadow-sm bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <Lock className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-yellow-800">Administrator access required for security settings</span>
                </div>
              </CardContent>
            </Card>
          }

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Session & Access Control
              </CardTitle>
              <CardDescription>Configure user sessions and access policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  min="15"
                  max="1440"
                  value={settings.security?.session_timeout || 480}
                  onChange={(e) => handleSettingChange('security', 'session_timeout', parseInt(e.target.value))}
                  className="rounded-2xl"
                  disabled={!isAdmin} />

                <p className="text-xs text-gray-500 mt-1">Default: 8 hours (480 minutes)</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Force Password Change</Label>
                  <p className="text-sm text-gray-600">Require users to change password every 90 days</p>
                </div>
                <Switch
                  checked={settings.security?.force_password_change === true}
                  onCheckedChange={(checked) => handleSettingChange('security', 'force_password_change', checked)}
                  disabled={!isAdmin} />

              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Two-Factor Auth</Label>
                  <p className="text-sm text-gray-600">Require 2FA for admin accounts</p>
                </div>
                <Switch
                  checked={settings.security?.require_2fa === true}
                  onCheckedChange={(checked) => handleSettingChange('security', 'require_2fa', checked)}
                  disabled={!isAdmin} />

              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Password Policy</CardTitle>
              <CardDescription>Set password requirements and security rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="password-min-length">Minimum Length</Label>
                <Input
                  id="password-min-length"
                  type="number"
                  min="6"
                  max="32"
                  value={settings.security?.password_min_length || 8}
                  onChange={(e) => handleSettingChange('security', 'password_min_length', parseInt(e.target.value))}
                  className="rounded-2xl"
                  disabled={!isAdmin} />

              </div>

              {[
              { key: 'require_uppercase', label: 'Require Uppercase Letters' },
              { key: 'require_lowercase', label: 'Require Lowercase Letters' },
              { key: 'require_numbers', label: 'Require Numbers' },
              { key: 'require_special_chars', label: 'Require Special Characters' }].
              map((rule) =>
              <div key={rule.key} className="flex items-center justify-between">
                  <Label>{rule.label}</Label>
                  <Switch
                  checked={settings.security?.[rule.key] === true}
                  onCheckedChange={(checked) => handleSettingChange('security', rule.key, checked)}
                  disabled={!isAdmin} />

                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Audit & Logging
              </CardTitle>
              <CardDescription>System activity monitoring and retention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="audit-retention">Audit Log Retention (days)</Label>
                <Input
                  id="audit-retention"
                  type="number"
                  min="30"
                  max="365"
                  value={settings.security?.audit_log_retention || 90}
                  onChange={(e) => handleSettingChange('security', 'audit_log_retention', parseInt(e.target.value))}
                  className="rounded-2xl"
                  disabled={!isAdmin} />

              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Log Failed Login Attempts</Label>
                  <p className="text-sm text-gray-600">Track unsuccessful login attempts</p>
                </div>
                <Switch
                  checked={settings.security?.log_failed_logins !== false}
                  onCheckedChange={(checked) => handleSettingChange('security', 'log_failed_logins', checked)}
                  disabled={!isAdmin} />

              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Log Data Changes</Label>
                  <p className="text-sm text-gray-600">Track all data modifications</p>
                </div>
                <Switch
                  checked={settings.security?.log_data_changes !== false}
                  onCheckedChange={(checked) => handleSettingChange('security', 'log_data_changes', checked)}
                  disabled={!isAdmin} />

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Backup & Data Management
              </CardTitle>
              <CardDescription>Configure automatic backups and data retention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-gray-600">Automatically backup data daily</p>
                </div>
                <Switch
                  checked={settings.system?.auto_backup !== false}
                  onCheckedChange={(checked) => handleSettingChange('system', 'auto_backup', checked)} />

              </div>

              <div>
                <Label htmlFor="backup-time">Backup Time</Label>
                <Input
                  id="backup-time"
                  type="time"
                  value={settings.system?.backup_time || '02:00'}
                  onChange={(e) => handleSettingChange('system', 'backup_time', e.target.value)}
                  className="rounded-2xl" />

              </div>

              <div>
                <Label htmlFor="backup-retention">Backup Retention (days)</Label>
                <Input
                  id="backup-retention"
                  type="number"
                  min="7"
                  max="365"
                  value={settings.system?.backup_retention || 30}
                  onChange={(e) => handleSettingChange('system', 'backup_retention', parseInt(e.target.value))}
                  className="rounded-2xl" />

              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notifications
              </CardTitle>
              <CardDescription>Configure system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
              { key: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Alert when inventory runs low' },
              { key: 'high_value_transactions', label: 'High Value Transactions', desc: 'Alert for transactions over $500' },
              { key: 'failed_login_alerts', label: 'Failed Login Alerts', desc: 'Alert on suspicious login attempts' },
              { key: 'system_errors', label: 'System Error Notifications', desc: 'Alert on system errors' }].
              map((notification) =>
              <div key={notification.key} className="flex items-center justify-between">
                  <div>
                    <Label>{notification.label}</Label>
                    <p className="text-sm text-gray-600">{notification.desc}</p>
                  </div>
                  <Switch
                  checked={settings.system?.[notification.key] !== false}
                  onCheckedChange={(checked) => handleSettingChange('system', notification.key, checked)} />

                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                Integration Settings
              </CardTitle>
              <CardDescription>API keys and third-party integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email-service">Email Service API Key</Label>
                <Input
                  id="email-service"
                  type="password"
                  value={settings.system?.email_api_key || ''}
                  onChange={(e) => handleSettingChange('system', 'email_api_key', e.target.value)}
                  className="rounded-2xl"
                  placeholder="Enter API key for email notifications" />

              </div>

              <div>
                <Label htmlFor="sms-service">SMS Service API Key</Label>
                <Input
                  id="sms-service"
                  type="password"
                  value={settings.system?.sms_api_key || ''}
                  onChange={(e) => handleSettingChange('system', 'sms_api_key', e.target.value)}
                  className="rounded-2xl"
                  placeholder="Enter API key for SMS notifications" />

              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Email Notifications</Label>
                  <p className="text-sm text-gray-600">Send alerts via email</p>
                </div>
                <Switch
                  checked={settings.system?.email_notifications === true}
                  onCheckedChange={(checked) => handleSettingChange('system', 'email_notifications', checked)} />

              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SMS Notifications</Label>
                  <p className="text-sm text-gray-600">Send alerts via SMS</p>
                </div>
                <Switch
                  checked={settings.system?.sms_notifications === true}
                  onCheckedChange={(checked) => handleSettingChange('system', 'sms_notifications', checked)} />

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          {hasPermission(user?.role || '', 'manage_settings') ?
          <FileManagementSettings /> :

          <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>You don't have permission to manage file settings</p>
                </div>
              </CardContent>
            </Card>
          }
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <SettingsDataPersistence />
        </TabsContent>
      </Tabs>

      {unsavedChanges &&
      <div className="fixed bottom-6 right-6 z-50">
          <Card className="bg-white shadow-lg rounded-2xl">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium">You have unsaved changes</p>
                  <p className="text-sm text-gray-600">Don't forget to save your settings</p>
                </div>
                <Button onClick={saveSettings} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    </div>);

};

export default SettingsPage;