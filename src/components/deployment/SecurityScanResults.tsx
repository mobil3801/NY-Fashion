import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Package, 
  Code,
  Zap,
  Download,
  RefreshCw
} from 'lucide-react';

interface SecurityScanResult {
  id: number;
  scan_type: string;
  environment: string;
  status: string;
  vulnerabilities_high: number;
  vulnerabilities_medium: number;
  vulnerabilities_low: number;
  scan_time: string;
  report_data: string;
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  package?: string;
  version?: string;
  fixedIn?: string;
  cve?: string;
}

const SecurityScanResults: React.FC = () => {
  const [scanResults, setScanResults] = useState<SecurityScanResult[]>([]);
  const [selectedScan, setSelectedScan] = useState<SecurityScanResult | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInProgress, setScanInProgress] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadScanResults();
  }, []);

  const loadScanResults = async () => {
    try {
      // For demo purposes, we'll create some mock data since we don't have security scan tables
      // In production, this would query your security scan results table
      const mockResults: SecurityScanResult[] = [
        {
          id: 1,
          scan_type: 'dependency_audit',
          environment: 'production',
          status: 'completed',
          vulnerabilities_high: 2,
          vulnerabilities_medium: 5,
          vulnerabilities_low: 12,
          scan_time: new Date(Date.now() - 86400000).toISOString(),
          report_data: JSON.stringify({
            vulnerabilities: [
              {
                id: 'CVE-2024-1234',
                title: 'Cross-site scripting in React Router',
                severity: 'high',
                description: 'Potential XSS vulnerability in route handling',
                package: 'react-router-dom',
                version: '6.26.1',
                fixedIn: '6.26.2',
                cve: 'CVE-2024-1234'
              },
              {
                id: 'CVE-2024-5678',
                title: 'Prototype pollution in lodash',
                severity: 'medium',
                description: 'Prototype pollution vulnerability',
                package: 'lodash',
                version: '4.17.20',
                fixedIn: '4.17.21',
                cve: 'CVE-2024-5678'
              }
            ]
          })
        },
        {
          id: 2,
          scan_type: 'code_analysis',
          environment: 'staging',
          status: 'completed',
          vulnerabilities_high: 0,
          vulnerabilities_medium: 3,
          vulnerabilities_low: 8,
          scan_time: new Date(Date.now() - 43200000).toISOString(),
          report_data: JSON.stringify({
            vulnerabilities: [
              {
                id: 'ESL-001',
                title: 'Potential SQL injection',
                severity: 'medium',
                description: 'Dynamic SQL query construction detected',
                package: 'custom-code',
                version: '1.0.0'
              }
            ]
          })
        }
      ];

      setScanResults(mockResults);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load security scan results",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const triggerSecurityScan = async (scanType: string) => {
    setScanInProgress(true);
    try {
      // In production, this would trigger a GitHub Actions workflow
      // or call your security scanning API
      
      toast({
        title: "Security Scan Initiated",
        description: `${scanType} scan has been started`,
      });

      // Simulate scan progress
      setTimeout(() => {
        setScanInProgress(false);
        loadScanResults();
        toast({
          title: "Scan Complete",
          description: "Security scan has completed successfully",
        });
      }, 5000);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger security scan",
        variant: "destructive"
      });
      setScanInProgress(false);
    }
  };

  const getSeverityBadge = (severity: string, count?: number) => {
    const variants = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'secondary',
      low: 'outline'
    } as const;

    const colors = {
      critical: 'text-red-700 bg-red-100',
      high: 'text-red-600 bg-red-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-gray-600 bg-gray-50'
    } as const;

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'outline'}>
        {severity.toUpperCase()} {count !== undefined && `(${count})`}
      </Badge>
    );
  };

  const getOverallScore = (scan: SecurityScanResult) => {
    const total = scan.vulnerabilities_high + scan.vulnerabilities_medium + scan.vulnerabilities_low;
    if (total === 0) return 100;
    
    const weighted = (scan.vulnerabilities_high * 10) + (scan.vulnerabilities_medium * 5) + (scan.vulnerabilities_low * 1);
    return Math.max(0, 100 - weighted);
  };

  const viewScanDetails = (scan: SecurityScanResult) => {
    setSelectedScan(scan);
    try {
      const reportData = JSON.parse(scan.report_data);
      setVulnerabilities(reportData.vulnerabilities || []);
    } catch (error) {
      setVulnerabilities([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Security Scan Results</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => triggerSecurityScan('dependency_audit')}
            disabled={scanInProgress}
            variant="outline"
          >
            <Package className="h-4 w-4 mr-2" />
            Dependency Scan
          </Button>
          <Button
            onClick={() => triggerSecurityScan('code_analysis')}
            disabled={scanInProgress}
            variant="outline"
          >
            <Code className="h-4 w-4 mr-2" />
            Code Analysis
          </Button>
          <Button onClick={loadScanResults} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {scanInProgress && (
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="animate-spin">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800">Security Scan in Progress</h3>
              <p className="text-sm text-blue-600">Running security analysis...</p>
              <Progress value={33} className="mt-2" />
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4">
            {scanResults.map((scan) => {
              const score = getOverallScore(scan);
              const totalVulns = scan.vulnerabilities_high + scan.vulnerabilities_medium + scan.vulnerabilities_low;
              
              return (
                <Card key={scan.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5" />
                        <h3 className="text-lg font-semibold capitalize">
                          {scan.scan_type.replace('_', ' ')} - {scan.environment}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        Scanned: {new Date(scan.scan_time).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {score}
                        <span className="text-sm font-normal text-gray-600">/100</span>
                      </div>
                      <p className="text-sm text-gray-600">Security Score</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{scan.vulnerabilities_high}</div>
                      <div className="text-sm text-gray-600">High</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{scan.vulnerabilities_medium}</div>
                      <div className="text-sm text-gray-600">Medium</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{scan.vulnerabilities_low}</div>
                      <div className="text-sm text-gray-600">Low</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{totalVulns}</div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {scan.vulnerabilities_high > 0 && getSeverityBadge('high', scan.vulnerabilities_high)}
                      {scan.vulnerabilities_medium > 0 && getSeverityBadge('medium', scan.vulnerabilities_medium)}
                      {scan.vulnerabilities_low > 0 && getSeverityBadge('low', scan.vulnerabilities_low)}
                      {totalVulns === 0 && (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          No Issues Found
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewScanDetails(scan)}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="vulnerabilities">
          {selectedScan ? (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Vulnerabilities - {selectedScan.scan_type} ({selectedScan.environment})
                </h3>
                <div className="space-y-4">
                  {vulnerabilities.map((vuln, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{vuln.title}</h4>
                            {getSeverityBadge(vuln.severity)}
                          </div>
                          {vuln.cve && (
                            <p className="text-sm text-blue-600 font-mono mb-1">{vuln.cve}</p>
                          )}
                          <p className="text-sm text-gray-600 mb-2">{vuln.description}</p>
                          {vuln.package && (
                            <div className="text-sm">
                              <span className="font-medium">Package:</span> {vuln.package}
                              {vuln.version && ` (${vuln.version})`}
                              {vuln.fixedIn && (
                                <span className="text-green-600 ml-2">
                                  → Fixed in {vuln.fixedIn}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                      </div>
                    </div>
                  ))}
                  {vulnerabilities.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                      <p>No vulnerabilities found in this scan</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 text-center">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">Select a scan from the overview to view detailed vulnerability information</p>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compliance">
          <div className="grid gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Security Compliance Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>OWASP Top 10 Compliance</span>
                  </div>
                  <Badge variant="default">Compliant</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span>Dependency Vulnerabilities</span>
                  </div>
                  <Badge variant="destructive">2 High Risk</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Code Quality Gates</span>
                  </div>
                  <Badge variant="default">Passed</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span>Docker Image Security</span>
                  </div>
                  <Badge variant="secondary">3 Medium Risk</Badge>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityScanResults;
