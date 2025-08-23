
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  GitBranch, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play,
  Pause,
  RotateCcw,
  Settings,
  Database,
  Shield,
  Zap,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration: number;
  startTime?: string;
  endTime?: string;
  logs: string[];
  artifacts: any[];
  validations: ValidationCheck[];
}

interface ValidationCheck {
  name: string;
  status: 'pending' | 'passed' | 'failed';
  message: string;
  critical: boolean;
}

const DeploymentPipelineManager: React.FC = () => {
  const [selectedDeployment, setSelectedDeployment] = useState<string>('deploy_1234567890');
  const [showStageDetails, setShowStageDetails] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  
  // Mock pipeline stages
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
    {
      id: 'pre-deployment',
      name: 'Pre-deployment Validation',
      status: 'success',
      duration: 45000,
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:00:45Z',
      logs: [
        'Checking system requirements...',
        'Validating environment configuration...',
        'Health checks passed',
        'Pre-deployment validation completed successfully'
      ],
      artifacts: [],
      validations: [
        { name: 'Environment Health', status: 'passed', message: 'All systems operational', critical: true },
        { name: 'Database Migration Check', status: 'passed', message: 'No pending migrations', critical: true },
        { name: 'Configuration Validation', status: 'passed', message: 'All configs valid', critical: false }
      ]
    },
    {
      id: 'build',
      name: 'Build & Package',
      status: 'success',
      duration: 120000,
      startTime: '2024-01-15T10:00:45Z',
      endTime: '2024-01-15T10:02:45Z',
      logs: [
        'Starting build process...',
        'Installing dependencies...',
        'Running webpack build...',
        'Optimizing assets...',
        'Build completed successfully'
      ],
      artifacts: [
        { name: 'build.zip', size: '15.2 MB', url: '/artifacts/build.zip' },
        { name: 'source-maps.zip', size: '3.4 MB', url: '/artifacts/source-maps.zip' }
      ],
      validations: [
        { name: 'Build Success', status: 'passed', message: 'Build completed without errors', critical: true },
        { name: 'Asset Optimization', status: 'passed', message: 'Assets optimized successfully', critical: false },
        { name: 'Bundle Size Check', status: 'passed', message: 'Bundle size within limits', critical: false }
      ]
    },
    {
      id: 'security-scan',
      name: 'Security & Compliance',
      status: 'running',
      duration: 0,
      startTime: '2024-01-15T10:02:45Z',
      logs: [
        'Running security vulnerability scan...',
        'Checking dependency vulnerabilities...',
        'Scanning for security compliance...'
      ],
      artifacts: [],
      validations: [
        { name: 'Vulnerability Scan', status: 'pending', message: 'Scanning in progress...', critical: true },
        { name: 'Dependency Check', status: 'pending', message: 'Checking dependencies...', critical: true },
        { name: 'Compliance Check', status: 'pending', message: 'Validating compliance...', critical: false }
      ]
    },
    {
      id: 'database-migration',
      name: 'Database Migration',
      status: 'pending',
      duration: 0,
      logs: [],
      artifacts: [],
      validations: [
        { name: 'Migration Scripts', status: 'pending', message: 'Waiting for security scan', critical: true },
        { name: 'Backup Verification', status: 'pending', message: 'Waiting for security scan', critical: true },
        { name: 'Rollback Plan', status: 'pending', message: 'Waiting for security scan', critical: false }
      ]
    },
    {
      id: 'staging-deployment',
      name: 'Staging Deployment',
      status: 'pending',
      duration: 0,
      logs: [],
      artifacts: [],
      validations: [
        { name: 'Environment Ready', status: 'pending', message: 'Waiting for database migration', critical: true },
        { name: 'Load Balancer Config', status: 'pending', message: 'Waiting for database migration', critical: false }
      ]
    },
    {
      id: 'integration-tests',
      name: 'Integration Tests',
      status: 'pending',
      duration: 0,
      logs: [],
      artifacts: [],
      validations: [
        { name: 'API Tests', status: 'pending', message: 'Waiting for staging deployment', critical: true },
        { name: 'UI Tests', status: 'pending', message: 'Waiting for staging deployment', critical: true },
        { name: 'Performance Tests', status: 'pending', message: 'Waiting for staging deployment', critical: false }
      ]
    },
    {
      id: 'production-deployment',
      name: 'Production Deployment',
      status: 'pending',
      duration: 0,
      logs: [],
      artifacts: [],
      validations: [
        { name: 'Final Approval', status: 'pending', message: 'Waiting for integration tests', critical: true },
        { name: 'Blue-Green Switch', status: 'pending', message: 'Waiting for integration tests', critical: true }
      ]
    },
    {
      id: 'post-deployment',
      name: 'Post-deployment Validation',
      status: 'pending',
      duration: 0,
      logs: [],
      artifacts: [],
      validations: [
        { name: 'Health Check', status: 'pending', message: 'Waiting for production deployment', critical: true },
        { name: 'Smoke Tests', status: 'pending', message: 'Waiting for production deployment', critical: true },
        { name: 'Monitoring Setup', status: 'pending', message: 'Waiting for production deployment', critical: false }
      ]
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getValidationStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const handleStageAction = (stageId: string, action: 'start' | 'pause' | 'retry' | 'skip') => {
    setPipelineStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        switch (action) {
          case 'start':
            return { ...stage, status: 'running', startTime: new Date().toISOString() };
          case 'pause':
            return { ...stage, status: 'pending' };
          case 'retry':
            return { ...stage, status: 'running', startTime: new Date().toISOString() };
          case 'skip':
            return { ...stage, status: 'skipped' };
        }
      }
      return stage;
    }));
    
    toast.success(`Stage ${action} action triggered`);
  };

  const calculateProgress = () => {
    const completedStages = pipelineStages.filter(stage => stage.status === 'success').length;
    return (completedStages / pipelineStages.length) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Deployment Pipeline: {selectedDeployment}
              </CardTitle>
              <p className="text-gray-600 mt-1">Track and control deployment pipeline stages</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-2xl font-bold">{calculateProgress().toFixed(0)}%</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={calculateProgress()} className="mb-4" />
          <div className="text-sm text-gray-600">
            {pipelineStages.filter(s => s.status === 'success').length} of {pipelineStages.length} stages completed
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pipelineStages.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  {getStatusIcon(stage.status)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{stage.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(stage.status)}>
                        {stage.status}
                      </Badge>
                      {stage.duration > 0 && (
                        <span className="text-sm text-gray-500">
                          {Math.round(stage.duration / 1000)}s
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Validation Status */}
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Validations:</span>
                      {stage.validations.map((validation, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          {getValidationStatusIcon(validation.status)}
                          {validation.critical && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                        </div>
                      ))}
                    </div>
                    {stage.artifacts.length > 0 && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <FileText className="w-3 h-3" />
                        {stage.artifacts.length} artifacts
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {stage.status === 'pending' && index === pipelineStages.findIndex(s => s.status === 'pending') && (
                    <Button
                      size="sm"
                      onClick={() => handleStageAction(stage.id, 'start')}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {stage.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStageAction(stage.id, 'pause')}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {stage.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStageAction(stage.id, 'retry')}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedStage(stage);
                      setShowStageDetails(true);
                    }}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Configuration Validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Environment Variables</span>
              <Badge variant="default">Validated</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Database Schema</span>
              <Badge variant="default">Up to date</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>API Endpoints</span>
              <Badge variant="default">Accessible</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>SSL Certificates</span>
              <Badge variant="outline">Expires in 45 days</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Vulnerability Scan</span>
              <Badge variant="default">Clean</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Dependency Audit</span>
              <Badge variant="outline">2 Minor Issues</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Code Quality</span>
              <Badge variant="default">Passed</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>OWASP Check</span>
              <Badge variant="default">Compliant</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Details Dialog */}
      <Dialog open={showStageDetails} onOpenChange={setShowStageDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedStage && getStatusIcon(selectedStage.status)}
              Stage Details: {selectedStage?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedStage && (
            <Tabs defaultValue="validations" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="validations">Validations</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="validations" className="space-y-4">
                {selectedStage.validations.map((validation, index) => (
                  <Alert key={index} className={validation.status === 'failed' ? 'border-red-500' : ''}>
                    <div className="flex items-center gap-2">
                      {getValidationStatusIcon(validation.status)}
                      {validation.critical && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    </div>
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{validation.name}</div>
                          <div className="text-sm mt-1">{validation.message}</div>
                        </div>
                        <Badge variant={validation.critical ? 'destructive' : 'outline'}>
                          {validation.critical ? 'Critical' : 'Optional'}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </TabsContent>

              <TabsContent value="logs">
                <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                  {selectedStage.logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                    </div>
                  ))}
                  {selectedStage.logs.length === 0 && (
                    <div className="text-gray-500">No logs available</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="artifacts">
                <div className="space-y-3">
                  {selectedStage.artifacts.map((artifact, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">{artifact.name}</span>
                        <Badge variant="outline">{artifact.size}</Badge>
                      </div>
                      <Button size="sm" variant="outline">
                        Download
                      </Button>
                    </div>
                  ))}
                  {selectedStage.artifacts.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No artifacts generated</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="config">
                <Textarea
                  className="font-mono text-sm"
                  rows={15}
                  value={JSON.stringify({
                    stage: selectedStage.name,
                    timeout: 300000,
                    retries: 3,
                    environment: {
                      NODE_ENV: 'production',
                      API_ENDPOINT: 'https://api.production.com'
                    }
                  }, null, 2)}
                  readOnly
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeploymentPipelineManager;
