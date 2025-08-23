
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Shield,
  Settings } from
'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { canAccess } from '@/utils/permissions';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const menuItems = [
  { icon: LayoutDashboard, label: t('dashboard'), path: '/dashboard', resource: 'dashboard' },
  { icon: ShoppingBag, label: t('sales'), path: '/sales', resource: 'sales' },
  { icon: FileText, label: t('invoices'), path: '/invoices', resource: 'invoices' },
  { icon: ShoppingCart, label: t('purchases'), path: '/purchases', resource: 'purchases' },
  { icon: Package, label: t('inventory'), path: '/inventory', resource: 'inventory' },
  { icon: Users, label: t('employees'), path: '/employees', resource: 'employees' },
  { icon: Wallet, label: t('salary'), path: '/salary', resource: 'salary' },
  { icon: Shield, label: t('admin'), path: '/admin', resource: 'admin' },
  { icon: Settings, label: t('settings'), path: '/settings', resource: 'settings' },
  { icon: ShoppingCart, label: 'Point of Sale', path: '/pos', permission: 'access_pos' as const }];


  const availableMenuItems = menuItems.filter((item) =>
  user && canAccess(user.role, item.resource)
  );

  return (
    <aside
      className="w-60 bg-white border-r shadow-sm"
      aria-label="Main navigation"
      role="navigation">
      {/* Header */}
      <div className="p-4 font-bold">NY FASHION</div>

      {/* Navigation Menu */}
      <nav className="flex flex-col space-y-2 p-4" role="list">
        {availableMenuItems.map((item) =>
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }
          role="listitem">
            <item.icon
            className="w-5 h-5 flex-shrink-0"
            aria-hidden="true" />

            <span className="truncate">{item.label}</span>
          </NavLink>
        )}
      </nav>
    </aside>);

};

export default Sidebar;