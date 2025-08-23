
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, Globe, Bell, Shield, User } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: false,
    darkMode: false,
    autoBackup: true
  });

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('settings')}</h1>
        <p className="text-gray-600 mt-2">Customize your application preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Profile Settings
            </CardTitle>
            <CardDescription>Manage your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={user?.name} className="rounded-2xl" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user?.email} className="rounded-2xl" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user?.role} disabled className="rounded-2xl bg-gray-100" />
            </div>
            <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
              Update Profile
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Language & Localization
            </CardTitle>
            <CardDescription>Choose your preferred language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Current Language</Label>
              <Button
                variant="outline"
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="rounded-2xl"
              >
                {language === 'en' ? 'Switch to বাংলা' : 'Switch to English'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </CardTitle>
            <CardDescription>Configure your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notifications</Label>
                <p className="text-sm text-gray-600">Receive push notifications</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Alerts</Label>
                <p className="text-sm text-gray-600">Get email notifications</p>
              </div>
              <Switch
                checked={settings.emailAlerts}
                onCheckedChange={(checked) => handleSettingChange('emailAlerts', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security & Privacy
            </CardTitle>
            <CardDescription>Security and privacy settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Backup</Label>
                <p className="text-sm text-gray-600">Automatically backup data</p>
              </div>
              <Switch
                checked={settings.autoBackup}
                onCheckedChange={(checked) => handleSettingChange('autoBackup', checked)}
              />
            </div>
            <Button variant="outline" className="w-full rounded-2xl">
              Change Password
            </Button>
            <Button variant="outline" className="w-full rounded-2xl">
              Two-Factor Authentication
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            System Preferences
          </CardTitle>
          <CardDescription>Application-wide settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Theme Settings', desc: 'Customize appearance', icon: '🎨' },
              { title: 'Data Export', desc: 'Export your data', icon: '📊' },
              { title: 'Integration', desc: 'Connect third-party apps', icon: '🔗' },
              { title: 'Advanced Options', desc: 'Power user settings', icon: '⚙️' },
              { title: 'System Logs', desc: 'View system activity', icon: '📋' },
              { title: 'Help & Support', desc: 'Get help and support', icon: '❓' }
            ].map((item, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 cursor-pointer transition-colors">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
