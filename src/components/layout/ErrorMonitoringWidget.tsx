
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Activity, Eye, Clock } from 'lucide-react';
import { useErrorMonitoring } from '@/contexts/ErrorMonitoringContext';
import ErrorMonitoringDashboard from '@/components/error-monitoring/ErrorMonitoringDashboard';
import RealTimeErrorMonitor from '@/components/error-monitoring/RealTimeErrorMonitor';

const ErrorMonitoringWidget: React.FC = () => {
  const {
    errorCount,
    criticalErrorCount,
    recentErrors,
    isLoading
  } = useErrorMonitoring();
  const [showDashboard, setShowDashboard] = useState(false);

  const getStatusColor = () => {
    if (criticalErrorCount > 0) return 'text-red-600 bg-red-50 border-red-200';
    if (errorCount > 10) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (errorCount > 0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusText = () => {
    if (criticalErrorCount > 0) return 'Critical Issues';
    if (errorCount > 10) return 'High Error Rate';
    if (errorCount > 0) return 'Some Issues';
    return 'All Systems OK';
  };

  if (isLoading) {
    return (
      <Card className="w-80">
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <Activity className="h-4 w-4 animate-pulse mr-2" />
            <span className="text-sm">Loading error data...</span>
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <>
      <Card className={`w-80 transition-colors ${getStatusColor()}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Error Monitor
            </div>
            <Dialog open={showDashboard} onOpenChange={setShowDashboard}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Error Monitoring Dashboard</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto">
                  <ErrorMonitoringDashboard />
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Summary */}
          <div className="flex items-center justify-between">
            <span className="font-medium">{getStatusText()}</span>
            <div className="flex items-center gap-2">
              {criticalErrorCount > 0 &&
              <Badge variant="destructive" className="text-xs">
                  {criticalErrorCount} Critical
                </Badge>
              }
              <Badge variant="outline" className="text-xs">
                {errorCount} Total
              </Badge>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-semibold text-lg">{errorCount}</div>
              <div className="text-muted-foreground">Total Errors</div>
            </div>
            <div>
              <div className="font-semibold text-lg">{criticalErrorCount}</div>
              <div className="text-muted-foreground">Critical</div>
            </div>
          </div>

          {/* Recent Errors Preview */}
          {recentErrors.length > 0 &&
          <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent Issues
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentErrors.slice(0, 3).map((error) =>
              <div
                key={error.id}
                className="text-xs p-2 rounded bg-white/50 border">

                    <div className="flex items-center gap-1 mb-1">
                      <Badge
                    variant="secondary"
                    className="text-xs h-4"
                    style={{
                      backgroundColor: error.severity_level <= 2 ? '#fef2f2' : '#f8fafc'
                    }}>

                        {error.severity_level <= 2 ? 'High' : 'Medium'}
                      </Badge>
                      <span className="text-xs opacity-75">
                        {error.occurrence_count}x
                      </span>
                    </div>
                    <p className="truncate">{error.error_message}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {error.error_type}
                      {error.component_name && ` • ${error.component_name}`}
                    </p>
                  </div>
              )}
              </div>
              {recentErrors.length > 3 &&
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setShowDashboard(true)}>

                  View All {recentErrors.length} Errors
                </Button>
            }
            </div>
          }

          {errorCount === 0 &&
          <div className="text-center py-4">
              <div className="text-green-600 mb-2">
                <Activity className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm text-green-700">
                No errors detected
              </p>
              <p className="text-xs text-green-600 mt-1">
                All systems running smoothly
              </p>
            </div>
          }
        </CardContent>
      </Card>

      {/* Floating Real-Time Monitor - can be positioned anywhere */}
      <div className="fixed bottom-4 right-4 z-50">
        <RealTimeErrorMonitor className="w-96" maxErrors={10} refreshInterval={15000} />
      </div>
    </>);

};

export default ErrorMonitoringWidget;