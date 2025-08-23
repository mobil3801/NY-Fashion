import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { environmentValidator } from '@/utils/env-validator';
import { ENV_CONFIG } from '@/config/environment';

const EnvironmentValidator: React.FC = () => {
  const [validation, setValidation] = React.useState(environmentValidator.validateAll());
  const [envInfo, setEnvInfo] = React.useState(ENV_CONFIG);

  React.useEffect(() => {
    const updateValidation = () => {
      setValidation(environmentValidator.validateAll());
    };

    // Update validation every 5 seconds in development
    const interval = ENV_CONFIG.IS_DEVELOPMENT ? setInterval(updateValidation, 5000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const getStatusIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getEnvironmentBadgeVariant = (env: string) => {
    switch (env) {
      case 'production': return 'destructive';
      case 'development': return 'default';
      case 'test': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Environment Validation</h2>
          <p className="text-muted-foreground">
            Current environment configuration and validation status
          </p>
        </div>
        <Badge variant={getEnvironmentBadgeVariant(validation.environment)}>
          {validation.environment.toUpperCase()}
        </Badge>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(validation.isValid)}
            Overall Status
          </CardTitle>
          <CardDescription>
            Environment validation {validation.isValid ? 'passed' : 'failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {validation.errors.length === 0 ? '✓' : validation.errors.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {validation.errors.length === 0 ? 'No Errors' : 'Errors'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {validation.warnings.length}
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Object.keys(validation.config).length}
              </div>
              <div className="text-sm text-muted-foreground">Config Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {validation.environment}
              </div>
              <div className="text-sm text-muted-foreground">Environment</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Configuration Errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>Backend API connection settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Base URL:</span>
              <span className="text-sm text-muted-foreground">{envInfo.API.BASE_URL}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Timeout:</span>
              <span className="text-sm text-muted-foreground">{envInfo.API.TIMEOUT}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Retry Count:</span>
              <span className="text-sm text-muted-foreground">{envInfo.API.RETRY_COUNT}</span>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Application feature configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(envInfo.FEATURES).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-sm font-medium">{key.replace('ENABLE_', '').replace('DISABLE_', '!')}:</span>
                <Badge variant={value ? 'default' : 'secondary'}>
                  {value ? 'ON' : 'OFF'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Application security configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(envInfo.SECURITY).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-sm font-medium">{key.replace('ENABLE_', '')}:</span>
                <span className="text-sm text-muted-foreground">
                  {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Performance Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Settings</CardTitle>
            <CardDescription>Application performance configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(envInfo.PERFORMANCE).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-sm font-medium">{key}:</span>
                <span className="text-sm text-muted-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>All configuration values currently in use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(validation.config).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="font-mono font-medium">{key}:</span>
                <span className="text-muted-foreground truncate ml-4">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Debug Information */}
      {ENV_CONFIG.IS_DEVELOPMENT && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Development Mode</AlertTitle>
          <AlertDescription>
            This environment validator is only available in development mode.
            Use the browser console commands `window.showEnv()` or `window.showHealthMetrics()`
            for runtime debugging.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default EnvironmentValidator;