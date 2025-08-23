
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, ShoppingBag, Package, Users } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const stats = [
    {
      title: t('totalSales'),
      value: '$24,500',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
    {
      title: t('totalOrders'),
      value: '156',
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: t('inventory'),
      value: '1,234',
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: t('employees'),
      value: '48',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard')}
        </h1>
        <p className="text-gray-600 mt-2">
          Welcome back, {user?.name}! Here's your overview.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="rounded-3xl border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-2xl ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Your recent sales activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="font-medium">Sale #{1000 + item}</p>
                    <p className="text-sm text-gray-600">Customer {item}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${(Math.random() * 1000).toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Today</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'New Sale', desc: 'Create new sale', color: 'bg-emerald-100 text-emerald-700' },
                { title: 'Add Product', desc: 'Add to inventory', color: 'bg-blue-100 text-blue-700' },
                { title: 'View Reports', desc: 'Sales analytics', color: 'bg-purple-100 text-purple-700' },
                { title: 'Manage Staff', desc: 'Employee tasks', color: 'bg-orange-100 text-orange-700' }
              ].map((action, index) => (
                <div key={index} className={`p-4 rounded-2xl cursor-pointer hover:scale-105 transition-transform ${action.color}`}>
                  <h3 className="font-medium">{action.title}</h3>
                  <p className="text-sm opacity-80">{action.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
