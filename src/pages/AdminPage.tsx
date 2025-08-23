
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, Plus, Search, Filter } from 'lucide-react';

const AdminPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin')}</h1>
          <p className="text-gray-600 mt-2">System administration and management</p>
        </div>
        <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Admin Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'User Management', desc: 'Manage system users', color: 'bg-emerald-100 text-emerald-700' },
          { title: 'System Settings', desc: 'Configure system', color: 'bg-blue-100 text-blue-700' },
          { title: 'Backup & Restore', desc: 'Data management', color: 'bg-purple-100 text-purple-700' },
          { title: 'Security Logs', desc: 'Monitor security', color: 'bg-orange-100 text-orange-700' },
          { title: 'System Reports', desc: 'Generate reports', color: 'bg-red-100 text-red-700' },
          { title: 'Audit Trail', desc: 'Track changes', color: 'bg-indigo-100 text-indigo-700' }
        ].map((item, index) => (
          <Card key={index} className="rounded-3xl border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${item.color}`}>
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Administration Panel</CardTitle>
          <CardDescription>Advanced system management tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-12 h-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Admin tools coming soon</h3>
            <p className="text-gray-600">Advanced administrative features for system management.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;
