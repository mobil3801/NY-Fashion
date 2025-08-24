import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNetwork } from '@/contexts/NetworkContext';
import { useErrorRecovery } from '@/hooks/use-error-recovery';
import { useApiRetry } from '@/hooks/use-api-retry';
import { normalizeError } from '@/lib/errors';
import { toast } from '@/hooks/use-toast';

interface ContentLoaderProps {
  children: React.ReactNode;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  fallback?: React.ReactNode;
  minimumLoadTime?: number;
}

export function ContentLoader({
  children,
  loading = false,
  error = null,
  onRetry,
  fallback,
  minimumLoadTime = 300
}: ContentLoaderProps) {
  // Client-side only state
  const [isClient, setIsClient] = useState(false);
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only proceed with network-dependent logic on client side
  if (!isClient) {
    return loading ? (
      <LoadingSkeleton />
    ) : error ? (
      <ErrorFallback error={error} onRetry={onRetry} />
    ) : (
      <>{children}</>
    );
  }

  return (
    <SmartContentLoader
      loading={loading}
      error={error}
      onRetry={onRetry}
      fallback={fallback}
      minimumLoadTime={minimumLoadTime}>
      {children}
    </SmartContentLoader>
  );
}

function SmartContentLoader({
  children,
  loading,
  error,
  onRetry,
  fallback,
  minimumLoadTime
}: ContentLoaderProps) {
  const { online, connectionState } = useNetwork();
  const { retry: autoRetry, canRetry, lastError } = useErrorRecovery();
  const { executeWithRetry, abortAll } = useApiRetry();
  
  const [internalLoading, setInternalLoading] = useState(loading);
  const [showError, setShowError] = useState(!!error);
  const [retryCount, setRetryCount] = useState(0);

  // Minimum load time enforcement
  useEffect(() => {
    if (loading) {
      setInternalLoading(true);
      const timeout = setTimeout(() => {
        if (!loading) {
          setInternalLoading(false);
        }
      }, minimumLoadTime);

      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setInternalLoading(false);
      }, Math.max(0, minimumLoadTime - 100));

      return () => clearTimeout(timeout);
    }
  }, [loading, minimumLoadTime]);

  // Error state management
  useEffect(() => {
    setShowError(!!error);
  }, [error]);

  // Auto-retry for network errors
  useEffect(() => {
    if (error && online && canRetry && retryCount < 3) {
      const networkError = normalizeError(error);
      if (networkError.isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        const timeout = setTimeout(() => {
          handleRetry(true);
        }, delay);

        return () => clearTimeout(timeout);
      }
    }
  }, [error, online, canRetry, retryCount]);

  const handleRetry = async (isAutoRetry = false) => {
    if (!isAutoRetry) {
      setRetryCount(prev => prev + 1);
    }

    setShowError(false);
    setInternalLoading(true);

    try {
      if (onRetry) {
        await executeWithRetry(async () => {
          await onRetry();
        });
      } else if (autoRetry) {
        await autoRetry();
      } else {
        // Default retry: reload the page
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }

      toast({
        title: "Success",
        description: "Content loaded successfully",
        variant: "default"
      });

    } catch (retryError) {
      console.error('Retry failed:', retryError);
      setShowError(true);
      
      const normalizedError = normalizeError(retryError);
      toast({
        title: "Retry Failed",
        description: normalizedError.userMessage,
        variant: "destructive"
      });
    } finally {
      setInternalLoading(false);
    }
  };

  // Show loading state
  if (internalLoading || loading) {
    return fallback || <LoadingSkeleton />;
  }

  // Show error state
  if (showError || error) {
    return (
      <ErrorFallback 
        error={error || lastError} 
        onRetry={() => handleRetry(false)}
        retryCount={retryCount}
        online={online}
        connectionState={connectionState}
      />
    );
  }

  // Show content
  return <>{children}</>;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
      <div className="h-32 bg-gray-200 rounded"></div>
    </div>
  );
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  retryCount?: number;
  online?: boolean;
  connectionState?: string;
}

function ErrorFallback({ 
  error, 
  onRetry, 
  retryCount = 0,
  online = true,
  connectionState = 'online'
}: ErrorFallbackProps) {
  const getErrorIcon = () => {
    if (!online || connectionState === 'offline') {
      return <Wifi className="h-8 w-8 text-gray-400" />;
    }
    return <AlertCircle className="h-8 w-8 text-red-500" />;
  };

  const getErrorMessage = () => {
    if (!online || connectionState === 'offline') {
      return "No internet connection";
    }

    if (error) {
      const normalizedError = normalizeError(error);
      return normalizedError.userMessage;
    }

    return "Something went wrong";
  };

  const getErrorDescription = () => {
    if (!online || connectionState === 'offline') {
      return "Please check your internet connection and try again.";
    }

    return "Unable to load content. Please try again.";
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {getErrorIcon()}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">
                {getErrorMessage()}
              </h3>
              <p className="text-sm text-gray-600">
                {getErrorDescription()}
              </p>
              
              {retryCount > 0 && (
                <p className="text-xs text-gray-500">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>

            {onRetry && (
              <Button onClick={onRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { SmartContentLoader, ContentLoader as default };