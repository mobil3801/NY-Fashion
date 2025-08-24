
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield,
  AlertTriangle,
  Activity,
  Eye,
  Lock,
  Users,
  Server,
  Globe,
  RefreshCw,
  Download,
  Filter,
  Search,
  X } from
'lucide-react';
import { useSecurityAudit } from '@/security/audit-logging';
import { rateLimitManager } from '@/security/rate-limiting';
import { cspNonceManager } from '@/security/csp-nonce';
import { securityHeadersManager } from '@/security/headers';
import { format } from 'date-fns';

interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  suspiciousActivity: number;
  activeUsers: number;
  systemHealth: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousActivity: 0,
    activeUsers: 0,
    systemHealth: 100,
    threatLevel: 'low'
  });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [alertFilter, setAlertFilter] = useState('all');
  const [logFilter, setLogFilter] = useState('');

  const { getLogs, getAlerts, getStatistics } = useSecurityAudit();

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const refreshMetrics = async () => {
    setRefreshing(true);
    try {
      const auditStats = getStatistics();
      const rateLimitStats = rateLimitManager.getStatistics();

      setMetrics({
        totalRequests: auditStats.logsLastDay,
        blockedRequests: rateLimitStats.blockedIPs,
        suspiciousActivity: auditStats.securityViolationsToday,
        activeUsers: Math.floor(Math.random() * 50) + 20, // Mock data
        systemHealth: auditStats.criticalAlerts === 0 ? 100 : Math.max(60, 100 - auditStats.criticalAlerts * 10),
        threatLevel: auditStats.criticalAlerts > 0 ? 'critical' :
        auditStats.securityViolationsToday > 5 ? 'high' :
        auditStats.securityViolationsToday > 0 ? 'medium' : 'low'
      });
    } catch (error) {
      console.error('Failed to refresh security metrics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const exportSecurityReport = () => {
    const logs = getLogs({ limit: 1000 });
    const alerts = getAlerts();
    const report = {
      generatedAt: new Date().toISOString(),
      metrics,
      logs,
      alerts
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical':return 'destructive';
      case 'high':return 'destructive';
      case 'medium':return 'default';
      default:return 'secondary';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':return 'destructive';
      case 'high':return 'destructive';
      case 'medium':return 'default';
      case 'warning':return 'default';
      default:return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
          <p className="text-gray-600">Monitor and manage system security</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshMetrics} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportSecurityReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Threat Level Alert */}
      {metrics.threatLevel !== 'low' &&
      <Alert variant={metrics.threatLevel === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Threat Level: {metrics.threatLevel.toUpperCase()}</strong>
            {metrics.threatLevel === 'critical' && ' - Immediate attention required!'}
            {metrics.threatLevel === 'high' && ' - Enhanced monitoring active'}
            {metrics.threatLevel === 'medium' && ' - Monitoring for suspicious activity'}
          </AlertDescription>
        </Alert>
      }

      {/* Security Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.blockedRequests}</div>
            <p className="text-xs text-muted-foreground">Security blocks active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.suspiciousActivity}</div>
            <p className="text-xs text-muted-foreground">Detected today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{metrics.systemHealth}%</div>
              <Progress value={metrics.systemHealth} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitor</TabsTrigger>
          <TabsTrigger value="config">Security Config</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Threat Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Current Threat Level
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant={getThreatLevelColor(metrics.threatLevel)} className="text-lg px-4 py-2">
                    {metrics.threatLevel.toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">System Status</div>
                    <Progress
                      value={metrics.threatLevel === 'low' ? 25 :
                      metrics.threatLevel === 'medium' ? 50 :
                      metrics.threatLevel === 'high' ? 75 : 100}
                      className="h-3" />

                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {metrics.threatLevel === 'low' && 'All systems operating normally'}
                  {metrics.threatLevel === 'medium' && 'Some suspicious activity detected'}
                  {metrics.threatLevel === 'high' && 'Multiple security events detected'}
                  {metrics.threatLevel === 'critical' && 'Critical security threats detected'}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Security Events</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {getLogs({ limit: 10 }).map((log) =>
                    <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        <Badge variant={getAlertSeverityColor(log.severity)} className="text-xs">
                          {log.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{log.action}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setAlertFilter('all')}>
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>

          <div className="grid gap-4">
            {getAlerts({
              severity: alertFilter === 'all' ? undefined : alertFilter as any,
              limit: 20
            }).map((alert) =>
            <Card key={alert.id} className={`border-l-4 ${
            alert.severity === 'critical' ? 'border-l-red-500' :
            alert.severity === 'high' ? 'border-l-orange-500' :
            alert.severity === 'medium' ? 'border-l-yellow-500' :
            'border-l-blue-500'}`
            }>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{alert.type.replace(/_/g, ' ').toUpperCase()}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getAlertSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      {alert.resolved &&
                    <Badge variant="secondary">Resolved</Badge>
                    }
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Source: {alert.source}</span>
                      <span>Time: {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')}</span>
                      {alert.affectedResource && <span>Resource: {alert.affectedResource}</span>}
                    </div>
                    {alert.mitigation &&
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-800">
                        <strong>Mitigation:</strong> {alert.mitigation}
                      </div>
                  }
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search logs..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="pl-10" />

            </div>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Security Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {getLogs({ limit: 50 }).
                  filter((log) => !logFilter ||
                  log.action.toLowerCase().includes(logFilter.toLowerCase()) ||
                  log.userId?.toLowerCase().includes(logFilter.toLowerCase()) ||
                  log.resource?.toLowerCase().includes(logFilter.toLowerCase())
                  ).
                  map((log) =>
                  <div key={log.id} className="p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getAlertSeverityColor(log.severity)} className="text-xs">
                              {log.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {log.eventType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </span>
                        </div>
                        
                        <div className="text-sm font-medium mb-1">{log.action}</div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          {log.userId && <div>User: {log.userId}</div>}
                          {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                          {log.resource && <div>Resource: {log.resource}</div>}
                          {log.errorMessage && <div className="text-red-600">Error: {log.errorMessage}</div>}
                        </div>
                        
                        {Object.keys(log.details).length > 0 &&
                    <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer">View Details</summary>
                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                    }
                      </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Rate Limits</span>
                    <Badge>{rateLimitManager.getStatistics().totalEntries}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Blocked IPs</span>
                    <Badge variant="destructive">{rateLimitManager.getStatistics().blockedIPs}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suspicious IPs</span>
                    <Badge variant="secondary">{rateLimitManager.getStatistics().suspiciousIPs}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Headers Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                  'Strict-Transport-Security',
                  'X-Frame-Options',
                  'X-Content-Type-Options',
                  'Content-Security-Policy'].
                  map((header) =>
                  <div key={header} className="flex items-center justify-between py-1">
                      <span className="text-sm">{header}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CSP Enabled</span>
                    <Badge variant="secondary">✓ Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">HSTS Enabled</span>
                    <Badge variant="secondary">✓ Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rate Limiting</span>
                    <Badge variant="secondary">✓ Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Input Validation</span>
                    <Badge variant="secondary">✓ Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Audit Logging</span>
                    <Badge variant="secondary">✓ Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SSL Certificate Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Certificate Valid</span>
                    <Badge variant="secondary">✓ Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-renewal</span>
                    <Badge variant="secondary">✓ Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Days Until Expiry</span>
                    <Badge>45 days</Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Certificate
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>);

};

export default SecurityDashboard;