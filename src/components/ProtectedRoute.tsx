
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canAccess } from '@/utils/permissions';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  resource?: string;
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  resource,
  fallback = <Navigate to="/login" replace />
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Temporarily bypass auth for testing layout - REMOVE IN PRODUCTION
  const testUser = {
    id: '1',
    email: 'admin@nyfashion.com',
    name: 'Admin User',
    role: 'Admin' as const,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-96" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  // For layout testing, use test user if no auth
  const currentUser = user || testUser;
  const isCurrentlyAuthenticated = isAuthenticated || true; // Allow testing

  if (!isCurrentlyAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (resource && !canAccess(currentUser.role, resource)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
