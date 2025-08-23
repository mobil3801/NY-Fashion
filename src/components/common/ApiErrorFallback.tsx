import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface ApiErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  isNetworkError?: boolean;
  title?: string;
  description?: string;
  showRetryButton?: boolean;
}

const ApiErrorFallback: React.FC<ApiErrorFallbackProps> = ({
  error,
  onRetry,
  isNetworkError = false,
  title,
  description,
  showRetryButton = true
}) => {
  const defaultTitle = isNetworkError ?
  'Network Connection Error' :
  title || 'Unable to Load Data';

  const defaultDescription = isNetworkError ?
  'Please check your internet connection and try again.' :
  description || 'There was a problem loading the data. Please try again.';

  const Icon = isNetworkError ? WifiOff : AlertTriangle;
  const iconColor = isNetworkError ? 'text-orange-500' : 'text-red-500';

  return (
    <Card className="p-6 mx-auto max-w-md">
      <div className="text-center">
        <Icon className={`mx-auto h-12 w-12 mb-4 ${iconColor}`} />
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {defaultTitle}
        </h3>
        
        <p className="text-gray-600 mb-4">
          {defaultDescription}
        </p>

        {/* Development-only error details */}
        {(import.meta.env.DEV || import.meta.env.NODE_ENV === 'development') && error &&
        <Alert className="mb-4 text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs overflow-x-auto text-gray-600">
                  {error.message}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        }

        {showRetryButton &&
        <Button
          onClick={onRetry}
          variant="default"
          className="w-full">

            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        }
      </div>
    </Card>);

};

export default ApiErrorFallback;

// Hook for using the API error fallback
export const useApiErrorHandler = () => {
  const handleError = React.useCallback((error: unknown, context?: string) => {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

    // Check if it's a network error
    const isNetworkError = error instanceof Error && (
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('connection'));


    return {
      isNetworkError,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }, []);

  return { handleError };
};