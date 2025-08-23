
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Plus, Search, Filter } from 'lucide-react';

const InvoicesPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('invoices')}</h1>
          <p className="text-gray-600 mt-2">Manage your invoices and billing</p>
        </div>
        <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <Button variant="outline" className="rounded-2xl">
          <Filter className="w-4 h-4 mr-2" />
          {t('filter')}
        </Button>
      </div>

      <Card className="rounded-3xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Invoice Management</CardTitle>
          <CardDescription>Create and manage invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-12 h-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Invoice system coming soon</h3>
            <p className="text-gray-600">This feature will help you create and manage invoices for your customers.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPage;
