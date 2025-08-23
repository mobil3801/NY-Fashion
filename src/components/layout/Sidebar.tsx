
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
  Network,
  TestTube,
  Activity,
  AlertTriangle,
  Rocket } from
'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/auth/usePermissions';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { can, isAdmin } = usePermissions();

  const menuItems = [
  { icon: LayoutDashboard, label: t('dashboard'), path: '/dashboard', permission: 'view:dashboard' as const },
  { icon: ShoppingBag, label: t('sales'), path: '/sales', permission: 'view:sales' as const },
  { icon: FileText, label: t('invoices'), path: '/invoices', permission: 'view:invoices' as const },
  { icon: ShoppingCart, label: t('purchases'), path: '/purchases', permission: 'view:purchases' as const },
  { icon: Package, label: t('inventory'), path: '/inventory', permission: 'view:inventory' as const },
  { icon: Users, label: t('employees'), path: '/employees', permission: 'view:employees' as const },
  { icon: Wallet, label: t('salary'), path: '/salary', permission: 'view:salary' as const },
  { icon: Shield, label: t('admin'), path: '/admin', permission: 'admin:system' as const },
  { icon: Settings, label: t('settings'), path: '/settings', permission: 'view:settings' as const },
  { icon: ShoppingCart, label: 'Point of Sale', path: '/pos', permission: 'view:sales' as const }];


  const availableMenuItems = menuItems.filter((item) =>
  can(item.permission)
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
        {isAdmin &&
        <NavLink
          to="/debug/network"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <Network className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{t('debug.title')}</span>
          </NavLink>
        }
        {isAdmin &&
        <NavLink
          to="/performance"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <Activity className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{t('Performance')}</span>
          </NavLink>
        }
        {isAdmin &&
        <NavLink
          to="/testing"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <TestTube className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">API Testing</span>
          </NavLink>
        }
        {isAdmin &&
        <NavLink
          to="/errors"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Error Monitoring</span>
          </NavLink>
        }
        {isAdmin &&
        <NavLink
          to="/performance-monitoring"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <Activity className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Performance</span>
          </NavLink>
        }
        {isAdmin &&
        <NavLink
          to="/deployment-control"
          className={({ isActive }) =>
          cn(
            "px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-200",
            isActive && "bg-emerald-100 text-emerald-800"
          )
          }>
            <Rocket className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Deployment Control</span>
          </NavLink>
        }
      </nav>
    </aside>);

};

export default Sidebar;