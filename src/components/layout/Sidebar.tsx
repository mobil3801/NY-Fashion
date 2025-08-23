
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
  X } from
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

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose} />

      }
      
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r shadow-sm flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold">NY FASHION</h2>
          </div>
          
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="lg:hidden p-2">

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
                  'px-3 py-3 lg:py-2 rounded-lg flex items-center space-x-3 transition-colors duration-200',
                  isActive ?
                  'bg-emerald-100 text-emerald-800' :
                  'text-gray-700 hover:bg-gray-100'
                )}>

                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>);

          })}
        </nav>
      </aside>
    </>);

};

export default Sidebar;