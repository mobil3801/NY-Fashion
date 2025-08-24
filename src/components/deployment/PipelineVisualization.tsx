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
  Play,
  ArrowRight,
  GitBranch,
  Package,
  TestTube,
  Rocket,
  Shield
} from 'lucide-react';

interface PipelineStage {
  id: number;
  deployment_id: string;
  stage: string;
  stage_order: number;
  status: string;
  start_time: string;
  end_time?: string;
  logs: string;
  artifacts?: any;
}

interface PipelineVisualizationProps {
  deploymentId?: string;
}

const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({ deploymentId }) => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (deploymentId) {
      loadPipelineStages(deploymentId);
    } else {
      loadLatestPipeline();
    }
  }, [deploymentId]);

  const loadPipelineStages = async (id: string) => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37312, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "stage_order",
        IsAsc: true,
        Filters: [{ name: "deployment_id", op: "Equal", value: id }]
      });

      if (error) throw error;
      setStages(data.List);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pipeline stages",
        variant: "destructive"
      });
      
      // For demo purposes, create mock data
      const mockStages: PipelineStage[] = [
        {
          id: 1,
          deployment_id: id,
          stage: 'validation',
          stage_order: 1,
          status: 'success',
          start_time: new Date(Date.now() - 300000).toISOString(),
          end_time: new Date(Date.now() - 240000).toISOString(),
          logs: 'Validation completed successfully\nAll checks passed'
        },
        {
          id: 2,
          deployment_id: id,
          stage: 'build',
          stage_order: 2,
          status: 'success',
          start_time: new Date(Date.now() - 240000).toISOString(),
          end_time: new Date(Date.now() - 180000).toISOString(),
          logs: 'Build completed successfully\nArtifacts generated'
        },
        {
          id: 3,
          deployment_id: id,
          stage: 'test',
          stage_order: 3,
          status: 'running',
          start_time: new Date(Date.now() - 120000).toISOString(),
          logs: 'Running tests...\nTest coverage: 85%'
        },
        {
          id: 4,
          deployment_id: id,
          stage: 'security',
          stage_order: 4,
          status: 'pending',
          start_time: '',
          logs: ''
        },
        {
          id: 5,
          deployment_id: id,
          stage: 'deploy',
          stage_order: 5,
          status: 'pending',
          start_time: '',
          logs: ''
        }
      ];
      setStages(mockStages);
    }
    setLoading(false);
  };

  const loadLatestPipeline = async () => {
    // Load the most recent pipeline
    await loadPipelineStages('demo-pipeline-123');
  };

  const retryStage = async (stageId: number) => {
    try {
      toast({
        title: "Retrying Stage",
        description: "Pipeline stage is being restarted",
      });

      // In production, this would trigger a stage retry
      const updatedStages = stages.map(stage => {
        if (stage.id === stageId) {
          return {
            ...stage,
            status: 'running',
            start_time: new Date().toISOString(),
            end_time: undefined,
            logs: 'Retrying stage...'
          };
        }
        return stage;
      });
      setStages(updatedStages);

      // Simulate completion
      setTimeout(() => {
        const finalStages = stages.map(stage => {
          if (stage.id === stageId) {
            return {
              ...stage,
              status: Math.random() > 0.3 ? 'success' : 'failed',
              end_time: new Date().toISOString(),
              logs: stage.logs + '\nRetry completed'
            };
          }
          return stage;
        });
        setStages(finalStages);
      }, 3000);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retry stage",
        variant: "destructive"
      });
    }
  };

  const getStageIcon = (stageName: string) => {
    switch (stageName) {
      case 'validation':
        return <Shield className="h-5 w-5" />;
      case 'build':
        return <Package className="h-5 w-5" />;
      case 'test':
        return <TestTube className="h-5 w-5" />;
      case 'security':
        return <Shield className="h-5 w-5" />;
      case 'deploy':
        return <Rocket className="h-5 w-5" />;
      default:
        return <GitBranch className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      running: 'default',
      pending: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  const getDuration = (stage: PipelineStage) => {
    if (!stage.start_time) return '';
    if (!stage.end_time) {
      if (stage.status === 'running') {
        const duration = Math.floor((Date.now() - new Date(stage.start_time).getTime()) / 1000);
        return `${duration}s (running)`;
      }
      return '';
    }
    const duration = Math.floor((new Date(stage.end_time).getTime() - new Date(stage.start_time).getTime()) / 1000);
    return `${duration}s`;
  };

  const getOverallProgress = () => {
    const completedStages = stages.filter(s => s.status === 'success' || s.status === 'failed').length;
    return (completedStages / stages.length) * 100;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Loading pipeline...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Pipeline Visualization</h3>
          <div className="text-sm text-gray-600">
            Overall Progress: {Math.round(getOverallProgress())}%
          </div>
        </div>

        <div className="mb-6">
          <Progress value={getOverallProgress()} className="h-2" />
        </div>

        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${stage.status === 'success' ? 'bg-green-100 text-green-600' :
                      stage.status === 'failed' ? 'bg-red-100 text-red-600' :
                      stage.status === 'running' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-400'}
                  `}>
                    {getStageIcon(stage.stage)}
                  </div>
                </div>

                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium capitalize">{stage.stage}</h4>
                      <p className="text-sm text-gray-600">
                        Stage {stage.stage_order} of {stages.length}
                        {getDuration(stage) && ` • ${getDuration(stage)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(stage.status)}
                      {stage.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryStage(stage.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedStage(stage)}
                      >
                        View Logs
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div className="absolute left-6 top-12 w-px h-6 bg-gray-200"></div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Stage Logs Modal */}
      {selectedStage && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold capitalize">
              {selectedStage.stage} Stage Logs
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStage(null)}
            >
              Close
            </Button>
          </div>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm">
            <pre className="whitespace-pre-wrap">
              {selectedStage.logs || 'No logs available'}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PipelineVisualization;
