
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Permission,
  Role,
  normalizeRole,
  hasPermission,
  getRolePermissions,
  hasAnyPermission,
  hasAllPermissions,
  getRoleLabel } from
'./permissions';

interface UsePermissionsReturn {
  /** Normalized user role */
  role: Role;
  /** Display label for role */
  roleLabel: string;
  /** All permissions for current role */
  permissions: Permission[];
  /** Check if user has specific permission */
  can: (permission: Permission) => boolean;
  /** Check if user has any of the permissions */
  canAny: (permissions: Permission[]) => boolean;
  /** Check if user has all permissions */
  canAll: (permissions: Permission[]) => boolean;
  /** Check if user is admin */
  isAdmin: boolean;
  /** Check if user is manager or admin */
  isManagerOrAdmin: boolean;
}

/**
 * Unified permissions hook
 * Normalizes roles from AuthContext and provides permission checking
 * This should be the single source of truth for permission checks
 */
export function usePermissions(): UsePermissionsReturn {
  const { user, isAuthenticated } = useAuth();

  const role = useMemo(() => {
    if (!isAuthenticated || !user?.role) {
      return normalizeRole(null); // Returns 'employee' as secure default
    }
    return normalizeRole(user.role);
  }, [isAuthenticated, user?.role]);

  const roleLabel = useMemo(() => getRoleLabel(role), [role]);

  const permissions = useMemo(() => getRolePermissions(role), [role]);

  const can = useMemo(() =>
  (permission: Permission) => hasPermission(role, permission),
  [role]
  );

  const canAny = useMemo(() =>
  (perms: Permission[]) => hasAnyPermission(role, perms),
  [role]
  );

  const canAll = useMemo(() =>
  (perms: Permission[]) => hasAllPermissions(role, perms),
  [role]
  );

  const isAdmin = useMemo(() => role === 'admin', [role]);

  const isManagerOrAdmin = useMemo(() =>
  role === 'admin' || role === 'manager',
  [role]
  );

  return {
    role,
    roleLabel,
    permissions,
    can,
    canAny,
    canAll,
    isAdmin,
    isManagerOrAdmin
  };
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermissions<T extends object>(
Component: React.ComponentType<T>,
requiredPermissions: Permission | Permission[],
fallback?: React.ReactNode)
{
  return function PermissionWrappedComponent(props: T) {
    const { can, canAny } = usePermissions();

    const hasAccess = Array.isArray(requiredPermissions) ?
    canAny(requiredPermissions) :
    can(requiredPermissions);

    if (!hasAccess) {
      return fallback ? <>{fallback}</> : null;
    }

    return <Component {...props} />;
  };
}