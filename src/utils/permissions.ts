
import { UserRole, RolePermissions } from '@/types/auth';

export const rolePermissions: RolePermissions = {
  Employee: [
  { resource: 'dashboard', actions: ['read'] },
  { resource: 'sales', actions: ['read'] },
  { resource: 'invoices', actions: ['read'] },
  { resource: 'inventory', actions: ['read'] },
  { resource: 'employee_profile', actions: ['read'] },
  { resource: 'time_tracking', actions: ['read', 'write'] }],

  Manager: [
  { resource: 'dashboard', actions: ['read'] },
  { resource: 'sales', actions: ['read', 'write'] },
  { resource: 'invoices', actions: ['read', 'write'] },
  { resource: 'purchases', actions: ['read', 'write'] },
  { resource: 'inventory', actions: ['read', 'write'] },
  { resource: 'employees', actions: ['read', 'write'] },
  { resource: 'salary', actions: ['read'] },
  { resource: 'pos', actions: ['read'] },
  { resource: 'discounts', actions: ['read'] },
  { resource: 'large_discounts', actions: ['read'] },
  { resource: 'access_pos', actions: ['read'] },
  { resource: 'apply_discounts', actions: ['write'] },
  { resource: 'employee_profiles', actions: ['read', 'write'] },
  { resource: 'employee_ids', actions: ['read', 'write'] },
  { resource: 'id_verification', actions: ['write'] },
  { resource: 'time_tracking', actions: ['read', 'write'] },
  { resource: 'time_entries', actions: ['read', 'write'] }],

  Admin: [
  { resource: 'dashboard', actions: ['read'] },
  { resource: 'sales', actions: ['read', 'write', 'delete'] },
  { resource: 'invoices', actions: ['read', 'write', 'delete'] },
  { resource: 'purchases', actions: ['read', 'write', 'delete'] },
  { resource: 'inventory', actions: ['read', 'write', 'delete'] },
  { resource: 'employees', actions: ['read', 'write', 'delete'] },
  { resource: 'salary', actions: ['read', 'write', 'delete'] },
  { resource: 'admin', actions: ['read', 'write'] },
  { resource: 'settings', actions: ['read', 'write'] },
  { resource: 'pos', actions: ['read', 'write', 'delete'] },
  { resource: 'discounts', actions: ['read', 'write'] },
  { resource: 'large_discounts', actions: ['read', 'write'] },
  { resource: 'access_pos', actions: ['read'] },
  { resource: 'apply_discounts', actions: ['write'] },
  { resource: 'employee_profiles', actions: ['read', 'write', 'delete'] },
  { resource: 'employee_ids', actions: ['read', 'write', 'delete'] },
  { resource: 'id_verification', actions: ['read', 'write'] },
  { resource: 'time_tracking', actions: ['read', 'write', 'delete'] },
  { resource: 'time_entries', actions: ['read', 'write', 'delete'] },
  { resource: 'all_employees', actions: ['read'] },
  { resource: 'view_settings', actions: ['read', 'write'] },
  { resource: 'view_deployments', actions: ['read', 'write'] }]

};

export const hasPermission = (userRole: UserRole, resource: string, action: string): boolean => {
  const permissions = rolePermissions[userRole] || [];
  return permissions.some((permission) =>
  permission.resource === resource && permission.actions.includes(action)
  );
};

export const canAccess = (userRole: UserRole, resource: string): boolean => {
  return hasPermission(userRole, resource, 'read');
};