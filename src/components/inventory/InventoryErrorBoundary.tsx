
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Activity,
  Bug,
  ExternalLink
} from 'lucide-react';
import { inventoryClient } from '@/lib/network/inventory-client';

interface InventoryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  networkDiagnostics: any;
  retryCount: number;
}

interface InventoryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    resetError: () => void;
    retry: () => void;
  }>;
}

export default class InventoryErrorBoundary extends React.Component<
  InventoryErrorBoundaryProps,
  InventoryErrorBoundaryState
> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: InventoryErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      networkDiagnostics: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<InventoryErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[InventoryErrorBoundary] Error caught:', error);
    console.error('[InventoryErrorBoundary] Error info:', errorInfo);

    // Capture network diagnostics
    const networkDiagnostics = this.captureNetworkDiagnostics();

    this.setState({
      error,
      errorInfo,
      networkDiagnostics
    });

    // Log error for monitoring
    this.logError(error, errorInfo, networkDiagnostics);
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private captureNetworkDiagnostics() {
    try {
      return {
        online: navigator.onLine,
        connection: (navigator as any).connection ? {
          type: (navigator as any).connection.type,
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : null,
        activeRequests: inventoryClient.getActiveRequests(),
        errorHistory: inventoryClient.getErrorDiagnostics(),
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
    } catch (error) {
      console.warn('Failed to capture network diagnostics:', error);
      return null;
    }
  }

  private logError(error: Error, errorInfo: React.ErrorInfo, networkDiagnostics: any) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      networkDiagnostics,
      timestamp: Date.now(),
      retryCount: this.state.retryCount
    };

    // Store in localStorage for debugging
    try {
      const errorLog = JSON.parse(localStorage.getItem('inventory-error-log') || '[]');
      errorLog.push(errorReport);
      
      // Keep only last 10 errors
      if (errorLog.length > 10) {
        errorLog.shift();
      }
      
      localStorage.setItem('inventory-error-log', JSON.stringify(errorLog));
    } catch (error) {
      console.warn('Failed to store error log:', error);
    }

    // In production, you might want to send this to a monitoring service
    console.error('[InventoryErrorBoundary] Full error report:', errorReport);
  }

  private handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount >= 3) {
      // Too many retries, suggest page reload
      this.handleReload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      networkDiagnostics: null,
      retryCount: retryCount + 1
    });

    // Auto-retry after a delay for network errors
    if (this.isNetworkError(this.state.error)) {
      this.retryTimeout = setTimeout(() => {
        if (this.state.hasError) {
          this.handleRetry();
        }
      }, Math.pow(2, retryCount) * 1000); // Exponential backoff
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      networkDiagnostics: null,
      retryCount: 0
    });
  };

  private isNetworkError(error: Error | null): boolean {
    if (!error) return false;
    
    const networkKeywords = [
      'network', 'fetch', 'connection', 'timeout', 
      'dns', 'cors', 'offline', 'failed to fetch'
    ];
    
    return networkKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  private getErrorType(error: Error | null): string {
    if (!error) return 'Unknown';
    
    if (this.isNetworkError(error)) return 'Network';
    if (error.name === 'ChunkLoadError') return 'Code Loading';
    if (error.message.includes('React')) return 'Component';
    if (error.message.includes('inventory')) return 'Inventory';
    
    return 'Application';
  }

  private getErrorSeverity(error: Error | null): 'low' | 'medium' | 'high' | 'critical' {
    if (!error) return 'medium';
    
    if (this.isNetworkError(error)) return 'medium';
    if (error.name === 'ChunkLoadError') return 'high';
    if (error.message.includes('Cannot read properties')) return 'high';
    if (this.state.retryCount > 2) return 'critical';
    
    return 'medium';
  }

  private getSeverityColor(severity: string) {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  private exportDiagnostics = () => {
    const diagnostics = {
      error: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        name: this.state.error?.name
      },
      errorInfo: this.state.errorInfo,
      networkDiagnostics: this.state.networkDiagnostics,
      retryCount: this.state.retryCount,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-error-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      const { error, networkDiagnostics, retryCount } = this.state;
      const errorType = this.getErrorType(error);
      const severity = this.getErrorSeverity(error);
      const isOnline = navigator.onLine;

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={error!} 
            resetError={this.handleReset}
            retry={this.handleRetry}
          />
        );
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full space-y-6">
            {/* Main Error Card */}
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                    <div>
                      <CardTitle className="text-red-800">
                        Inventory System Error
                      </CardTitle>
                      <CardDescription className="text-red-700">
                        Something went wrong while loading the inventory system
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={this.getSeverityColor(severity)}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Error Type:</span>
                  <Badge variant="outline">{errorType}</Badge>
                  {retryCount > 0 && (
                    <>
                      <span className="text-sm font-medium">Retries:</span>
                      <Badge variant="secondary">{retryCount}</Badge>
                    </>
                  )}
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="font-mono text-sm">
                    {error?.message || 'An unknown error occurred'}
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={this.handleRetry}
                    disabled={retryCount >= 3}
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={this.handleReload}
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Reload Page
                  </Button>

                  <Button
                    variant="outline"
                    onClick={this.exportDiagnostics}
                    size="sm"
                  >
                    Export Diagnostics
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Network Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-600" />
                  )}
                  Network Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Connection:</span>
                    <Badge 
                      variant={isOnline ? 'default' : 'destructive'}
                      className="ml-2"
                    >
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  
                  {networkDiagnostics?.connection && (
                    <>
                      <div>
                        <span className="font-medium">Type:</span>
                        <span className="ml-2">
                          {networkDiagnostics.connection.effectiveType || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Speed:</span>
                        <span className="ml-2">
                          {networkDiagnostics.connection.downlink || 'Unknown'} Mbps
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Latency:</span>
                        <span className="ml-2">
                          {networkDiagnostics.connection.rtt || 'Unknown'}ms
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {networkDiagnostics?.activeRequests?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4" />
                      <span className="font-medium text-sm">Active Requests:</span>
                      <Badge variant="outline">
                        {networkDiagnostics.activeRequests.length}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Try these steps to resolve the issue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div>• Check your internet connection</div>
                  <div>• Refresh the page to reload the application</div>
                  <div>• Clear browser cache and cookies</div>
                  <div>• Try again in a few minutes</div>
                  <div>• Contact support if the problem persists</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
