
import React from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/contexts/DebugContext';
import { ApiError } from '@/lib/errors';

interface DebugToastProps {
  error: ApiError;
  operation: string;
  attempt?: number;
  maxAttempts?: number;
  onRetry?: () => void;
}

const DebugToast: React.FC<DebugToastProps> = ({
  error,
  operation,
  attempt = 1,
  maxAttempts = 3,
  onRetry
}) => {
  const { debugSettings } = useDebug();

  // Only show enhanced toasts in debug mode
  if (!debugSettings.enabled || process.env.NODE_ENV === 'production') {
    return null;
  }

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'abort':
        return <RefreshCw className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const canRetry = attempt < maxAttempts && error.type !== 'abort';

  return (
    <div className="flex flex-col gap-2 p-2 min-w-0">
      <div className="flex items-center gap-2">
        {getErrorIcon()}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{operation}</div>
          <div className="text-xs text-gray-600 truncate">
            {error.message}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {attempt}/{maxAttempts}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Type: {error.type}
        </div>
        {canRetry && onRetry &&
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="text-xs h-6">

            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        }
      </div>
    </div>);

};

/**
 * Enhanced toast function for debug mode
 */
export function showDebugToast(
error: ApiError,
operation: string,
options: {
  attempt?: number;
  maxAttempts?: number;
  onRetry?: () => void;
} = {})
{
  const { toast } = useToast();

  // Show regular toast for production or when debug is disabled
  if (process.env.NODE_ENV === 'production') {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
    return;
  }

  // Show enhanced debug toast
  toast({
    title: `API Error: ${operation}`,
    description: React.createElement(DebugToast, {
      error,
      operation,
      ...options
    }),
    variant: "destructive",
    duration: error.type === 'network' ? 10000 : 5000 // Longer for network errors
  });
}

export default DebugToast;