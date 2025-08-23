
import React, { useEffect, useRef } from 'react';
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useResponsive } from '@/hooks/use-responsive';
import { canAccess } from '@/utils/permissions';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarRef = useRef<HTMLElement>(null);
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);

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
    { icon: ShoppingCart, label: 'Point of Sale', path: '/pos', permission: 'access_pos' as const }
  ];

  const availableMenuItems = menuItems.filter((item) =>
    user && canAccess(user.role, item.resource)
  );

  // Handle keyboard navigation and focus management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onToggle();
      }
    };

    const handleFocusTrap = (event: KeyboardEvent) => {
      if (!isOpen || !sidebarRef.current) return;

      const focusableElements = sidebarRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleFocusTrap);
      
      // Focus first element when sidebar opens
      setTimeout(() => {
        firstFocusableElementRef.current?.focus();
      }, 100);

      // Prevent body scroll on mobile
      if (isMobile || isTablet) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleFocusTrap);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onToggle, isMobile, isTablet]);

  const handleNavClick = () => {
    if (isMobile || isTablet) {
      onClose?.() || onToggle();
    }
  };

  const shouldShowSidebar = isDesktop || isOpen;

  return (
    <aside
      ref={sidebarRef}
      id="sidebar-navigation"
      className={cn(
        "fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 shadow-xl sidebar-scrollbar overflow-y-auto transition-all duration-300 ease-in-out",
        isDesktop ? "lg:translate-x-0 lg:static lg:z-auto lg:shadow-none" : "",
        shouldShowSidebar ? "translate-x-0" : "-translate-x-full"
      )}
      aria-label="Main navigation"
      role="navigation"
      aria-hidden={!shouldShowSidebar}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">NY</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">NY FASHION</h1>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>
        {!isDesktop && (
          <Button
            ref={firstFocusableElementRef}
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 focus:ring-2 focus:ring-emerald-500 focus-visible"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="px-4 py-6 space-y-2" role="list">
        {availableMenuItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-4 py-3 rounded-2xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus-visible",
                isActive && "bg-emerald-100 text-emerald-700 font-medium shadow-sm border border-emerald-200"
              )
            }
            onClick={handleNavClick}
            role="listitem"
            tabIndex={isOpen ? 0 : -1}
          >
            <item.icon 
              className="w-5 h-5 transition-transform duration-200 group-hover:scale-105 flex-shrink-0" 
              aria-hidden="true" 
            />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info Card */}
      <div className="absolute bottom-6 left-4 right-4">
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-2xl p-4 shadow-sm border border-emerald-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-800 truncate">Welcome!</p>
              <p className="text-xs text-emerald-600 mt-1 truncate" title={user?.name}>
                {user?.name}
              </p>
              <span className="inline-block text-xs bg-emerald-200 text-emerald-700 px-2 py-1 rounded-lg mt-1">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
