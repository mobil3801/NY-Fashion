import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  X,
  CreditCard } from
'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { canAccess } from '@/utils/permissions';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, className }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const menuItems = [
  { icon: LayoutDashboard, label: t('dashboard', 'Dashboard'), path: '/dashboard', resource: 'dashboard' },
  { icon: CreditCard, label: 'Point of Sale', path: '/pos', resource: 'sales' },
  { icon: ShoppingBag, label: t('sales', 'Sales'), path: '/sales', resource: 'sales' },
  { icon: FileText, label: t('invoices', 'Invoices'), path: '/invoices', resource: 'invoices' },
  { icon: ShoppingCart, label: t('purchases', 'Purchases'), path: '/purchases', resource: 'purchases' },
  { icon: Package, label: t('inventory', 'Inventory'), path: '/inventory', resource: 'inventory' },
  { icon: Users, label: t('employees', 'Employees'), path: '/employees', resource: 'employees' },
  { icon: Wallet, label: t('salary', 'Payroll'), path: '/salary', resource: 'salary' },
  { icon: Shield, label: t('admin', 'Admin'), path: '/admin', resource: 'admin' },
  { icon: Settings, label: t('settings', 'Settings'), path: '/settings', resource: 'settings' }];


  const availableMenuItems = menuItems.filter((item) =>
  user && canAccess(user.role, item.resource)
  );

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-lg flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center space-x-3">
            <img
              src="https://cdn.ezsite.ai/AutoDev/19016/bb4a2cd5-b101-49df-bd0d-eeb788f55077.jpg"
              alt="Logo"
              className="h-8 w-8 rounded object-contain bg-white p-1" />

            <div>
              <h2 className="font-bold text-lg">NY FASHION</h2>
              <p className="text-xs text-blue-100">Business Management</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="lg:hidden p-2 text-white hover:bg-white/20 touch-manipulation"
            aria-label="Close sidebar">

            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 flex flex-col space-y-1 p-4 overflow-y-auto">
          {availableMenuItems.map((item) => {
            const isActive = location.pathname === item.path ||
            item.path !== '/dashboard' && location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={cn(
                  'px-4 py-3 rounded-lg flex items-center space-x-3 transition-all duration-200 touch-manipulation',
                  isActive ?
                  'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm' :
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}>

                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium truncate">{item.label}</span>
                {isActive &&
                <div className="w-2 h-2 bg-blue-600 rounded-full ml-auto"></div>
                }
              </NavLink>);

          })}
        </nav>
        
        {/* User info at bottom */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>);

};

export default Sidebar;