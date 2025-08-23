
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
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight } from
'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { canAccess } from '@/utils/permissions';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
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
    <>
      {/* Mobile Backdrop */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onToggle} />

      }

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">NY</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">NY FASHION</h1>
              <p className="text-xs text-gray-500">Management System</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="lg:hidden p-1 hover:bg-gray-100 rounded-xl">

            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="px-4 space-y-2">
          {availableMenuItems.map((item) =>
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
            cn(
              "flex items-center space-x-3 px-4 py-3 rounded-2xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors",
              isActive && "bg-emerald-100 text-emerald-700 font-medium"
            )
            }
            onClick={() => window.innerWidth < 1024 && onToggle()}>

              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          )}
        </nav>

        <div className="absolute bottom-6 left-4 right-4">
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-sm font-medium text-emerald-800">Welcome!</p>
            <p className="text-xs text-emerald-600 mt-1">{user?.name}</p>
            <p className="text-xs text-emerald-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </>);

};

export default Sidebar;