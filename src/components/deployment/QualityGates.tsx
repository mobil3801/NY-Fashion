import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TestTube,
  Shield,
  Code,
  Zap } from
'lucide-react';

interface QualityGate {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'pending' | 'running';
  score?: number;
  threshold: number;
  details?: any;
}

interface QualityGateReport {
  deployment_id: string;
  overall_status: 'passed' | 'failed' | 'pending';
  gates: QualityGate[];
  created_at: string;
}

const QualityGates: React.FC<{deploymentId?: string;}> = ({ deploymentId }) => {
  const [report, setReport] = useState<QualityGateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (deploymentId) {
      loadQualityGateReport(deploymentId);
    } else {
      loadLatestReport();
    }
  }, [deploymentId]);

  const loadQualityGateReport = async (id: string) => {
    setLoading(true);
    try {
      // In production, this would fetch from your quality gates API
      // For demo, we'll create mock data
      const mockReport: QualityGateReport = {
        deployment_id: id,
        overall_status: 'passed',
        created_at: new Date().toISOString(),
        gates: [
        {
          id: 'test_coverage',
          name: 'Test Coverage',
          description: 'Code coverage must be at least 80%',
          status: 'passed',
          score: 85,
          threshold: 80
        },
        {
          id: 'security_scan',
          name: 'Security Scan',
          description: 'No high or critical security vulnerabilities',
          status: 'passed',
          score: 95,
          threshold: 90,
          details: {
            high_vulnerabilities: 0,
            medium_vulnerabilities: 2,
            low_vulnerabilities: 5
          }
        },
        {
          id: 'code_quality',
          name: 'Code Quality',
          description: 'Code quality metrics above threshold',
          status: 'passed',
          score: 78,
          threshold: 75,
          details: {
            complexity: 6.2,
            maintainability: 82,
            reliability: 95
          }
        },
        {
          id: 'performance',
          name: 'Performance Tests',
          description: 'Performance benchmarks meet requirements',
          status: 'failed',
          score: 65,
          threshold: 80,
          details: {
            response_time: 450,
            throughput: 850,
            error_rate: 0.2
          }
        },
        {
          id: 'build_success',
          name: 'Build Success',
          description: 'Application builds without errors',
          status: 'passed',
          score: 100,
          threshold: 100
        }]

      };

      // Determine overall status based on gates
      const failedGates = mockReport.gates.filter((gate) => gate.status === 'failed');
      mockReport.overall_status = failedGates.length === 0 ? 'passed' : 'failed';

      setReport(mockReport);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load quality gate report",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const loadLatestReport = async () => {
    // Load the most recent quality gate report
    await loadQualityGateReport('latest');
  };

  const retryFailedGate = async (gateId: string) => {
    try {
      toast({
        title: "Retrying Quality Gate",
        description: "Quality gate check has been restarted"
      });

      // In production, this would trigger a retry of the specific quality gate
      // For demo, we'll simulate a retry
      setTimeout(() => {
        if (report) {
          const updatedReport = { ...report };
          const gateIndex = updatedReport.gates.findIndex((g) => g.id === gateId);
          if (gateIndex !== -1) {
            updatedReport.gates[gateIndex].status = 'running';
            setReport(updatedReport);
          }
        }

        // Simulate completion after 3 seconds
        setTimeout(() => {
          if (report) {
            const finalReport = { ...report };
            const gateIndex = finalReport.gates.findIndex((g) => g.id === gateId);
            if (gateIndex !== -1) {
              finalReport.gates[gateIndex].status = Math.random() > 0.5 ? 'passed' : 'failed';
              setReport(finalReport);
            }
          }
        }, 3000);
      }, 1000);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retry quality gate",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      passed: 'default',
      failed: 'destructive',
      running: 'default',
      pending: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>);

  };

  const getGateIcon = (gateId: string) => {
    switch (gateId) {
      case 'test_coverage':
        return <TestTube className="h-5 w-5" />;
      case 'security_scan':
        return <Shield className="h-5 w-5" />;
      case 'code_quality':
        return <Code className="h-5 w-5" />;
      case 'performance':
        return <Zap className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Loading quality gates...</span>
        </div>
      </Card>);

  }

  if (!report) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">No quality gate reports available</p>
      </Card>);

  }

  const passedGates = report.gates.filter((gate) => gate.status === 'passed').length;
  const totalGates = report.gates.length;
  const overallProgress = passedGates / totalGates * 100;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Quality Gates Report</h3>
          <div className="flex items-center gap-2">
            {getStatusBadge(report.overall_status)}
            <span className="text-sm text-gray-600">
              {passedGates}/{totalGates} Gates Passed
            </span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-gray-600">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        <div className="grid gap-4">
          {report.gates.map((gate) =>
          <div key={gate.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getGateIcon(gate.id)}
                  </div>
                  <div>
                    <h4 className="font-medium">{gate.name}</h4>
                    <p className="text-sm text-gray-600">{gate.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(gate.status)}
                  {gate.status === 'failed' &&
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryFailedGate(gate.id)}>

                      Retry
                    </Button>
                }
                </div>
              </div>

              {gate.score !== undefined &&
            <div className="flex items-center gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Score</span>
                      <span className="text-sm">
                        {gate.score}% (threshold: {gate.threshold}%)
                      </span>
                    </div>
                    <Progress
                  value={gate.score}
                  className={`h-2 ${gate.score >= gate.threshold ? 'text-green-500' : 'text-red-500'}`} />

                  </div>
                </div>
            }

              {gate.details &&
            <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(gate.details).map(([key, value]) =>
                <div key={key}>
                        <span className="font-medium capitalize">
                          {key.replace('_', ' ')}:
                        </span>
                        <span className="ml-1">{String(value)}</span>
                      </div>
                )}
                  </div>
                </div>
            }
            </div>
          )}
        </div>
      </Card>
    </div>);

};

export default QualityGates;