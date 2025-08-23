import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface SimpleLoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'dots';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const SimpleLoadingState: React.FC<SimpleLoadingStateProps> = ({
  type = 'spinner',
  message = 'Loading...',
  size = 'md',
  fullScreen = false
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClass = fullScreen ?
  'fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50' :
  'flex items-center justify-center p-8';

  const renderContent = () => {
    switch (type) {
      case 'skeleton':
        return (
          <Card className="p-6 w-full max-w-md">
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </Card>);


      case 'dots':
        return (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            </div>
            {message &&
            <p className="text-sm text-gray-600">{message}</p>
            }
          </div>);


      case 'spinner':
      default:
        return (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
            {message &&
            <p className="text-sm text-gray-600">{message}</p>
            }
          </div>);

    }
  };

  return (
    <div className={containerClass}>
      {renderContent()}
    </div>);

};

export default SimpleLoadingState;

// Hook for managing loading states
export const useLoadingState = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);

  const startLoading = React.useCallback(() => setIsLoading(true), []);
  const stopLoading = React.useCallback(() => setIsLoading(false), []);
  const toggleLoading = React.useCallback(() => setIsLoading((prev) => !prev), []);

  return {
    isLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    setIsLoading
  };
};

// Component for wrapping content with loading state
export const LoadingWrapper: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  loadingProps?: SimpleLoadingStateProps;
}> = ({
  isLoading,
  children,
  loadingComponent,
  loadingProps
}) => {
  if (isLoading) {
    return loadingComponent || <SimpleLoadingState {...loadingProps} />;
  }

  return <>{children}</>;
};