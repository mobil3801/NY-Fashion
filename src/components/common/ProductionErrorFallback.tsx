import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ProductionErrorFallbackProps {
  error?: Error;
  errorId?: string;
  resetError?: () => void;
}

const ProductionErrorFallback: React.FC<ProductionErrorFallbackProps> = ({
  error,
  errorId,
  resetError
}) => {
  const reloadPage = () => {
    window.location.reload();
  };

  const goHome = () => {
    window.location.href = '/';
  };

  const clearCacheAndReload = () => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear cache if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-xl font-semibold text-red-600">
            Application Error
          </CardTitle>
          <CardDescription className="mt-2">
            The application encountered an unexpected error and cannot continue.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button 
              onClick={resetError || reloadPage}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button 
              onClick={goHome}
              className="w-full"
              variant="outline"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Homepage
            </Button>
            
            <Button 
              onClick={clearCacheAndReload}
              className="w-full"
              variant="outline"
            >
              Clear Cache & Reload
            </Button>
          </div>

          {errorId && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600 text-center">
              <div className="font-mono">Error ID: {errorId}</div>
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded">
              <div className="text-xs text-gray-600 space-y-2">
                <div>
                  <strong>Environment:</strong> {import.meta.env.MODE || 'unknown'}
                </div>
                <div>
                  <strong>Timestamp:</strong> {new Date().toLocaleString()}
                </div>
                {error && (
                  <div>
                    <strong>Error:</strong>
                    <pre className="mt-1 text-xs text-red-600 whitespace-pre-wrap overflow-x-auto">
                      {error.message}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </details>

          <div className="text-xs text-center text-gray-500 mt-4">
            If this problem persists, please contact support.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionErrorFallback;