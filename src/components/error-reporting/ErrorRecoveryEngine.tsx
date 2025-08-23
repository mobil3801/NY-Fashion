
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Shield,
  Zap,
  Settings,
  ExternalLink,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { 
  comprehensiveErrorReporting,
  type ErrorContext,
  type ErrorRecoverySuggestion 
} from '@/services/comprehensive-error-reporting';
import { useEnhancedToast } from '@/utils/enhanced-toast';

interface ErrorRecoveryEngineProps {
  errorContext: ErrorContext;
  onRecoverySuccess?: () => void;
  onRecoveryFailure?: (error: Error) => void;
  autoAttemptRecovery?: boolean;
  maxAutoAttempts?: number;
}

interface RecoveryAttempt {
  suggestionId: string;
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface RecoveryState {
  suggestions: ErrorRecoverySuggestion[];
  attemptHistory: RecoveryAttempt[];
  currentAttempt: {
    suggestion: ErrorRecoverySuggestion | null;
    progress: number;
    isAttempting: boolean;
  };
  autoRecoveryEnabled: boolean;
  recoverySuccess: boolean;
}

const ErrorRecoveryEngine: React.FC<ErrorRecoveryEngineProps> = ({
  errorContext,
  onRecoverySuccess,
  onRecoveryFailure,
  autoAttemptRecovery = false,
  maxAutoAttempts = 3
}) => {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>({
    suggestions: [],
    attemptHistory: [],
    currentAttempt: {
      suggestion: null,
      progress: 0,
      isAttempting: false
    },
    autoRecoveryEnabled: autoAttemptRecovery,
    recoverySuccess: false
  });

  const { showSuccess, showError, showInfo } = useEnhancedToast();

  useEffect(() => {
    // Load recovery suggestions for this error
    const suggestions = comprehensiveErrorReporting.getRecoverySuggestions(errorContext);
    setRecoveryState(prev => ({
      ...prev,
      suggestions: suggestions.slice(0, 5) // Limit to top 5 suggestions
    }));

    // Auto-attempt recovery if enabled
    if (autoAttemptRecovery && suggestions.length > 0) {
      attemptAutoRecovery(suggestions);
    }
  }, [errorContext, autoAttemptRecovery]);

  const attemptAutoRecovery = async (suggestions: ErrorRecoverySuggestion[]) => {
    const autoSuggestions = suggestions
      .filter(s => s.priority <= 1 && s.action.type !== 'custom') // Only attempt safe, high-priority actions
      .slice(0, maxAutoAttempts);

    for (const suggestion of autoSuggestions) {
      if (recoveryState.attemptHistory.length >= maxAutoAttempts) break;
      
      showInfo(`Attempting automatic recovery: ${suggestion.title}`);
      const success = await executeRecoverySuggestion(suggestion, true);
      
      if (success) {
        setRecoveryState(prev => ({ ...prev, recoverySuccess: true }));
        onRecoverySuccess?.();
        return;
      }

      // Wait between attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!recoveryState.recoverySuccess) {
      showInfo('Automatic recovery was unsuccessful. Please try manual recovery options.');
    }
  };

  const executeRecoverySuggestion = async (
    suggestion: ErrorRecoverySuggestion,
    isAutoAttempt = false
  ): Promise<boolean> => {
    const startTime = Date.now();
    
    setRecoveryState(prev => ({
      ...prev,
      currentAttempt: {
        suggestion,
        progress: 0,
        isAttempting: true
      }
    }));

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setRecoveryState(prev => ({
          ...prev,
          currentAttempt: {
            ...prev.currentAttempt,
            progress: Math.min(prev.currentAttempt.progress + 15, 85)
          }
        }));
      }, 200);

      let success = false;

      switch (suggestion.action.type) {
        case 'retry':
          if (suggestion.action.handler) {
            success = await suggestion.action.handler();
          } else {
            // Default retry logic
            await new Promise(resolve => setTimeout(resolve, 1000));
            success = navigator.onLine;
          }
          break;

        case 'reload':
          showInfo('Reloading page...');
          setTimeout(() => window.location.reload(), 1000);
          return true;

        case 'clear_cache':
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            showInfo('Cache cleared. Reloading...');
            setTimeout(() => window.location.reload(), 1000);
            return true;
          }
          break;

        case 'logout_login':
          try {
            await window.ezsite.apis.logout();
            showInfo('Redirecting to login...');
            setTimeout(() => window.location.href = '/auth/login', 1000);
            return true;
          } catch (error) {
            console.error('Logout failed:', error);
            return false;
          }

        case 'navigate':
          const url = suggestion.action.params?.url || '/';
          showInfo(`Navigating to ${url}...`);
          setTimeout(() => window.location.href = url, 1000);
          return true;

        case 'custom':
          if (suggestion.action.handler) {
            success = await suggestion.action.handler();
          }
          break;

        default:
          success = false;
      }

      clearInterval(progressInterval);
      
      setRecoveryState(prev => ({
        ...prev,
        currentAttempt: {
          ...prev.currentAttempt,
          progress: 100
        }
      }));

      const duration = Date.now() - startTime;
      const attempt: RecoveryAttempt = {
        suggestionId: suggestion.id,
        timestamp: new Date().toISOString(),
        success,
        duration
      };

      setRecoveryState(prev => ({
        ...prev,
        attemptHistory: [...prev.attemptHistory, attempt],
        recoverySuccess: success,
        currentAttempt: {
          suggestion: null,
          progress: 0,
          isAttempting: false
        }
      }));

      // Record the recovery attempt
      await comprehensiveErrorReporting.updateErrorWithRecoveryAttempt(
        errorContext.errorId,
        suggestion.id,
        success
      );

      if (success) {
        showSuccess(`Recovery successful: ${suggestion.title}`);
        onRecoverySuccess?.();
      } else {
        if (!isAutoAttempt) {
          showError(`Recovery unsuccessful: ${suggestion.title}. Please try another solution.`);
        }
      }

      return success;

    } catch (error) {
      const duration = Date.now() - startTime;
      const attempt: RecoveryAttempt = {
        suggestionId: suggestion.id,
        timestamp: new Date().toISOString(),
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setRecoveryState(prev => ({
        ...prev,
        attemptHistory: [...prev.attemptHistory, attempt],
        currentAttempt: {
          suggestion: null,
          progress: 0,
          isAttempting: false
        }
      }));

      if (!isAutoAttempt) {
        showError(`Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      onRecoveryFailure?.(error instanceof Error ? error : new Error('Recovery failed'));
      return false;
    }
  };

  const getAttemptIcon = (attempt: RecoveryAttempt) => {
    if (attempt.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSuggestionIcon = (suggestion: ErrorRecoverySuggestion) => {
    switch (suggestion.action.type) {
      case 'retry':
        return <RefreshCw className="h-4 w-4" />;
      case 'reload':
        return <RefreshCw className="h-4 w-4" />;
      case 'clear_cache':
        return <Settings className="h-4 w-4" />;
      case 'logout_login':
        return <Shield className="h-4 w-4" />;
      case 'navigate':
        return <ExternalLink className="h-4 w-4" />;
      case 'custom':
        return <Zap className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 0:
        return 'text-red-600 bg-red-50 border-red-200';
      case 1:
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 2:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  if (recoveryState.recoverySuccess) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-medium text-green-800 mb-2">Recovery Successful!</h3>
          <p className="text-green-600">
            The issue has been resolved. You can continue using the application.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Recovery Attempt */}
      {recoveryState.currentAttempt.isAttempting && recoveryState.currentAttempt.suggestion && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            <div className="space-y-2">
              <p>Attempting: {recoveryState.currentAttempt.suggestion.title}</p>
              <Progress value={recoveryState.currentAttempt.progress} className="h-2" />
              <p className="text-xs text-gray-600">
                {recoveryState.currentAttempt.progress}% complete
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recovery Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recovery Suggestions
            {recoveryState.autoRecoveryEnabled && (
              <Badge variant="outline" className="ml-auto">
                Auto Recovery Enabled
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recoveryState.suggestions.length > 0 ? (
              recoveryState.suggestions.map((suggestion, index) => {
                const attemptedBefore = recoveryState.attemptHistory.find(
                  a => a.suggestionId === suggestion.id
                );

                return (
                  <div
                    key={suggestion.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getSuggestionIcon(suggestion)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{suggestion.title}</h4>
                        <Badge className={getPriorityColor(suggestion.priority)}>
                          Priority {suggestion.priority + 1}
                        </Badge>
                        {attemptedBefore && (
                          <div className="flex items-center gap-1">
                            {getAttemptIcon(attemptedBefore)}
                            <span className="text-xs text-gray-500">
                              {attemptedBefore.success ? 'Worked' : 'Failed'}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{suggestion.userMessage}</p>
                    </div>
                    
                    <Button
                      onClick={() => executeRecoverySuggestion(suggestion)}
                      disabled={
                        recoveryState.currentAttempt.isAttempting ||
                        (attemptedBefore && attemptedBefore.success)
                      }
                      variant={index === 0 ? 'default' : 'outline'}
                      size="sm"
                    >
                      {attemptedBefore && attemptedBefore.success ? 
                        'Completed' : 
                        recoveryState.currentAttempt.isAttempting ? 
                          'Processing...' : 
                          'Try This'
                      }
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No recovery suggestions available for this error type.</p>
                <p className="text-sm mt-1">Please try refreshing the page or contact support.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attempt History */}
      {recoveryState.attemptHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recovery Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recoveryState.attemptHistory.slice(-5).map((attempt, index) => {
                const suggestion = recoveryState.suggestions.find(s => s.id === attempt.suggestionId);
                return (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getAttemptIcon(attempt)}
                      <span>{suggestion?.title || attempt.suggestionId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{attempt.duration}ms</span>
                      <span>{new Date(attempt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Status */}
      <div className="flex items-center justify-center gap-4 text-sm text-gray-500 pt-2 border-t">
        {navigator.onLine ? (
          <div className="flex items-center gap-1 text-green-600">
            <Wifi className="h-4 w-4" />
            Connection: Online
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-600">
            <WifiOff className="h-4 w-4" />
            Connection: Offline
          </div>
        )}
        <div className="flex items-center gap-1">
          <span>Error ID: {errorContext.errorId.slice(-8)}</span>
        </div>
      </div>
    </div>
  );
};

export default ErrorRecoveryEngine;
