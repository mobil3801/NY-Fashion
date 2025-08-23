import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ReactErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {this.state.error?.message || 'An unexpected error occurred'}
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 space-y-2">
            <Button onClick={this.handleReset} variant="outline">
              Try Again
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              variant="secondary">

              Reload Page
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo &&
          <details className="mt-4 p-2 bg-gray-100 rounded text-xs">
              <summary>Error Details (Development)</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error?.stack}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          }
        </div>);

    }

    return this.props.children;
  }
}

export default ReactErrorBoundary;