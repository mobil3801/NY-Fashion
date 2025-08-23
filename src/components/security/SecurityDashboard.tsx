/**
 * Security Dashboard Component
 * Provides visibility into the application's security status for administrators
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useSecurity } from './ProductionSecurityProvider';
import { environmentValidator } from '@/utils/env-validator';
import { securityHeadersManager } from '@/utils/security-headers';
import { secureAuthManager } from '@/utils/secure-auth-manager';
import { productionDebugDisabler } from '@/utils/production-debug-disabler';

const SecurityDashboard: React.FC = () => {
  const {
    isSecure,
    securityIssues,
    httpsEnforced,
    debugDisabled,
    auditResults,
    performSecurityCheck
  } = useSecurity();

  const [envReport, setEnvReport] = useState<any>(null);
  const [headersReport, setHeadersReport] = useState<any>(null);
  const [authStats, setAuthStats] = useState<any>(null);
  const [debugStatus, setDebugStatus] = useState<any>(null);

  useEffect(() => {
    loadSecurityReports();
  }, []);

  const loadSecurityReports = () => {
    // Environment validation report
    setEnvReport(environmentValidator.generateProductionReport());

    // Security headers report
    setHeadersReport(securityHeadersManager.generateSecurityReport());

    // Auth security stats
    setAuthStats(secureAuthManager.getSecurityStats());

    // Debug disabler status
    setDebugStatus(productionDebugDisabler.getStatus());
  };

  const getSecurityScore = (): {score: number;grade: string;color: string;} => {
    let score = 100;

    // Deduct points for issues
    score -= securityIssues.length * 10;
    score -= envReport?.criticalIssues?.length * 15;
    score -= headersReport?.missingHeaders?.length * 5;
    score -= auditResults?.issues?.length * 8;

    // Bonus points for good practices
    if (httpsEnforced) score += 5;
    if (debugDisabled) score += 10;
    if (envReport?.isProductionReady) score += 5;

    score = Math.max(0, Math.min(100, score));

    let grade = 'F';
    let color = 'destructive';

    if (score >= 90) {grade = 'A';color = 'default';} else
    if (score >= 80) {grade = 'B';color = 'secondary';} else
    if (score >= 70) {grade = 'C';color = 'outline';} else
    if (score >= 60) {grade = 'D';color = 'destructive';}

    return { score, grade, color };
  };

  const securityScore = getSecurityScore();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
        </div>
        <Button onClick={() => {performSecurityCheck();loadSecurityReports();}} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{securityScore.score}%</div>
              <Badge variant={securityScore.color as any}>{securityScore.grade}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isSecure ?
              <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">Secure</span>
                </> :

              <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-700">Issues Found</span>
                </>
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">HTTPS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {httpsEnforced ?
              <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">Enforced</span>
                </> :

              <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-700">Not Enforced</span>
                </>
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Debug Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {debugDisabled ?
              <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">Disabled</span>
                </> :

              <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-700">Enabled</span>
                </>
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Issues Alert */}
      {securityIssues.length > 0 &&
      <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">Security Issues Detected:</div>
            <ul className="list-disc list-inside space-y-1">
              {securityIssues.map((issue, index) =>
            <li key={index}>{issue}</li>
            )}
            </ul>
          </AlertDescription>
        </Alert>
      }

      {/* Detailed Reports */}
      <Tabs defaultValue="environment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="headers">Security Headers</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="debug">Debug Status</TabsTrigger>
        </TabsList>

        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {envReport &&
              <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Production Ready:</span>
                    {envReport.isProductionReady ?
                  <Badge variant="default">Yes</Badge> :

                  <Badge variant="destructive">No</Badge>
                  }
                  </div>

                  {envReport.criticalIssues.length > 0 &&
                <div>
                      <h4 className="font-medium text-red-700 mb-2">Critical Issues:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {envReport.criticalIssues.map((issue: string, index: number) =>
                    <li key={index} className="text-red-600">{issue}</li>
                    )}
                      </ul>
                    </div>
                }

                  {envReport.warnings.length > 0 &&
                <div>
                      <h4 className="font-medium text-yellow-700 mb-2">Warnings:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {envReport.warnings.map((warning: string, index: number) =>
                    <li key={index} className="text-yellow-600">{warning}</li>
                    )}
                      </ul>
                    </div>
                }

                  <div>
                    <h4 className="font-medium mb-2">Configured Variables:</h4>
                    <div className="flex flex-wrap gap-2">
                      {envReport.configuredVars.map((varName: string) =>
                    <Badge key={varName} variant="outline">{varName}</Badge>
                    )}
                    </div>
                  </div>
                </>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Headers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {headersReport &&
              <>
                  <div>
                    <h4 className="font-medium mb-2">Configured Headers:</h4>
                    <div className="flex flex-wrap gap-2">
                      {headersReport.headersConfigured.map((header: string) =>
                    <Badge key={header} variant="default">{header}</Badge>
                    )}
                    </div>
                  </div>

                  {headersReport.missingHeaders.length > 0 &&
                <div>
                      <h4 className="font-medium text-yellow-700 mb-2">Missing Headers:</h4>
                      <div className="flex flex-wrap gap-2">
                        {headersReport.missingHeaders.map((header: string) =>
                    <Badge key={header} variant="destructive">{header}</Badge>
                    )}
                      </div>
                    </div>
                }

                  {headersReport.cspValidation && !headersReport.cspValidation.isValid &&
                <div>
                      <h4 className="font-medium text-red-700 mb-2">CSP Issues:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {headersReport.cspValidation.issues.map((issue: string, index: number) =>
                    <li key={index} className="text-red-600">{issue}</li>
                    )}
                      </ul>
                    </div>
                }
                </>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {authStats &&
              <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Failed Attempts</div>
                      <div className="text-2xl font-bold">{authStats.totalFailedAttempts}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Locked Accounts</div>
                      <div className="text-2xl font-bold text-red-600">{authStats.lockedAccounts}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Active Sessions</div>
                      <div className="text-2xl font-bold text-green-600">{authStats.activeSessions}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Suspicious Activity</div>
                      <div className="text-2xl font-bold text-yellow-600">{authStats.suspiciousActivity}</div>
                    </div>
                  </div>
                </>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Debug Mode Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {debugStatus &&
              <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Environment:</span>
                        <Badge variant={debugStatus.isProduction ? 'default' : 'secondary'}>
                          {debugStatus.isProduction ? 'Production' : 'Development'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Debug Disabled:</span>
                        <Badge variant={debugStatus.debugDisabled ? 'default' : 'destructive'}>
                          {debugStatus.debugDisabled ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Console Disabled:</span>
                        <Badge variant={debugStatus.consoleDisabled ? 'default' : 'destructive'}>
                          {debugStatus.consoleDisabled ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Panels Removed:</span>
                        <Badge variant={debugStatus.panelsRemoved ? 'default' : 'destructive'}>
                          {debugStatus.panelsRemoved ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default SecurityDashboard;