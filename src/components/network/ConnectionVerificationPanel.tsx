
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, ExternalLink, Eye, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { connectionVerifier, type ConnectionVerificationResult, type SecurityCheck } from '@/lib/network/connection-verifier';
import { useToast } from '@/hooks/use-toast';

interface ConnectionVerificationPanelProps {
  onClose?: () => void;
}

export function ConnectionVerificationPanel({ onClose }: ConnectionVerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ConnectionVerificationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentCheck, setCurrentCheck] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Auto-verify on component mount
    handleVerifyConnection();

    // Start security monitoring
    connectionVerifier.startSecurityMonitoring();

    return () => {
      connectionVerifier.stopSecurityMonitoring();
    };
  }, []);

  const handleVerifyConnection = async () => {
    setIsVerifying(true);
    setProgress(0);
    setCurrentCheck('Starting verification...');

    try {
      // Simulate progress updates for better UX
      const checks = [
        'Checking HTTPS configuration...',
        'Verifying SSL certificate...',
        'Scanning for mixed content...',
        'Checking security headers...',
        'Validating CSP policies...',
        'Finalizing report...'
      ];

      for (let i = 0; i < checks.length; i++) {
        setCurrentCheck(checks[i]);
        setProgress(((i + 1) / checks.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await connectionVerifier.verifyCurrentConnection();
      setVerificationResult(result);

      if (result.errors.length === 0) {
        toast({
          title: "Connection Verified",
          description: "Your connection is secure and properly configured.",
        });
      } else {
        toast({
          title: "Connection Issues Found",
          description: `Found ${result.errors.length} issue(s) that may affect connectivity.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Could not complete connection verification.",
        variant: "destructive",
      });
      console.error('Connection verification failed:', error);
    } finally {
      setIsVerifying(false);
      setCurrentCheck('');
    }
  };

  const handleClearCache = () => {
    connectionVerifier.clearCache();
    toast({
      title: "Cache Cleared",
      description: "Browser cache and verification cache have been cleared.",
    });
    handleVerifyConnection();
  };

  const handleFixMixedContent = () => {
    if (!verificationResult) return;

    const httpResources: string[] = [];
    
    // Collect HTTP resources on HTTPS pages
    if (window.location.protocol === 'https:') {
      document.querySelectorAll('script[src], link[href], img[src]').forEach(element => {
        const url = (element as any).src || (element as any).href;
        if (url && url.startsWith('http://')) {
          httpResources.push(url);
        }
      });
    }

    if (httpResources.length > 0) {
      console.group('Mixed Content Resources Found:');
      httpResources.forEach(url => console.log(`- ${url}`));
      console.groupEnd();
      
      toast({
        title: "Mixed Content Details",
        description: `Found ${httpResources.length} HTTP resources. Check browser console for details.`,
        variant: "destructive",
      });
    }
  };

  const getSecurityBadgeVariant = (connectionType: string) => {
    switch (connectionType) {
      case 'https': return 'default';
      case 'mixed': return 'destructive';
      case 'http': return 'destructive';
      default: return 'secondary';
    }
  };

  const getSecurityIcon = (connectionType: string) => {
    switch (connectionType) {
      case 'https': return <CheckCircle className="h-4 w-4" />;
      case 'mixed': return <AlertTriangle className="h-4 w-4" />;
      case 'http': return <AlertTriangle className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Connection Security Verification
            </CardTitle>
            <CardDescription>
              Diagnose and fix HTTPS certificate and connection issues
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Security Details</TabsTrigger>
            <TabsTrigger value="fixes">Quick Fixes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Verification Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={handleVerifyConnection} 
                disabled={isVerifying}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} />
                {isVerifying ? 'Verifying...' : 'Re-verify Connection'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClearCache}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Clear Cache
              </Button>
            </div>

            {/* Progress Indicator */}
            {isVerifying && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{currentCheck}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {/* Verification Results */}
            {verificationResult && (
              <div className="space-y-4">
                {/* Security Status Overview */}
                <Alert className={verificationResult.errors.length === 0 ? 'border-green-200' : 'border-red-200'}>
                  <div className="flex items-center gap-2">
                    {getSecurityIcon(verificationResult.connectionType)}
                    <AlertTitle>
                      Connection Status: 
                      <Badge 
                        variant={getSecurityBadgeVariant(verificationResult.connectionType)}
                        className="ml-2"
                      >
                        {verificationResult.connectionType.toUpperCase()}
                      </Badge>
                    </AlertTitle>
                  </div>
                  <AlertDescription className="mt-2">
                    {verificationResult.errors.length === 0 
                      ? "Your connection is secure and properly configured."
                      : `Found ${verificationResult.errors.length} security issue(s) that may cause connection problems.`
                    }
                  </AlertDescription>
                </Alert>

                {/* Security Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Secure Connection</span>
                        <Badge variant={verificationResult.isSecure ? 'default' : 'destructive'}>
                          {verificationResult.isSecure ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Valid Certificate</span>
                        <Badge variant={verificationResult.hasValidCertificate ? 'default' : 'destructive'}>
                          {verificationResult.hasValidCertificate ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Errors and Recommendations */}
                {verificationResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Security Issues Found</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-disc pl-6">
                        {verificationResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {verificationResult.recommendations.length > 0 && (
                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertTitle>Recommendations</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-disc pl-6">
                        {verificationResult.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {verificationResult && (
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  <div className="text-sm space-y-2">
                    <h3 className="font-medium">Connection Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>Current URL: <code className="bg-gray-100 px-1 rounded">{window.location.href}</code></div>
                      <div>Protocol: <code className="bg-gray-100 px-1 rounded">{window.location.protocol}</code></div>
                      <div>Host: <code className="bg-gray-100 px-1 rounded">{window.location.host}</code></div>
                      <div>Port: <code className="bg-gray-100 px-1 rounded">{window.location.port || 'default'}</code></div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="font-medium">Browser Information</h3>
                    <div className="text-xs space-y-1">
                      <div>User Agent: <code className="bg-gray-100 px-1 rounded break-all">{navigator.userAgent}</code></div>
                      <div>Cookies Enabled: <code className="bg-gray-100 px-1 rounded">{navigator.cookieEnabled ? 'Yes' : 'No'}</code></div>
                      <div>Online Status: <code className="bg-gray-100 px-1 rounded">{navigator.onLine ? 'Online' : 'Offline'}</code></div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="font-medium">Performance Timing</h3>
                    <div className="text-xs">
                      {performance.timing && (
                        <div className="space-y-1">
                          <div>DNS Lookup: <code className="bg-gray-100 px-1 rounded">{performance.timing.domainLookupEnd - performance.timing.domainLookupStart}ms</code></div>
                          <div>Connect: <code className="bg-gray-100 px-1 rounded">{performance.timing.connectEnd - performance.timing.connectStart}ms</code></div>
                          <div>SSL: <code className="bg-gray-100 px-1 rounded">{performance.timing.secureConnectionStart > 0 ? performance.timing.connectEnd - performance.timing.secureConnectionStart : 'N/A'}ms</code></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="fixes" className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-medium">Quick Fix Actions</h3>
              
              <div className="grid gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Force Page Reload</div>
                    <div className="text-sm text-gray-500">Clear browser cache and reload resources</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={handleFixMixedContent}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Scan Mixed Content</div>
                    <div className="text-sm text-gray-500">Identify HTTP resources on HTTPS pages</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(registration => registration.unregister());
                        toast({
                          title: "Service Workers Cleared",
                          description: "All service workers have been unregistered.",
                        });
                      });
                    }
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Clear Service Workers</div>
                    <div className="text-sm text-gray-500">Remove cached service workers that might cause issues</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={() => window.open('https://www.ssllabs.com/ssltest/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Test SSL Certificate</div>
                    <div className="text-sm text-gray-500">Run external SSL certificate test</div>
                  </div>
                </Button>
              </div>

              {verificationResult && verificationResult.recommendations.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Specific Recommendations</h4>
                  <Alert>
                    <AlertTitle>Action Items</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-decimal pl-6">
                        {connectionVerifier.getFixRecommendations(verificationResult).map((rec, index) => (
                          <li key={index} className="mb-1">{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ConnectionVerificationPanel;
