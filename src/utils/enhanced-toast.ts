
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, X, Loader2, Undo, Bug, Copy, ExternalLink } from 'lucide-react';

export type ErrorCategory = 'network' | 'validation' | 'permission' | 'business' | 'system' | 'timeout';
export type ToastPriority = 'low' | 'medium' | 'high' | 'critical';

interface EnhancedToastOptions {
  title: string;
  description?: string;
  category?: ErrorCategory;
  priority?: ToastPriority;
  retryAction?: () => void | Promise<void>;
  undoAction?: () => void | Promise<void>;
  reportAction?: () => void;
  helpAction?: () => void;
  duration?: number;
  persistent?: boolean;
  showCopyButton?: boolean;
  metadata?: Record<string, any>;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  backoffMultiplier?: number;
  showProgress?: boolean;
}

const errorCategoryConfig = {
  network: {
    icon: RefreshCw,
    color: 'orange',
    defaultMessage: 'Connection error. Please check your internet connection.',
    suggestions: [
    'Check your internet connection',
    'Try refreshing the page',
    'Wait a moment and try again']

  },
  validation: {
    icon: AlertTriangle,
    color: 'yellow',
    defaultMessage: 'Please fix the errors and try again.',
    suggestions: [
    'Review the highlighted fields',
    'Ensure all required information is provided',
    'Check the format of your input']

  },
  permission: {
    icon: X,
    color: 'red',
    defaultMessage: 'You don\'t have permission to perform this action.',
    suggestions: [
    'Contact your administrator',
    'Ensure you\'re logged in with the correct account',
    'Try logging out and back in']

  },
  business: {
    icon: AlertTriangle,
    color: 'blue',
    defaultMessage: 'This action cannot be completed due to business rules.',
    suggestions: [
    'Review the business rules',
    'Check if prerequisites are met',
    'Contact support for clarification']

  },
  system: {
    icon: Bug,
    color: 'red',
    defaultMessage: 'A system error occurred. Please try again.',
    suggestions: [
    'Try the action again',
    'Refresh the page',
    'Contact support if the problem persists']

  },
  timeout: {
    icon: Loader2,
    color: 'gray',
    defaultMessage: 'The request took too long to complete.',
    suggestions: [
    'Try again with a smaller request',
    'Check your connection speed',
    'Wait a moment and retry']

  }
};

const priorityConfig = {
  low: { duration: 3000, persistent: false },
  medium: { duration: 5000, persistent: false },
  high: { duration: 8000, persistent: false },
  critical: { duration: 0, persistent: true }
};

class EnhancedToastManager {
  private static instance: EnhancedToastManager;
  private activeToasts = new Map<string, any>();
  private retryStates = new Map<string, {count: number;maxRetries: number;}>();

  static getInstance(): EnhancedToastManager {
    if (!this.instance) {
      this.instance = new EnhancedToastManager();
    }
    return this.instance;
  }

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getErrorConfig(category: ErrorCategory) {
    return errorCategoryConfig[category] || errorCategoryConfig.system;
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  private createActionsElement(options: EnhancedToastOptions, toastId: string) {
    const actions = [];

    // Retry Action
    if (options.retryAction) {
      actions.push(
        React.createElement(Button, {
          key: "retry",
          variant: "outline",
          size: "sm",
          onClick: async () => {
            try {
              await options.retryAction!();
            } catch (error) {
              console.error('Retry failed:', error);
            }
          }
        },
        React.createElement(RefreshCw, { className: "h-3 w-3 mr-1" }),
        "Retry"
        )
      );
    }

    // Undo Action
    if (options.undoAction) {
      actions.push(
        React.createElement(Button, {
          key: "undo",
          variant: "outline",
          size: "sm",
          onClick: async () => {
            try {
              await options.undoAction!();
              this.dismiss(toastId);
            } catch (error) {
              console.error('Undo failed:', error);
            }
          }
        },
        React.createElement(Undo, { className: "h-3 w-3 mr-1" }),
        "Undo"
        )
      );
    }

    // Copy Button
    if (options.showCopyButton) {
      actions.push(
        React.createElement(Button, {
          key: "copy",
          variant: "outline",
          size: "sm",
          onClick: async () => {
            const content = {
              title: options.title,
              description: options.description,
              category: options.category,
              timestamp: new Date().toISOString(),
              metadata: options.metadata
            };

            const success = await this.copyToClipboard(JSON.stringify(content, null, 2));
            if (success) {
              this.success({
                title: 'Copied',
                description: 'Error details copied to clipboard',
                duration: 2000
              });
            }
          }
        },
        React.createElement(Copy, { className: "h-3 w-3 mr-1" }),
        "Copy"
        )
      );
    }

    // Report Action
    if (options.reportAction) {
      actions.push(
        React.createElement(Button, {
          key: "report",
          variant: "outline",
          size: "sm",
          onClick: options.reportAction
        },
        React.createElement(Bug, { className: "h-3 w-3 mr-1" }),
        "Report"
        )
      );
    }

    // Help Action
    if (options.helpAction) {
      actions.push(
        React.createElement(Button, {
          key: "help",
          variant: "outline",
          size: "sm",
          onClick: options.helpAction
        },
        React.createElement(ExternalLink, { className: "h-3 w-3 mr-1" }),
        "Help"
        )
      );
    }

    return actions.length > 0 ?
    React.createElement("div", { className: "flex gap-2 mt-2" }, ...actions) :
    undefined;
  }

  private createDescriptionElement(options: EnhancedToastOptions) {
    const config = options.category ? this.getErrorConfig(options.category) : null;

    return React.createElement("div", null,
    React.createElement("div", null, options.description),
    config && config.suggestions &&
    React.createElement("div", { className: "mt-2 text-xs" },
    React.createElement("div", { className: "font-medium" }, "Suggestions:"),
    React.createElement("ul", { className: "list-disc list-inside mt-1" },
    config.suggestions.slice(0, 2).map((suggestion, index) =>
    React.createElement("li", { key: index }, suggestion)
    )
    )
    )
    );
  }

  success(options: Partial<EnhancedToastOptions>) {
    const toastId = this.generateId();
    const config = priorityConfig[options.priority || 'medium'];

    const toastInstance = toast({
      title: options.title || 'Success',
      description: options.description,
      duration: options.duration ?? config.duration,
      action: this.createActionsElement(options as EnhancedToastOptions, toastId)
    });

    this.activeToasts.set(toastId, toastInstance);
    return toastId;
  }

  error(options: EnhancedToastOptions) {
    const toastId = this.generateId();
    const config = priorityConfig[options.priority || 'high'];
    const errorConfig = options.category ? this.getErrorConfig(options.category) : null;

    const toastInstance = toast({
      title: options.title,
      description: this.createDescriptionElement(options),
      variant: 'destructive',
      duration: options.duration ?? config.duration,
      action: this.createActionsElement(options, toastId)
    });

    this.activeToasts.set(toastId, toastInstance);
    return toastId;
  }

  warning(options: Partial<EnhancedToastOptions>) {
    const toastId = this.generateId();
    const config = priorityConfig[options.priority || 'medium'];

    const toastInstance = toast({
      title: options.title || 'Warning',
      description: options.description,
      duration: options.duration ?? config.duration,
      action: this.createActionsElement(options as EnhancedToastOptions, toastId)
    });

    this.activeToasts.set(toastId, toastInstance);
    return toastId;
  }

  info(options: Partial<EnhancedToastOptions>) {
    const toastId = this.generateId();
    const config = priorityConfig[options.priority || 'low'];

    const toastInstance = toast({
      title: options.title || 'Information',
      description: options.description,
      duration: options.duration ?? config.duration,
      action: this.createActionsElement(options as EnhancedToastOptions, toastId)
    });

    this.activeToasts.set(toastId, toastInstance);
    return toastId;
  }

  async retryWithBackoff(
  action: () => Promise<void>,
  options: RetryOptions & Partial<EnhancedToastOptions> = {})
  : Promise<void> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      backoffMultiplier = 2,
      showProgress = true,
      ...toastOptions
    } = options;

    let currentRetry = 0;
    let delay = baseDelay;
    let toastId: string | null = null;

    while (currentRetry < maxRetries) {
      try {
        if (showProgress && currentRetry > 0) {
          if (toastId) this.dismiss(toastId);

          toastId = this.info({
            title: `Retrying... (${currentRetry}/${maxRetries})`,
            description: 'Please wait while we retry the operation.',
            persistent: true,
            ...toastOptions
          });
        }

        await action();

        if (toastId) this.dismiss(toastId);

        if (currentRetry > 0) {
          this.success({
            title: 'Success',
            description: 'Operation completed successfully after retry.',
            ...toastOptions
          });
        }

        return;

      } catch (error) {
        currentRetry++;

        if (currentRetry >= maxRetries) {
          if (toastId) this.dismiss(toastId);

          this.error({
            title: 'Operation Failed',
            description: `Failed after ${maxRetries} attempts. ${error instanceof Error ? error.message : 'Unknown error'}`,
            category: 'system',
            priority: 'high',
            retryAction: () => this.retryWithBackoff(action, options),
            showCopyButton: true,
            metadata: {
              attempts: maxRetries,
              lastError: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            },
            ...toastOptions
          });

          throw error;
        }

        // Wait before next retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  optimisticUpdate<T>(
  optimisticAction: () => T,
  actualAction: () => Promise<T>,
  rollbackAction: () => void,
  options: Partial<EnhancedToastOptions> = {})
  : Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        // Apply optimistic update
        const optimisticResult = optimisticAction();

        // Show optimistic success with undo option
        const toastId = this.success({
          title: options.title || 'Updated',
          description: options.description || 'Changes have been applied.',
          undoAction: () => {
            rollbackAction();
            this.info({
              title: 'Changes Reverted',
              description: 'Your changes have been undone.',
              duration: 3000
            });
          },
          ...options
        });

        // Perform actual action
        actualAction().
        then((result) => {
          this.dismiss(toastId);
          resolve(result);
        }).
        catch((error) => {
          // Rollback on error
          rollbackAction();
          this.dismiss(toastId);

          this.error({
            title: 'Update Failed',
            description: `The update could not be completed. ${error instanceof Error ? error.message : 'Unknown error'}`,
            category: 'system',
            retryAction: () => this.optimisticUpdate(optimisticAction, actualAction, rollbackAction, options),
            ...options
          });

          reject(error);
        });

      } catch (error) {
        this.error({
          title: 'Update Error',
          description: `Failed to apply optimistic update. ${error instanceof Error ? error.message : 'Unknown error'}`,
          category: 'system',
          ...options
        });
        reject(error);
      }
    });
  }

  dismiss(toastId: string) {
    const toastInstance = this.activeToasts.get(toastId);
    if (toastInstance && toastInstance.dismiss) {
      toastInstance.dismiss();
      this.activeToasts.delete(toastId);
    }
  }

  dismissAll() {
    this.activeToasts.forEach((toastInstance) => {
      if (toastInstance.dismiss) {
        toastInstance.dismiss();
      }
    });
    this.activeToasts.clear();
  }
}

// Export singleton instance
export const enhancedToast = EnhancedToastManager.getInstance();

// Convenience functions
export const showErrorToast = (options: EnhancedToastOptions) => enhancedToast.error(options);
export const showSuccessToast = (options: Partial<EnhancedToastOptions>) => enhancedToast.success(options);
export const showWarningToast = (options: Partial<EnhancedToastOptions>) => enhancedToast.warning(options);
export const showInfoToast = (options: Partial<EnhancedToastOptions>) => enhancedToast.info(options);

// Error categorization helper
export const categorizeError = (error: unknown): ErrorCategory => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('business') || message.includes('rule')) {
      return 'business';
    }
  }

  return 'system';
};