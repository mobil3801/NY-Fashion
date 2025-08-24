import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import EnhancedDeploymentManager from '@/components/deployment/EnhancedDeploymentManager';

const DeploymentPage: React.FC = () => {
  const { user } = useAuth();

  if (!user || !hasPermission(user, 'view_deployments')) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
        <p className="text-gray-600">You don't have permission to view deployment information.</p>
      </Card>);

  }

  return (
    <div className="space-y-6">
      <EnhancedDeploymentManager />
    </div>);

};

export default DeploymentPage;