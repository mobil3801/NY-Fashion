
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff } from
'lucide-react';
import { cn } from '@/lib/utils';
import PRODUCTION_CONFIG from '@/config/production';

interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;

  // Loading customization
  loadingMessage?: string;
  loadingProgress?: number;
  showSkeleton?: boolean;
  skeletonRows?: number;

  // Error handling
  onRetry?: () => void;
  maxRetries?: number;
  currentRetries?: number;

  // Timeout handling
  timeout?: number;
  onTimeout?: () => void;

  // Offline handling
  isOffline?: boolean;
  showOfflineMessage?: boolean;

  // Success state
  showSuccess?: boolean;
  successMessage?: string;

  // Layout
  variant?: 'card' | 'inline' | 'page' | 'overlay';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  isLoading,
  error,
  children,
  loadingMessage = 'Loading...',
  loadingProgress,
  showSkeleton = false,
  skeletonRows = 3,
  onRetry,
  maxRetries = 3,
  currentRetries = 0,
  timeout = PRODUCTION_CONFIG.api.timeout,
  onTimeout,
  isOffline = !navigator.onLine,
  showOfflineMessage = true,
  showSuccess = false,
  successMessage = 'Loaded successfully',
  variant = 'inline',
  size = 'md',
  className
}: LoadingStateProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading && timeout > 0) {
      timeoutId = setTimeout(() => {
        setTimeoutReached(true);
        onTimeout?.();
      }, timeout);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      setTimeoutReached(false);
    };
  }, [isLoading, timeout, onTimeout]);

  useEffect(() => {
    if (showSuccess && !isLoading && !error) {
      setShowSuccessState(true);
      const timer = setTimeout(() => setShowSuccessState(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, isLoading, error]);

  const sizeClasses = {
    sm: 'text-sm p-2',
    md: 'text-base p-4',
    lg: 'text-lg p-6'
  };

  const renderSkeleton = () =>
  <div className="space-y-3">
      {Array.from({ length: skeletonRows }).map((_, index) =>
    <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
    )}
    </div>;


  const renderLoadingContent = () =>
  <div className={cn(
    'flex flex-col items-center justify-center space-y-4',
    sizeClasses[size]
  )}>
      <div className="flex items-center space-x-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-medium">{loadingMessage}</span>
      </div>
      
      {loadingProgress !== undefined &&
    <div className="w-full max-w-xs space-y-2">
          <Progress value={loadingProgress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {loadingProgress}% complete
          </p>
        </div>
    }
      
      {timeoutReached &&
    <Alert variant="destructive" className="w-full max-w-md">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This is taking longer than expected. You can continue waiting or try again.
          </AlertDescription>
        </Alert>
    }
      
      {isOffline && showOfflineMessage &&
    <Alert variant="destructive" className="w-full max-w-md">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You appear to be offline. Some features may not work properly.
          </AlertDescription>
        </Alert>
    }
      
      {showSkeleton &&
    <div className="w-full max-w-md">
          {renderSkeleton()}
        </div>
    }
    </div>;


  const renderErrorContent = () =>
  <div className={cn(
    'flex flex-col items-center justify-center space-y-4',
    sizeClasses[size]
  )}>
      <Alert variant="destructive" className="w-full max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      
      {onRetry &&
    <div className="flex flex-col items-center space-y-2">
          <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        disabled={currentRetries >= maxRetries}>

            <RefreshCw className="h-4 w-4 mr-2" />
            Retry ({maxRetries - currentRetries} left)
          </Button>
          
          {currentRetries > 0 &&
      <Badge variant="secondary">
              Attempt {currentRetries + 1} of {maxRetries + 1}
            </Badge>
      }
        </div>
    }
      
      {isOffline &&
    <Alert className="w-full max-w-md">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Check your internet connection and try again.
          </AlertDescription>
        </Alert>
    }
    </div>;


  const renderSuccessContent = () =>
  <Alert className="w-full max-w-md border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        {successMessage}
      </AlertDescription>
    </Alert>;


  // Show success state briefly
  if (showSuccessState) {
    if (variant === 'inline') {
      return renderSuccessContent();
    }
    if (variant === 'card') {
      return (
        <Card className={className}>
          <CardContent className="p-6">
            {renderSuccessContent()}
          </CardContent>
        </Card>);

    }
  }

  // Show error state
  if (error) {
    const errorContent = renderErrorContent();

    switch (variant) {
      case 'card':
        return (
          <Card className={className}>
            <CardContent>
              {errorContent}
            </CardContent>
          </Card>);

      case 'page':
        return (
          <div className={cn(
            'min-h-screen flex items-center justify-center p-4',
            className
          )}>
            {errorContent}
          </div>);

      case 'overlay':
        return (
          <div className={cn(
            'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
            className
          )}>
            {errorContent}
          </div>);

      default:
        return errorContent;
    }
  }

  // Show loading state
  if (isLoading) {
    const loadingContent = renderLoadingContent();

    switch (variant) {
      case 'card':
        return (
          <Card className={className}>
            <CardContent>
              {loadingContent}
            </CardContent>
          </Card>);

      case 'page':
        return (
          <div className={cn(
            'min-h-screen flex items-center justify-center p-4',
            className
          )}>
            {loadingContent}
          </div>);

      case 'overlay':
        return (
          <div className={cn(
            'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
            className
          )}>
            {loadingContent}
          </div>);

      default:
        return loadingContent;
    }
  }

  // Show content when loaded
  return <>{children}</>;
}

// Specialized loading components
export function PageLoadingState(props: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState {...props} variant="page" />;
}

export function CardLoadingState(props: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState {...props} variant="card" />;
}

export function OverlayLoadingState(props: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState {...props} variant="overlay" />;
}

export function SkeletonLoadingState(props: Omit<LoadingStateProps, 'showSkeleton'>) {
  return <LoadingState {...props} showSkeleton={true} />;
}

export default LoadingState;