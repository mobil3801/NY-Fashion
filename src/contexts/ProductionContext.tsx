import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';
import { enhancedToast } from '@/utils/enhanced-toast';
import { productionApi } from '@/services/production-api';

interface User {
  ID: number;
  Name: string;
  Email: string;
  CreateTime: string;
  Roles: string;
}

interface ProductionContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (userData: { name: string; email: string; password: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  isOnline: boolean;
  lastSync: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

interface ProductionProviderProps {
  children: ReactNode;
}

export const ProductionProvider: React.FC<ProductionProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');

  // Initialize user session on app start
  useEffect(() => {
    initializeSession();
    
    // Set up online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      logger.logInfo('Application came online');
      enhancedToast.showInfoToast('Connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      logger.logWarn('Application went offline');
      enhancedToast.showWarningToast('You are now offline. Some features may be limited.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up periodic sync if enabled
    let syncInterval: NodeJS.Timeout;
    if (PRODUCTION_CONFIG.sync.enableAutoSync) {
      syncInterval = setInterval(() => {
        if (isOnline && isAuthenticated) {
          performBackgroundSync();
        }
      }, PRODUCTION_CONFIG.sync.syncInterval);
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isAuthenticated, isOnline]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      logger.logInfo('Initializing user session');
      
      const result = await productionApi.getUserInfo();
      
      if (result.error) {
        // User not authenticated, clear any stored auth state
        setUser(null);
        setIsAuthenticated(false);
        logger.logInfo('No authenticated user found');
      } else {
        setUser(result.data);
        setIsAuthenticated(true);
        logger.logInfo('User session restored', { userId: result.data.ID, email: result.data.Email });
      }
      
      setError(null);
    } catch (error) {
      logger.logError('Failed to initialize session', error);
      setError('Failed to initialize application');
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
      
      const result = await productionApi.login(credentials);
      
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
      
      // Fetch user info after successful login
      await refreshUser();
      
      logger.logUserAction('User logged in', { email: credentials.email });
      
    } catch (error) {
      logger.logError('Login failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: { name: string; email: string; password: string; role?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await productionApi.register(userData);
      
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
      
      logger.logUserAction('User registered', { email: userData.email });
      
    } catch (error) {
      logger.logError('Registration failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      logger.logUserAction('User logout initiated');
      
      const result = await productionApi.logout();
      
      if (result.error) {
        logger.logError('Logout failed', result.error);
        // Even if logout fails, clear local state
      }
      
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setLastSync(null);
      setSyncStatus('idle');
      
      logger.logUserAction('User logged out');
      
    } catch (error) {
      logger.logError('Logout error', error);
      // Clear local state regardless of API call result
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const result = await productionApi.getUserInfo();
      
      if (result.error) {
        logger.logError('Failed to refresh user info', result.error);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      
      setUser(result.data);
      setIsAuthenticated(true);
      logger.logInfo('User info refreshed', { userId: result.data.ID });
      
    } catch (error) {
      logger.logError('Failed to refresh user', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const performBackgroundSync = async () => {
    if (syncStatus === 'syncing') return; // Already syncing
    
    try {
      setSyncStatus('syncing');
      logger.logInfo('Starting background sync');
      
      // Perform any necessary data synchronization here
      // This could include:
      // - Sync offline changes
      // - Update cached data
      // - Validate data integrity
      
      // For now, we'll just update the last sync time
      setLastSync(new Date());
      setSyncStatus('success');
      
      logger.logInfo('Background sync completed');
      
    } catch (error) {
      logger.logError('Background sync failed', error);
      setSyncStatus('error');
    }
  };

  const contextValue: ProductionContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
    isOnline,
    lastSync,
    syncStatus
  };

  return (
    <ProductionContext.Provider value={contextValue}>
      {children}
    </ProductionContext.Provider>
  );
};

export const useProduction = (): ProductionContextType => {
  const context = useContext(ProductionContext);
  if (context === undefined) {
    throw new Error('useProduction must be used within a ProductionProvider');
  }
  return context;
};

// Hook for checking authentication status
export const useAuth = () => {
  const { user, isAuthenticated, isLoading } = useProduction();
  return { user, isAuthenticated, isLoading };
};

// Hook for auth operations
export const useAuthOperations = () => {
  const { login, register, logout, refreshUser } = useProduction();
  return { login, register, logout, refreshUser };
};

export default ProductionProvider;