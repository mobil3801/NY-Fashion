
import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Send,
  ExternalLink,
  Shield,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Bug,
  Lightbulb,
  Mail
} from 'lucide-react';
import { 
  comprehensiveErrorReporting,
  type ErrorContext,
  type ErrorRecoverySuggestion,
  type UserErrorFeedback
} from '@/services/comprehensive-error-reporting';
import { useEnhancedToast } from '@/utils/enhanced-toast';
import { cn } from '@/lib/utils';

interface UserFriendlyErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorContext: ErrorContext;
  onRecoveryAttempt?: (suggestion: ErrorRecoverySuggestion) => Promise<boolean>;
  showTechnicalDetails?: boolean;
}

interface RecoveryState {
  attempting: boolean;
  suggestion: ErrorRecoverySuggestion | null;
  progress: number;
}

const UserFriendlyErrorDialog: React.FC<UserFriendlyErrorDialogProps> = ({
  open,
  onOpenChange,
  errorContext,
  onRecoveryAttempt,
  showTechnicalDetails = false
}) => {
  const [activeTab, setActiveTab] = useState<'error' | 'feedback' | 'details'>('error');
  const [recoveryState, setRecoveryState] = useState<RecoveryState>({
    attempting: false,
    suggestion: null,
    progress: 0
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Partial<UserErrorFeedback>>({
    rating: 3,
    contactAllowed: false
  });
  
  const { showSuccess, showError } = useEnhancedToast();
  const recoverySuggestions = comprehensiveErrorReporting.getRecoverySuggestions(errorContext);

  const getUserFriendlyTitle = useCallback(() => {
    switch (errorContext.errorType) {
      case 'network':
        return 'Connection Issue';
      case 'authentication':
        return 'Session Expired';
      case 'validation':
        return 'Input Error';
      case 'permission':
        return 'Access Denied';
      case 'api':
        return 'Service Unavailable';
      default:
        return 'Something Went Wrong';
    }
  }, [errorContext.errorType]);

  const getUserFriendlyDescription = useCallback(() => {
    switch (errorContext.errorType) {
      case 'network':
        return 'We\'re having trouble connecting to our servers. This might be due to your internet connection or our services being temporarily unavailable.';
      case 'authentication':
        return 'Your session has expired for security reasons. Please log in again to continue.';
      case 'validation':
        return 'There seems to be an issue with the information provided. Please check your input and try again.';
      case 'permission':
        return 'You don\'t have the necessary permissions to perform this action. Please contact your administrator if you believe this is an error.';
      case 'api':
        return 'Our service is temporarily experiencing issues. Our team has been notified and is working to resolve this quickly.';
      default:
        return 'An unexpected error occurred. Don\'t worry, our team has been automatically notified and is looking into it.';
    }
  }, [errorContext.errorType]);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  }, []);

  const handleRecoveryAttempt = async (suggestion: ErrorRecoverySuggestion) => {
    setRecoveryState({
      attempting: true,
      suggestion,
      progress: 0
    });

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setRecoveryState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 20, 90)
        }));
      }, 200);

      let success = false;

      // Execute recovery action
      if (suggestion.action.type === 'retry' && suggestion.action.handler) {
        success = await suggestion.action.handler();
      } else if (suggestion.action.type === 'reload') {
        window.location.reload();
        return;
      } else if (suggestion.action.type === 'clear_cache') {
        // Clear cache and reload
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(name => caches.delete(name)));
        }
        window.location.reload();
        return;
      } else if (suggestion.action.type === 'logout_login') {
        // Handle logout/login
        try {
          await window.ezsite.apis.logout();
          window.location.href = '/auth/login';
        } catch (error) {
          console.error('Logout failed:', error);
        }
        return;
      } else if (suggestion.action.type === 'navigate') {
        window.location.href = suggestion.action.params?.url || '/';
        return;
      } else if (suggestion.action.type === 'custom' && suggestion.action.handler) {
        success = await suggestion.action.handler();
      }

      clearInterval(progressInterval);
      setRecoveryState(prev => ({ ...prev, progress: 100 }));

      // Record recovery attempt
      await comprehensiveErrorReporting.updateErrorWithRecoveryAttempt(
        errorContext.errorId,
        suggestion.id,
        success
      );

      if (success) {
        showSuccess('Issue resolved successfully!');
        onOpenChange(false);
      } else {
        showError('Recovery attempt unsuccessful. Please try another solution.');
      }

      if (onRecoveryAttempt) {
        await onRecoveryAttempt(suggestion);
      }

    } catch (error) {
      showError('Recovery attempt failed. Please try another solution.');
    } finally {
      setTimeout(() => {
        setRecoveryState({
          attempting: false,
          suggestion: null,
          progress: 0
        });
      }, 1000);
    }
  };

  const handleFeedbackSubmit = async () => {
    try {
      if (!feedback.description && !feedback.expectation) {
        showError('Please provide some feedback before submitting.');
        return;
      }

      const userFeedback: UserErrorFeedback = {
        description: feedback.description || '',
        rating: feedback.rating || 3,
        expectation: feedback.expectation || '',
        reproductionSteps: feedback.reproductionSteps || '',
        contactAllowed: feedback.contactAllowed || false,
        contactInfo: feedback.contactAllowed ? feedback.contactInfo : undefined
      };

      await comprehensiveErrorReporting.recordUserFeedback(errorContext.errorId, userFeedback);
      setFeedbackSubmitted(true);
      showSuccess('Thank you for your feedback! It helps us improve.');
    } catch (error) {
      showError('Failed to submit feedback. Please try again.');
    }
  };

  const copyErrorId = () => {
    navigator.clipboard.writeText(errorContext.errorId);
    showSuccess('Error ID copied to clipboard');
  };

  const copyTechnicalDetails = () => {
    const details = {
      errorId: errorContext.errorId,
      timestamp: errorContext.timestamp,
      type: errorContext.errorType,
      component: errorContext.component,
      route: errorContext.route,
      userAgent: errorContext.userAgent,
      stackTrace: errorContext.stackTrace
    };
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    showSuccess('Technical details copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn('h-6 w-6', {
              'text-red-500': errorContext.severity === 'critical',
              'text-orange-500': errorContext.severity === 'high',
              'text-yellow-500': errorContext.severity === 'medium',
              'text-blue-500': errorContext.severity === 'low'
            })} />
            <div className="flex-1">
              <DialogTitle className="text-xl">{getUserFriendlyTitle()}</DialogTitle>
              <DialogDescription className="mt-1">
                {getUserFriendlyDescription()}
              </DialogDescription>
            </div>
            <Badge className={getSeverityColor(errorContext.severity)}>
              {errorContext.severity}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab as any} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="error" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Solutions
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Feedback
            </TabsTrigger>
            {showTechnicalDetails && (
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Details
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="error" className="space-y-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recoverySuggestions.length > 0 ? (
                recoverySuggestions.map((suggestion, index) => (
                  <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{suggestion.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              Priority {suggestion.priority + 1}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{suggestion.userMessage}</p>
                        </div>
                        <Button
                          onClick={() => handleRecoveryAttempt(suggestion)}
                          disabled={recoveryState.attempting}
                          variant={index === 0 ? 'default' : 'outline'}
                          size="sm"
                        >
                          {recoveryState.attempting && recoveryState.suggestion?.id === suggestion.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Trying...
                            </>
                          ) : (
                            <>
                              {suggestion.action.type === 'retry' && <RefreshCw className="h-4 w-4 mr-2" />}
                              {suggestion.action.type === 'reload' && <RefreshCw className="h-4 w-4 mr-2" />}
                              {suggestion.action.type === 'navigate' && <ExternalLink className="h-4 w-4 mr-2" />}
                              Try This
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {recoveryState.attempting && recoveryState.suggestion?.id === suggestion.id && (
                        <div className="mt-3">
                          <Progress value={recoveryState.progress} className="h-2" />
                          <p className="text-xs text-gray-500 mt-1">
                            Attempting recovery... {recoveryState.progress}%
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600">
                      No automatic recovery suggestions available for this error.
                      Please try refreshing the page or contact support.
                    </p>
                    <div className="flex gap-2 mt-4 justify-center">
                      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Page
                      </Button>
                      <Button onClick={() => setActiveTab('feedback')} variant="outline" size="sm">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Report Issue
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span>Error ID:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyErrorId}
                  className="font-mono text-xs"
                >
                  {errorContext.errorId}
                  <Copy className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {navigator.onLine ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <Wifi className="h-4 w-4" />
                    Online
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <WifiOff className="h-4 w-4" />
                    Offline
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            {feedbackSubmitted ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">Thank You!</h3>
                  <p className="text-gray-600">
                    Your feedback has been submitted and will help us improve the application.
                    Our development team will review your report.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="rating">How would you rate this error experience?</Label>
                    <RadioGroup
                      value={feedback.rating?.toString()}
                      onValueChange={(value) => setFeedback(prev => ({ ...prev, rating: parseInt(value) }))}
                      className="flex gap-4 mt-2"
                    >
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <div key={rating} className="flex items-center space-x-2">
                          <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                          <Label htmlFor={`rating-${rating}`} className="text-sm">
                            {rating === 1 ? '😟' : rating === 2 ? '😕' : rating === 3 ? '😐' : rating === 4 ? '🙂' : '😊'}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="expectation">What were you trying to do?</Label>
                    <Textarea
                      id="expectation"
                      placeholder="Describe what you were trying to accomplish when this error occurred..."
                      value={feedback.expectation || ''}
                      onChange={(e) => setFeedback(prev => ({ ...prev, expectation: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Additional details (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Any additional information that might be helpful..."
                      value={feedback.description || ''}
                      onChange={(e) => setFeedback(prev => ({ ...prev, description: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="reproduction">How can we reproduce this? (optional)</Label>
                    <Textarea
                      id="reproduction"
                      placeholder="Step by step instructions to reproduce this error..."
                      value={feedback.reproductionSteps || ''}
                      onChange={(e) => setFeedback(prev => ({ ...prev, reproductionSteps: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="contact"
                      checked={feedback.contactAllowed}
                      onCheckedChange={(checked) => setFeedback(prev => ({ ...prev, contactAllowed: !!checked }))}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="contact" className="text-sm font-normal">
                        Allow our team to contact me about this issue
                      </Label>
                      <p className="text-xs text-gray-500">
                        We may reach out for additional information to help resolve this issue
                      </p>
                    </div>
                  </div>

                  {feedback.contactAllowed && (
                    <div>
                      <Label htmlFor="contact-info">Contact information</Label>
                      <Input
                        id="contact-info"
                        type="email"
                        placeholder="your.email@example.com"
                        value={feedback.contactInfo || ''}
                        onChange={(e) => setFeedback(prev => ({ ...prev, contactInfo: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleFeedbackSubmit} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Submit Feedback
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('error')}>
                    Back to Solutions
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {showTechnicalDetails && (
            <TabsContent value="details" className="space-y-4">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Error Information</h4>
                      <Button variant="outline" size="sm" onClick={copyTechnicalDetails}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Details
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Error ID:</span>
                        <span className="font-mono">{errorContext.errorId}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Timestamp:</span>
                        <span>{new Date(errorContext.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Type:</span>
                        <span>{errorContext.errorType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Severity:</span>
                        <span>{errorContext.severity}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Component:</span>
                        <span>{errorContext.component}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Route:</span>
                        <span>{errorContext.route}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3">Browser Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Browser:</span>
                        <span>{errorContext.browserInfo.name} {errorContext.browserInfo.version}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Platform:</span>
                        <span>{errorContext.browserInfo.platform}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Screen:</span>
                        <span>{errorContext.browserInfo.screenResolution}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Viewport:</span>
                        <span>{errorContext.browserInfo.viewportSize}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {errorContext.stackTrace && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Stack Trace</h4>
                      <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                        {errorContext.stackTrace}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {errorContext.breadcrumbs.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Recent Activity</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {errorContext.breadcrumbs.slice(-10).map((breadcrumb, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <span className="text-gray-500 min-w-16">
                              {new Date(breadcrumb.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {breadcrumb.type}
                            </Badge>
                            <span className="flex-1">{breadcrumb.message}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!feedbackSubmitted && activeTab !== 'feedback' && (
            <Button variant="outline" onClick={() => setActiveTab('feedback')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Provide Feedback
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserFriendlyErrorDialog;
