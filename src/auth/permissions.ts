
/**
 * Unified Authorization System
 * - Roles: admin, manager, employee (lowercase internally)
 * - Normalizes legacy and mixed-case inputs
 * - Secure defaults (unknown roles → employee)
 */

export type Role = 'admin' | 'manager' | 'employee';

export type Permission = 
  | 'view:dashboard'
  | 'view:sales' 
  | 'view:inventory'
  | 'view:products'
  | 'view:invoices'
  | 'view:purchases'
  | 'view:employees'
  | 'view:salary'
  | 'view:reports'
  | 'view:settings'
  | 'view:lowstock'
  | 'edit:sales'
  | 'edit:inventory'
  | 'edit:products'
  | 'edit:invoices'
  | 'edit:purchases'
  | 'edit:employees'
  | 'edit:salary'
  | 'edit:settings'
  | 'delete:sales'
  | 'delete:inventory'
  | 'delete:products'
  | 'delete:invoices'
  | 'admin:users'
  | 'admin:roles'
  | 'admin:system';

// Display labels for UI (Title case)
export const RoleLabels: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager', 
  employee: 'Employee'
};

// Permission mappings for each role
const RolePermissions: Record<Role, Permission[]> = {
  admin: [
    // Full access - all permissions
    'view:dashboard',
    'view:sales',
    'view:inventory', 
    'view:products',
    'view:invoices',
    'view:purchases',
    'view:employees',
    'view:salary',
    'view:reports',
    'view:settings',
    'view:lowstock',
    'edit:sales',
    'edit:inventory',
    'edit:products', 
    'edit:invoices',
    'edit:purchases',
    'edit:employees',
    'edit:salary',
    'edit:settings',
    'delete:sales',
    'delete:inventory',
    'delete:products',
    'delete:invoices',
    'admin:users',
    'admin:roles',
    'admin:system'
  ],
  manager: [
    // View all + edit core business functions
    'view:dashboard',
    'view:sales',
    'view:inventory',
    'view:products', 
    'view:invoices',
    'view:purchases',
    'view:employees',
    'view:salary',
    'view:reports',
    'view:lowstock',
    'edit:sales',
    'edit:inventory',
    'edit:products',
    'edit:invoices',
    'edit:purchases'
  ],
  employee: [
    // Read-only access to basic operations
    'view:dashboard',
    'view:sales',
    'view:inventory',
    'view:products',
    'view:invoices', 
    'view:lowstock'
  ]
};

/**
 * Normalizes role input to standard lowercase format
 * Maps legacy roles and mixed-case inputs
 * @param input - Role string (any case)
 * @returns Normalized Role or 'employee' as secure default
 */
export function normalizeRole(input: string | undefined | null): Role {
  if (!input || typeof input !== 'string') {
    return 'employee'; // Secure default
  }

  const normalized = input.toLowerCase().trim();
  
  // Direct mappings
  switch (normalized) {
    case 'admin':
    case 'administrator':
      return 'admin';
    case 'manager':
    case 'supervisor':
      return 'manager';
    case 'employee':
    case 'staff':
    case 'viewer':
    case 'user':
      return 'employee';
    default:
      // Unknown roles default to employee (secure default)
      console.warn(`Unknown role "${input}" normalized to "employee"`);
      return 'employee';
  }
}

/**
 * Checks if a role has a specific permission
 * @param role - User role (will be normalized)
 * @param permission - Permission to check
 * @returns true if role has permission
 */
export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const normalizedRole = normalizeRole(role);
  const permissions = RolePermissions[normalizedRole];
  return permissions.includes(permission);
}

/**
 * Gets all permissions for a role
 * @param role - User role (will be normalized) 
 * @returns Array of permissions
 */
export function getRolePermissions(role: string | undefined | null): Permission[] {
  const normalizedRole = normalizeRole(role);
  return [...RolePermissions[normalizedRole]]; // Return copy
}

/**
 * Checks if role has any of the specified permissions
 * @param role - User role
 * @param permissions - Array of permissions to check
 * @returns true if role has at least one permission
 */
export function hasAnyPermission(role: string | undefined | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Checks if role has all specified permissions
 * @param role - User role
 * @param permissions - Array of permissions to check
 * @returns true if role has all permissions
 */
export function hasAllPermissions(role: string | undefined | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Gets the display label for a role
 * @param role - User role (will be normalized)
 * @returns Display label (Title case)
 */
export function getRoleLabel(role: string | undefined | null): string {
  const normalizedRole = normalizeRole(role);
  return RoleLabels[normalizedRole];
}
