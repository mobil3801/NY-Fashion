
import React from 'react';
import EnhancedErrorBoundary from '@/components/error-monitoring/EnhancedErrorBoundary';
import ErrorMonitoringDashboard from '@/components/error-monitoring/ErrorMonitoringDashboard';
import { ErrorCategory } from '@/services/centralized-error-service';

const ErrorMonitoringPage: React.FC = () => {
  return (
    <EnhancedErrorBoundary
      componentName="ErrorMonitoringPage"
      category={ErrorCategory.APPLICATION}
      maxRetries={2}>

      <div className="container mx-auto">
        <ErrorMonitoringDashboard />
      </div>
    </EnhancedErrorBoundary>);

};

export default ErrorMonitoringPage;