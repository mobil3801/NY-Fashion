
import { describe, it, expect, vi } from 'vitest';
import {
  Role,
  Permission,
  normalizeRole,
  hasPermission,
  getRolePermissions,
  hasAnyPermission,
  hasAllPermissions,
  getRoleLabel,
  RoleLabels
} from './permissions';

describe('Auth Permissions System', () => {
  describe('normalizeRole', () => {
    it('should normalize admin roles correctly', () => {
      expect(normalizeRole('admin')).toBe('admin');
      expect(normalizeRole('ADMIN')).toBe('admin');
      expect(normalizeRole('Admin')).toBe('admin');
      expect(normalizeRole('administrator')).toBe('admin');
      expect(normalizeRole('ADMINISTRATOR')).toBe('admin');
    });

    it('should normalize manager roles correctly', () => {
      expect(normalizeRole('manager')).toBe('manager');
      expect(normalizeRole('MANAGER')).toBe('manager');
      expect(normalizeRole('Manager')).toBe('manager');
      expect(normalizeRole('supervisor')).toBe('manager');
      expect(normalizeRole('SUPERVISOR')).toBe('manager');
    });

    it('should normalize employee roles correctly', () => {
      expect(normalizeRole('employee')).toBe('employee');
      expect(normalizeRole('EMPLOYEE')).toBe('employee');
      expect(normalizeRole('Employee')).toBe('employee');
      expect(normalizeRole('staff')).toBe('employee');
      expect(normalizeRole('viewer')).toBe('employee');
      expect(normalizeRole('user')).toBe('employee');
    });

    it('should handle edge cases with secure defaults', () => {
      expect(normalizeRole(null)).toBe('employee');
      expect(normalizeRole(undefined)).toBe('employee');
      expect(normalizeRole('')).toBe('employee');
      expect(normalizeRole('   ')).toBe('employee');
      expect(normalizeRole('unknown_role')).toBe('employee');
      expect(normalizeRole('random')).toBe('employee');
    });

    it('should log warning for unknown roles', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      normalizeRole('unknown_role');
      expect(consoleSpy).toHaveBeenCalledWith('Unknown role "unknown_role" normalized to "employee"');
      consoleSpy.mockRestore();
    });

    it('should handle non-string inputs', () => {
      // @ts-expect-error Testing runtime behavior
      expect(normalizeRole(123)).toBe('employee');
      // @ts-expect-error Testing runtime behavior
      expect(normalizeRole({})).toBe('employee');
      // @ts-expect-error Testing runtime behavior
      expect(normalizeRole([])).toBe('employee');
    });
  });

  describe('hasPermission', () => {
    it('should correctly check admin permissions', () => {
      expect(hasPermission('admin', 'admin:system')).toBe(true);
      expect(hasPermission('admin', 'edit:sales')).toBe(true);
      expect(hasPermission('admin', 'view:dashboard')).toBe(true);
      expect(hasPermission('admin', 'delete:invoices')).toBe(true);
    });

    it('should correctly check manager permissions', () => {
      expect(hasPermission('manager', 'view:dashboard')).toBe(true);
      expect(hasPermission('manager', 'edit:sales')).toBe(true);
      expect(hasPermission('manager', 'edit:inventory')).toBe(true);
      expect(hasPermission('manager', 'admin:system')).toBe(false);
      expect(hasPermission('manager', 'delete:invoices')).toBe(false);
      expect(hasPermission('manager', 'edit:salary')).toBe(false);
    });

    it('should correctly check employee permissions', () => {
      expect(hasPermission('employee', 'view:dashboard')).toBe(true);
      expect(hasPermission('employee', 'view:sales')).toBe(true);
      expect(hasPermission('employee', 'view:inventory')).toBe(true);
      expect(hasPermission('employee', 'edit:sales')).toBe(false);
      expect(hasPermission('employee', 'admin:system')).toBe(false);
      expect(hasPermission('employee', 'delete:invoices')).toBe(false);
    });

    it('should normalize roles before checking permissions', () => {
      expect(hasPermission('ADMIN', 'admin:system')).toBe(true);
      expect(hasPermission('Manager', 'edit:sales')).toBe(true);
      expect(hasPermission('EMPLOYEE', 'view:dashboard')).toBe(true);
    });

    it('should handle invalid roles securely', () => {
      expect(hasPermission(null, 'view:dashboard')).toBe(true); // defaults to employee
      expect(hasPermission(undefined, 'edit:sales')).toBe(false); // defaults to employee
      expect(hasPermission('invalid', 'admin:system')).toBe(false); // defaults to employee
    });
  });

  describe('getRolePermissions', () => {
    it('should return all admin permissions', () => {
      const permissions = getRolePermissions('admin');
      expect(permissions).toContain('admin:system');
      expect(permissions).toContain('edit:sales');
      expect(permissions).toContain('delete:invoices');
      expect(permissions.length).toBeGreaterThan(20);
    });

    it('should return manager permissions', () => {
      const permissions = getRolePermissions('manager');
      expect(permissions).toContain('view:dashboard');
      expect(permissions).toContain('edit:sales');
      expect(permissions).not.toContain('admin:system');
      expect(permissions).not.toContain('delete:invoices');
    });

    it('should return employee permissions', () => {
      const permissions = getRolePermissions('employee');
      expect(permissions).toContain('view:dashboard');
      expect(permissions).toContain('view:sales');
      expect(permissions).not.toContain('edit:sales');
      expect(permissions).not.toContain('admin:system');
    });

    it('should return a copy of permissions array', () => {
      const permissions1 = getRolePermissions('admin');
      const permissions2 = getRolePermissions('admin');
      expect(permissions1).not.toBe(permissions2); // Different references
      expect(permissions1).toEqual(permissions2); // Same content
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if role has any of the permissions', () => {
      expect(hasAnyPermission('admin', ['admin:system', 'unknown:permission'])).toBe(true);
      expect(hasAnyPermission('manager', ['edit:sales', 'admin:system'])).toBe(true);
      expect(hasAnyPermission('employee', ['view:dashboard', 'edit:sales'])).toBe(true);
    });

    it('should return false if role has none of the permissions', () => {
      expect(hasAnyPermission('employee', ['edit:sales', 'admin:system'])).toBe(false);
      expect(hasAnyPermission('manager', ['admin:system', 'delete:invoices'])).toBe(false);
    });

    it('should handle empty permissions array', () => {
      expect(hasAnyPermission('admin', [])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      expect(hasAllPermissions('admin', ['view:dashboard', 'edit:sales'])).toBe(true);
      expect(hasAllPermissions('manager', ['view:dashboard', 'edit:inventory'])).toBe(true);
      expect(hasAllPermissions('employee', ['view:dashboard', 'view:sales'])).toBe(true);
    });

    it('should return false if role is missing any permission', () => {
      expect(hasAllPermissions('employee', ['view:dashboard', 'edit:sales'])).toBe(false);
      expect(hasAllPermissions('manager', ['edit:sales', 'admin:system'])).toBe(false);
    });

    it('should handle empty permissions array', () => {
      expect(hasAllPermissions('admin', [])).toBe(true);
    });
  });

  describe('getRoleLabel', () => {
    it('should return correct labels for all roles', () => {
      expect(getRoleLabel('admin')).toBe('Admin');
      expect(getRoleLabel('manager')).toBe('Manager');
      expect(getRoleLabel('employee')).toBe('Employee');
    });

    it('should handle case-insensitive input', () => {
      expect(getRoleLabel('ADMIN')).toBe('Admin');
      expect(getRoleLabel('Manager')).toBe('Manager');
      expect(getRoleLabel('EMPLOYEE')).toBe('Employee');
    });

    it('should default to Employee label for invalid roles', () => {
      expect(getRoleLabel('invalid')).toBe('Employee');
      expect(getRoleLabel(null)).toBe('Employee');
      expect(getRoleLabel(undefined)).toBe('Employee');
    });
  });

  describe('RoleLabels mapping', () => {
    it('should have correct label mappings', () => {
      expect(RoleLabels.admin).toBe('Admin');
      expect(RoleLabels.manager).toBe('Manager');
      expect(RoleLabels.employee).toBe('Employee');
    });

    it('should have all role types covered', () => {
      const roles: Role[] = ['admin', 'manager', 'employee'];
      roles.forEach(role => {
        expect(RoleLabels[role]).toBeDefined();
        expect(typeof RoleLabels[role]).toBe('string');
        expect(RoleLabels[role].length).toBeGreaterThan(0);
      });
    });
  });

  describe('Permission hierarchy validation', () => {
    it('should ensure admin has more permissions than manager', () => {
      const adminPerms = getRolePermissions('admin');
      const managerPerms = getRolePermissions('manager');
      
      expect(adminPerms.length).toBeGreaterThan(managerPerms.length);
      
      // Manager permissions should be subset of admin
      managerPerms.forEach(perm => {
        expect(adminPerms).toContain(perm);
      });
    });

    it('should ensure manager has more permissions than employee', () => {
      const managerPerms = getRolePermissions('manager');
      const employeePerms = getRolePermissions('employee');
      
      expect(managerPerms.length).toBeGreaterThan(employeePerms.length);
      
      // Employee permissions should be subset of manager
      employeePerms.forEach(perm => {
        expect(managerPerms).toContain(perm);
      });
    });

    it('should ensure proper permission escalation', () => {
      const adminPerms = getRolePermissions('admin');
      const managerPerms = getRolePermissions('manager');
      const employeePerms = getRolePermissions('employee');
      
      expect(adminPerms.length).toBeGreaterThan(managerPerms.length);
      expect(managerPerms.length).toBeGreaterThan(employeePerms.length);
      
      // Admin should have exclusive permissions
      const adminOnlyPerms = adminPerms.filter(p => !managerPerms.includes(p));
      expect(adminOnlyPerms.length).toBeGreaterThan(0);
      expect(adminOnlyPerms).toContain('admin:system');
      
      // Manager should have exclusive permissions not available to employee
      const managerOnlyPerms = managerPerms.filter(p => !employeePerms.includes(p));
      expect(managerOnlyPerms.length).toBeGreaterThan(0);
      expect(managerOnlyPerms).toContain('edit:sales');
    });
  });

  describe('Type safety', () => {
    it('should have proper TypeScript types', () => {
      const role: Role = 'admin';
      const permission: Permission = 'view:dashboard';
      
      expect(typeof role).toBe('string');
      expect(typeof permission).toBe('string');
      expect(hasPermission(role, permission)).toBeDefined();
    });
  });
});
