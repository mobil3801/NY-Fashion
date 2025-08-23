
import React, { Component, ReactNode } from 'react';
import { comprehensiveErrorReporting, type ErrorContext } from '@/services/comprehensive-error-reporting';
import UserFriendlyErrorDialog from './UserFriendlyErrorDialog';
import ErrorRecoveryEngine from './ErrorRecoveryEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, MessageSquare, Shield } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  enableUserFeedback?: boolean;
  enableRecoveryEngine?: boolean;
  autoAttemptRecovery?: boolean;
  showTechnicalDetails?: boolean;
  context?: {
    component?: string;
    feature?: string;
    userId?: string;
  };
}

interface State {
  hasError: boolean;
  errorContext: ErrorContext | null;
  showErrorDialog: boolean;
  showRecoveryEngine: boolean;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
}

class ComprehensiveErrorBoundary extends Component<Props, State> {
  private errorId: string | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorContext: null,
      showErrorDialog: false,
      showRecoveryEngine: false,
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true
    };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Capture comprehensive error information
      this.errorId = await comprehensiveErrorReporting.captureError(error, {
        component: this.props.context?.component || 'ErrorBoundary',
        action: 'component_error',
        userId: this.props.context?.userId,
        severity: 'high',
        additionalData: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          feature: this.props.context?.feature,
          errorInfo
        }
      });

      // Add breadcrumb for error boundary activation
      comprehensiveErrorReporting.addBreadcrumb({
        type: 'error',
        message: `Error boundary caught: ${error.message}`,
        level: 'error',
        data: {
          component: this.props.context?.component,
          errorId: this.errorId
        }
      });

      // Set error context in state (we'll need to get it from the service)
      // For now, create a mock context - in real implementation, 
      // the service should provide a way to retrieve the captured context
      const mockErrorContext: ErrorContext = {
        errorId: this.errorId,
        timestamp: new Date().toISOString(),
        sessionId: 'current_session',
        userAgent: navigator.userAgent,
        route: window.location.pathname,
        component: this.props.context?.component || 'ErrorBoundary',
        action: 'component_error',
        browserInfo: {
          name: 'Unknown',
          version: 'Unknown',
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onlineStatus: navigator.onLine,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screenResolution: `${screen.width}x${screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`
        },
        performanceMetrics: {},
        networkStatus: {
          isOnline: navigator.onLine
        },
        errorType: 'javascript',
        severity: 'high',
        category: 'system_error',
        breadcrumbs: [],
        recoveryAttempts: 0,
        userId: this.props.context?.userId,
        stackTrace: error.stack,
        componentTree: [this.props.context?.component || 'ErrorBoundary']
      };

      this.setState({ errorContext: mockErrorContext });

      // Auto-attempt recovery if enabled
      if (this.props.autoAttemptRecovery && this.state.recoveryAttempts < this.state.maxRecoveryAttempts) {
        this.attemptAutoRecovery();
      }

    } catch (captureError) {
      console.error('Failed to capture error in boundary:', captureError);
    }
  }

  private attemptAutoRecovery = () => {
    this.setState(prev => ({
      recoveryAttempts: prev.recoveryAttempts + 1,
      showRecoveryEngine: true
    }));
  };

  private handleRecoverySuccess = () => {
    // Clear error state and hide dialogs
    this.setState({
      hasError: false,
      errorContext: null,
      showErrorDialog: false,
      showRecoveryEngine: false,
      recoveryAttempts: 0
    });
  };

  private handleRecoveryFailure = (error: Error) => {
    console.error('Recovery failed:', error);
    
    if (this.state.recoveryAttempts < this.state.maxRecoveryAttempts) {
      // Try again
      this.attemptAutoRecovery();
    } else {
      // Show user dialog as last resort
      this.setState({ showErrorDialog: true });
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      errorContext: null,
      showErrorDialog: false,
      showRecoveryEngine: false,
      recoveryAttempts: 0
    });
  };

  private handleReportIssue = () => {
    this.setState({ showErrorDialog: true });
  };

  private handleShowRecovery = () => {
    this.setState({ showRecoveryEngine: true });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show recovery engine if enabled and we have error context
      if (this.props.enableRecoveryEngine && 
          this.state.showRecoveryEngine && 
          this.state.errorContext) {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-4xl">
              <ErrorRecoveryEngine
                errorContext={this.state.errorContext}
                onRecoverySuccess={this.handleRecoverySuccess}
                onRecoveryFailure={this.handleRecoveryFailure}
                autoAttemptRecovery={this.props.autoAttemptRecovery}
              />
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" onClick={this.handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again Manually
                </Button>
                {this.props.enableUserFeedback && (
                  <Button variant="outline" onClick={this.handleReportIssue}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Report Issue
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Default error UI
      return (
        <>
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <AlertTriangle className="h-12 w-12 text-red-500" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Something went wrong
                    </h2>
                    <p className="text-sm text-gray-600">
                      An unexpected error occurred. Our team has been automatically notified.
                    </p>
                    {this.errorId && (
                      <p className="text-xs text-gray-500 font-mono">
                        Error ID: {this.errorId.slice(-12)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={this.handleRetry} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                    
                    {this.props.enableRecoveryEngine && (
                      <Button 
                        variant="outline" 
                        onClick={this.handleShowRecovery}
                        className="w-full"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Auto Recovery
                      </Button>
                    )}
                    
                    {this.props.enableUserFeedback && (
                      <Button 
                        variant="outline" 
                        onClick={this.handleReportIssue}
                        className="w-full"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Report Issue
                      </Button>
                    )}
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      If this problem persists, please contact our support team.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Dialog */}
          {this.props.enableUserFeedback && 
           this.state.showErrorDialog && 
           this.state.errorContext && (
            <UserFriendlyErrorDialog
              open={this.state.showErrorDialog}
              onOpenChange={(open) => this.setState({ showErrorDialog: open })}
              errorContext={this.state.errorContext}
              showTechnicalDetails={this.props.showTechnicalDetails}
              onRecoveryAttempt={async (suggestion) => {
                // Handle recovery attempt from dialog
                return true; // placeholder
              }}
            />
          )}
        </>
      );
    }

    return this.props.children;
  }
}

export default ComprehensiveErrorBoundary;

// Higher-order component for easy wrapping
export const withComprehensiveErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<Props, 'children'> = {}
) => {
  const WithErrorBoundary: React.FC<P> = (props) => {
    return (
      <ComprehensiveErrorBoundary {...options}>
        <WrappedComponent {...props} />
      </ComprehensiveErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `withComprehensiveErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundary;
};
