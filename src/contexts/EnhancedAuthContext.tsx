import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { productionApi } from '@/services/production-api';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';
import { enhancedToast } from '@/utils/enhanced-toast';
import { validateLogin, validateRegister } from '@/utils/validation-schemas';

interface User {
  ID: number;
  Name: string;
  Email: string;
  CreateTime: string;
  Roles: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (userData: { name: string; email: string; password: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  getRoles: () => string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const EnhancedAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      logger.logInfo('Initializing authentication');

      const result = await productionApi.getUserInfo();

      if (result.error) {
        // Not authenticated
        setUser(null);
        setIsAuthenticated(false);
        logger.logInfo('No authenticated user found');
      } else {
        setUser(result.data);
        setIsAuthenticated(true);
        logger.logUserAction('User session restored', {
          userId: result.data.ID,
          email: result.data.Email,
          roles: result.data.Roles
        });
      }

      setError(null);
    } catch (error: any) {
      logger.logError('Auth initialization failed', error);
      setError('Failed to initialize authentication');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: { email: string; password: string }) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate input
      const validation = validateLogin(credentials);
      if (!validation.success) {
        const errorMessages = validation.error.errors.map(err => err.message);
        enhancedToast.showValidationErrorToast(errorMessages);
        throw new Error(errorMessages.join(', '));
      }

      logger.logUserAction('Login attempt started', { email: credentials.email });

      const result = await productionApi.login(credentials);

      if (result.error) {
        setError(result.error);
        logger.logError('Login failed', result.error, { email: credentials.email });
        throw new Error(result.error);
      }

      // Fetch user info after successful login
      await refreshUser();

      logger.logUserAction('Login successful', {
        userId: user?.ID,
        email: credentials.email
      });

    } catch (error: any) {
      logger.logError('Login error', error, { email: credentials.email });
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: { name: string; email: string; password: string; role?: string }) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate input
      const validation = validateRegister(userData);
      if (!validation.success) {
        const errorMessages = validation.error.errors.map(err => err.message);
        enhancedToast.showValidationErrorToast(errorMessages);
        throw new Error(errorMessages.join(', '));
      }

      logger.logUserAction('Registration attempt started', { email: userData.email });

      const result = await productionApi.register(userData);

      if (result.error) {
        setError(result.error);
        logger.logError('Registration failed', result.error, { email: userData.email });
        throw new Error(result.error);
      }

      logger.logUserAction('Registration successful', { email: userData.email });

    } catch (error: any) {
      logger.logError('Registration error', error, { email: userData.email });
      setError(error.message || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      logger.logUserAction('Logout initiated', { userId: user?.ID });

      const result = await productionApi.logout();

      // Clear local state regardless of API response
      setUser(null);
      setIsAuthenticated(false);
      setError(null);

      if (result.error) {
        logger.logWarn('Logout API failed, but local state cleared', result.error);
      } else {
        logger.logUserAction('Logout successful', { userId: user?.ID });
      }

    } catch (error: any) {
      logger.logError('Logout error', error, { userId: user?.ID });
      // Still clear local state on error
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      logger.logInfo('Refreshing user data');

      const result = await productionApi.getUserInfo();

      if (result.error) {
        logger.logError('Failed to refresh user data', result.error);
        setUser(null);
        setIsAuthenticated(false);
        setError('Session expired');
        return;
      }

      setUser(result.data);
      setIsAuthenticated(true);
      setError(null);

      logger.logInfo('User data refreshed', {
        userId: result.data.ID,
        email: result.data.Email
      });

    } catch (error: any) {
      logger.logError('Refresh user error', error);
      setUser(null);
      setIsAuthenticated(false);
      setError('Failed to refresh user data');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const getRoles = (): string[] => {
    if (!user || !user.Roles) return [];
    return user.Roles.split(',').map(role => role.trim()).filter(Boolean);
  };

  const hasRole = (role: string): boolean => {
    const userRoles = getRoles();
    return userRoles.includes(role) || userRoles.includes('Administrator');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const roles = getRoles();
    
    // Administrator has all permissions
    if (roles.includes('Administrator')) return true;

    // Define role-based permissions
    const rolePermissions: Record<string, string[]> = {
      'GeneralUser': [
        'view_dashboard',
        'view_inventory',
        'view_sales',
        'create_sale',
        'use_pos'
      ],
      'Manager': [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
        'view_sales',
        'create_sale',
        'edit_sale',
        'delete_sale',
        'view_employees',
        'use_pos',
        'manage_customers'
      ],
      'Administrator': ['*'] // All permissions
    };

    return roles.some(role => {
      const permissions = rolePermissions[role] || [];
      return permissions.includes('*') || permissions.includes(permission);
    });
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
    hasPermission,
    hasRole,
    getRoles
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useEnhancedAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};

// Convenience hooks
export const useAuthUser = () => {
  const { user, isAuthenticated, isLoading } = useEnhancedAuth();
  return { user, isAuthenticated, isLoading };
};

export const useAuthOperations = () => {
  const { login, register, logout, refreshUser } = useEnhancedAuth();
  return { login, register, logout, refreshUser };
};

export const useAuthPermissions = () => {
  const { hasPermission, hasRole, getRoles } = useEnhancedAuth();
  return { hasPermission, hasRole, getRoles };
};

export default EnhancedAuthProvider;