import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/auth/permissions';
import productionApi from '@/services/api';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';
import { useLoadingState } from '@/hooks/use-loading-state';
import { validateLogin, validateRegister } from '@/utils/validation-schemas';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (resource: string, action?: string) => boolean;
  refreshUser: () => Promise<void>;
  loginAttempts: number;
  isLocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const { isLoading, withLoading } = useLoadingState();
  
  const isAuthenticated = !!user;

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  // Load lockout state from localStorage
  useEffect(() => {
    const lockoutEnd = localStorage.getItem('auth_lockout_end');
    if (lockoutEnd) {
      const lockoutEndTime = parseInt(lockoutEnd);
      if (Date.now() < lockoutEndTime) {
        setIsLocked(true);
        const remainingTime = lockoutEndTime - Date.now();
        const timer = setTimeout(() => {
          setIsLocked(false);
          setLoginAttempts(0);
          localStorage.removeItem('auth_lockout_end');
        }, remainingTime);
        setLockoutTimer(timer);
      } else {
        localStorage.removeItem('auth_lockout_end');
      }
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (lockoutTimer) {
        clearTimeout(lockoutTimer);
      }
    };
  }, [lockoutTimer]);

  const initializeAuth = async () => {
    try {
      logger.logInfo('Initializing auth state');
      const result = await productionApi.getUserInfo();
      
      if (result.data && !result.error) {
        const userData: User = {
          id: result.data.ID,
          name: result.data.Name || result.data.Email,
          email: result.data.Email,
          role: result.data.Roles || 'GeneralUser',
          createdAt: result.data.CreateTime
        };
        
        setUser(userData);
        logger.setUserId(userData.id.toString());
        logger.logUserAction('user_session_restored', { userId: userData.id });
      }
    } catch (error) {
      // User not logged in - this is expected for non-authenticated users
      logger.logDebug('Auth initialization - user not authenticated');
    }
  };

  const login = async (credentials: LoginCredentials) => {
    if (isLocked) {
      const lockoutEnd = localStorage.getItem('auth_lockout_end');
      const remainingTime = lockoutEnd ? Math.ceil((parseInt(lockoutEnd) - Date.now()) / 60000) : 0;
      throw new Error(`Account locked due to multiple failed login attempts. Try again in ${remainingTime} minutes.`);
    }

    // Validate credentials
    const validation = validateLogin(credentials);
    if (!validation.success) {
      throw new Error(validation.error);
    }

    await withLoading(async () => {
      try {
        logger.logSecurityEvent('login_attempt', { email: credentials.email });
        
        const result = await productionApi.login(credentials);
        
        if (result.error) {
          handleFailedLogin();
          throw new Error(result.error);
        }

        // Get user info after successful login
        const userResult = await productionApi.getUserInfo();
        
        if (userResult.error || !userResult.data) {
          throw new Error('Failed to get user information after login');
        }

        const userData: User = {
          id: userResult.data.ID,
          name: userResult.data.Name || userResult.data.Email,
          email: userResult.data.Email,
          role: userResult.data.Roles || 'GeneralUser',
          createdAt: userResult.data.CreateTime
        };

        setUser(userData);
        setLoginAttempts(0);
        logger.setUserId(userData.id.toString());
        logger.logSecurityEvent('login_success', { 
          userId: userData.id, 
          email: userData.email,
          role: userData.role 
        });
        
        toast({
          title: 'Welcome back!',
          description: `Logged in as ${userData.name || userData.email}`,
          variant: 'default'
        });

      } catch (error) {
        handleFailedLogin();
        logger.logSecurityEvent('login_failed', { 
          email: credentials.email,
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: loginAttempts + 1
        });
        throw error;
      }
    });
  };

  const register = async (credentials: RegisterCredentials) => {
    // Validate credentials
    const validation = validateRegister(credentials);
    if (!validation.success) {
      throw new Error(validation.error);
    }

    await withLoading(async () => {
      try {
        logger.logSecurityEvent('registration_attempt', { email: credentials.email });
        
        const result = await productionApi.register(credentials);
        
        if (result.error) {
          throw new Error(result.error);
        }

        logger.logSecurityEvent('registration_success', { email: credentials.email });
        
        toast({
          title: 'Registration Successful',
          description: 'Please check your email to verify your account, then log in.',
          variant: 'default'
        });

      } catch (error) {
        logger.logSecurityEvent('registration_failed', { 
          email: credentials.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    });
  };

  const logout = async () => {
    await withLoading(async () => {
      try {
        const currentUserId = user?.id;
        
        await productionApi.logout();
        
        setUser(null);
        logger.logSecurityEvent('logout_success', { userId: currentUserId });
        
        toast({
          title: 'Logged out',
          description: 'You have been successfully logged out.',
          variant: 'default'
        });
        
      } catch (error) {
        // Even if logout fails on server, clear local state
        setUser(null);
        logger.logError('Logout failed', error);
        
        toast({
          title: 'Logged out',
          description: 'You have been logged out locally.',
          variant: 'default'
        });
      }
    });
  };

  const refreshUser = async () => {
    await withLoading(async () => {
      try {
        const result = await productionApi.getUserInfo();
        
        if (result.error || !result.data) {
          // User session expired
          setUser(null);
          return;
        }

        const userData: User = {
          id: result.data.ID,
          name: result.data.Name || result.data.Email,
          email: result.data.Email,
          role: result.data.Roles || 'GeneralUser',
          createdAt: result.data.CreateTime
        };

        setUser(userData);
        logger.logUserAction('user_data_refreshed', { userId: userData.id });
        
      } catch (error) {
        logger.logError('Failed to refresh user data', error);
        setUser(null);
      }
    });
  };

  const handleFailedLogin = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= PRODUCTION_CONFIG.security.maxLoginAttempts) {
      setIsLocked(true);
      const lockoutEnd = Date.now() + PRODUCTION_CONFIG.security.lockoutDuration;
      localStorage.setItem('auth_lockout_end', lockoutEnd.toString());
      
      const timer = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
        localStorage.removeItem('auth_lockout_end');
      }, PRODUCTION_CONFIG.security.lockoutDuration);
      
      setLockoutTimer(timer);
      
      logger.logSecurityEvent('account_locked', { 
        attempts: newAttempts,
        lockoutDuration: PRODUCTION_CONFIG.security.lockoutDuration
      });
      
      toast({
        title: 'Account Locked',
        description: `Too many failed login attempts. Account locked for ${Math.ceil(PRODUCTION_CONFIG.security.lockoutDuration / 60000)} minutes.`,
        variant: 'destructive'
      });
    } else {
      const remainingAttempts = PRODUCTION_CONFIG.security.maxLoginAttempts - newAttempts;
      toast({
        title: 'Login Failed',
        description: `Invalid credentials. ${remainingAttempts} attempts remaining before account lockout.`,
        variant: 'destructive'
      });
    }
  };

  const checkPermission = (resource: string, action?: string) => {
    if (!user) return false;
    return hasPermission(user.role, resource, action);
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    hasPermission: checkPermission,
    refreshUser,
    loginAttempts,
    isLocked
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};