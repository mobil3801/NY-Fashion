import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';
import { cn } from '@/lib/utils';

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
  category?: string;
}

interface ErrorToastOptions extends Omit<ToastOptions, 'title'> {
  error?: Error | string;
  showRetry?: boolean;
  onRetry?: () => void;
  errorId?: string;
}

class EnhancedToast {
  private toastHook: ReturnType<typeof useToast> | null = null;

  // Initialize toast hook (called from a React component)
  initialize(toastHook: ReturnType<typeof useToast>) {
    this.toastHook = toastHook;
  }

  private getToast() {
    if (!this.toastHook) {
      // Fallback to console logging if toast hook not available
      return null;
    }
    return this.toastHook;
  }

  showErrorToast(message: string, options: ErrorToastOptions = {}) {
    const toast = this.getToast();

    const errorMessage = this.formatErrorMessage(message, options.error);
    const errorCategory = this.categorizeError(message, options.error);

    logger.logError('Toast error displayed', options.error, {
      message,
      category: errorCategory,
      errorId: options.errorId
    });

    if (!toast) {
      console.error(`[TOAST ERROR] ${errorMessage}`);
      return;
    }

    const toastConfig: any = {
      title: "Error",
      description: errorMessage,
      variant: "destructive" as const,
      duration: options.persistent ? Infinity : options.duration || 5000
    };

    if (options.showRetry && options.onRetry) {
      toastConfig.action = React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: options.onRetry,
        className: "ml-2"
      }, "Retry");
    } else if (options.action) {
      toastConfig.action = React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: options.action.onClick,
        className: "ml-2"
      }, options.action.label);
    }

    toast.toast(toastConfig);

    // Log to production monitoring if enabled
    if (PRODUCTION_CONFIG.monitoring.enableErrorTracking) {
      this.sendErrorTelemetry(errorMessage, options.error, errorCategory);
    }
  }

  showSuccessToast(message: string, options: Omit<ToastOptions, 'title'> = {}) {
    const toast = this.getToast();

    logger.logInfo('Success toast displayed', { message, category: options.category });

    if (!toast) {
      console.log(`[TOAST SUCCESS] ${message}`);
      return;
    }

    const toastConfig: any = {
      title: "Success",
      description: message,
      variant: "default",
      duration: options.duration || 3000,
      className: "border-green-200 bg-green-50 text-green-800"
    };

    if (options.action) {
      toastConfig.action = React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: options.action.onClick,
        className: "ml-2"
      }, options.action.label);
    }

    toast.toast(toastConfig);
  }

  showWarningToast(message: string, options: Omit<ToastOptions, 'title'> = {}) {
    const toast = this.getToast();

    logger.logWarn('Warning toast displayed', { message, category: options.category });

    if (!toast) {
      console.warn(`[TOAST WARNING] ${message}`);
      return;
    }

    const toastConfig: any = {
      title: "Warning",
      description: message,
      variant: "default",
      duration: options.duration || 4000,
      className: "border-yellow-200 bg-yellow-50 text-yellow-800"
    };

    if (options.action) {
      toastConfig.action = React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: options.action.onClick,
        className: "ml-2"
      }, options.action.label);
    }

    toast.toast(toastConfig);
  }

  showInfoToast(message: string, options: Omit<ToastOptions, 'title'> = {}) {
    const toast = this.getToast();

    logger.logInfo('Info toast displayed', { message, category: options.category });

    if (!toast) {
      console.info(`[TOAST INFO] ${message}`);
      return;
    }

    const toastConfig: any = {
      title: "Information",
      description: message,
      variant: "default",
      duration: options.duration || 3000,
      className: "border-blue-200 bg-blue-50 text-blue-800"
    };

    if (options.action) {
      toastConfig.action = React.createElement(Button, {
        variant: "outline",
        size: "sm",
        onClick: options.action.onClick,
        className: "ml-2"
      }, options.action.label);
    }

    toast.toast(toastConfig);
  }

  showLoadingToast(message: string, options: Omit<ToastOptions, 'title'> = {}) {
    const toast = this.getToast();

    if (!toast) {
      console.log(`[TOAST LOADING] ${message}`);
      return null;
    }

    const { dismiss } = toast.toast({
      title: "Loading",
      description: message,
      variant: "default",
      duration: Infinity,
      className: "border-gray-200 bg-gray-50"
    });

    return {
      dismiss,
      update: (newMessage: string) => {
        dismiss();
        return this.showLoadingToast(newMessage, options);
      }
    };
  }

  showNetworkErrorToast(error?: Error | string, options: Omit<ErrorToastOptions, 'error'> = {}) {
    this.showErrorToast(
      "Network connection error. Please check your internet connection.",
      {
        ...options,
        error,
        showRetry: true,
        category: 'network',
        onRetry: options.onRetry || (() => window.location.reload())
      }
    );
  }

  showApiErrorToast(error?: Error | string, options: Omit<ErrorToastOptions, 'error'> = {}) {
    const message = this.getApiErrorMessage(error);

    this.showErrorToast(message, {
      ...options,
      error,
      category: 'api',
      showRetry: true
    });
  }

  showValidationErrorToast(errors: string[] | Record<string, string>) {
    let message: string;

    if (Array.isArray(errors)) {
      message = errors.join(', ');
    } else {
      message = Object.values(errors).join(', ');
    }

    this.showErrorToast("Please fix the following issues:", {
      description: message,
      category: 'validation'
    });
  }

  private formatErrorMessage(message: string, error?: Error | string): string {
    if (!error) return message;

    if (typeof error === 'string') {
      return `${message}: ${error}`;
    }

    if (error instanceof Error) {
      // Don't expose technical error details in production
      if (PRODUCTION_CONFIG.development.enableDebugMode) {
        return `${message}: ${error.message}`;
      }

      // Return user-friendly message in production
      return this.getUserFriendlyMessage(error, message);
    }

    return message;
  }

  private getUserFriendlyMessage(error: Error, fallback: string): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }

    if (errorMessage.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    if (errorMessage.includes('unauthorized') || errorMessage.includes('403')) {
      return 'You don\'t have permission to perform this action.';
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return 'The requested resource was not found.';
    }

    if (errorMessage.includes('server') || errorMessage.includes('500')) {
      return 'Server error. Please try again later.';
    }

    return fallback;
  }

  private getApiErrorMessage(error?: Error | string): string {
    if (!error) return 'An unexpected error occurred.';

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return this.getUserFriendlyMessage(error, 'API request failed. Please try again.');
    }

    return 'An unexpected error occurred.';
  }

  categorizeError(message: string, error?: Error | string): string {
    if (!error) return 'general';

    const errorText = (typeof error === 'string' ? error : error.message || '').toLowerCase();

    if (errorText.includes('network') || errorText.includes('fetch') || errorText.includes('connection')) {
      return 'network';
    }

    if (errorText.includes('timeout')) {
      return 'timeout';
    }

    if (errorText.includes('auth') || errorText.includes('unauthorized') || errorText.includes('forbidden')) {
      return 'auth';
    }

    if (errorText.includes('validation') || errorText.includes('invalid')) {
      return 'validation';
    }

    if (errorText.includes('server') || errorText.includes('500')) {
      return 'server';
    }

    if (errorText.includes('not found') || errorText.includes('404')) {
      return 'not_found';
    }

    return 'general';
  }

  private async sendErrorTelemetry(message: string, error?: Error | string, category = 'general') {
    try {
      // In a real production environment, send this to your error tracking service
      const errorData = {
        message,
        error: typeof error === 'string' ? error : error?.message,
        category,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: (logger as any).userId // Assuming logger has userId
      };

      // For now, we'll use the production logger
      logger.logError('Toast error telemetry', errorData, { category: 'toast_error' });

    } catch (telemetryError) {
      logger.logError('Failed to send error telemetry', telemetryError);
    }
  }
}

// Create singleton instance
export const enhancedToast = new EnhancedToast();

// React hook for using enhanced toast
export const useEnhancedToast = () => {
  const toastHook = useToast();

  // Initialize the enhanced toast with the hook
  React.useEffect(() => {
    enhancedToast.initialize(toastHook);
  }, [toastHook]);

  return {
    showError: enhancedToast.showErrorToast.bind(enhancedToast),
    showSuccess: enhancedToast.showSuccessToast.bind(enhancedToast),
    showWarning: enhancedToast.showWarningToast.bind(enhancedToast),
    showInfo: enhancedToast.showInfoToast.bind(enhancedToast),
    showLoading: enhancedToast.showLoadingToast.bind(enhancedToast),
    showNetworkError: enhancedToast.showNetworkErrorToast.bind(enhancedToast),
    showApiError: enhancedToast.showApiErrorToast.bind(enhancedToast),
    showValidationError: enhancedToast.showValidationErrorToast.bind(enhancedToast)
  };
};

// Convenience functions for use outside React components
export const showErrorToast = enhancedToast.showErrorToast.bind(enhancedToast);
export const showSuccessToast = enhancedToast.showSuccessToast.bind(enhancedToast);
export const showWarningToast = enhancedToast.showWarningToast.bind(enhancedToast);
export const showInfoToast = enhancedToast.showInfoToast.bind(enhancedToast);

export default enhancedToast;