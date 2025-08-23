
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  // Test user for layout testing - REMOVE IN PRODUCTION
  const testUser = {
    id: '1',
    email: 'admin@nyfashion.com',
    name: 'Admin User',
    role: 'Admin' as const,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
  };

  const [authState, setAuthState] = useState<AuthState>({
    user: testUser,
    isLoading: true,
    isAuthenticated: true
  });
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('nyf_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true
        });
      } catch (error) {
        localStorage.removeItem('nyf_user');
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      // Mock authentication - In real app, call your API
      const mockUser: User = {
        id: '1',
        email: credentials.email,
        name: credentials.email === 'admin@nyfashion.com' ? 'Admin User' : 'Demo User',
        role: credentials.email === 'admin@nyfashion.com' ? 'Admin' :
        credentials.email.includes('manager') ? 'Manager' : 'Employee',
        avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face`
      };

      localStorage.setItem('nyf_user', JSON.stringify(mockUser));
      setAuthState({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true
      });

      toast({
        title: "Login Successful",
        description: `Welcome back, ${mockUser.name}!`
      });
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      // Mock registration
      const newUser: User = {
        id: Date.now().toString(),
        email: credentials.email,
        name: credentials.name,
        role: credentials.role || 'Employee',
        avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face`
      };

      localStorage.setItem('nyf_user', JSON.stringify(newUser));
      setAuthState({
        user: newUser,
        isLoading: false,
        isAuthenticated: true
      });

      toast({
        title: "Registration Successful",
        description: `Welcome to NY FASHION, ${newUser.name}!`
      });
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      toast({
        title: "Registration Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('nyf_user');
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false
    });
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out."
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout }}>
      {children}
    </AuthContext.Provider>);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};