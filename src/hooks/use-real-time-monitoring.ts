
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface MonitoringMetrics {
  error_rate: number;
  response_time: number;
  throughput: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
}

interface AlertData {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  last_check: string;
  components: {
    database: 'healthy' | 'degraded' | 'critical';
    api: 'healthy' | 'degraded' | 'critical';
    storage: 'healthy' | 'degraded' | 'critical';
  };
}

export const useRealTimeMonitoring = () => {
  const [alertThresholds, setAlertThresholds] = useState({
    error_rate: 5, // 5%
    response_time: 2000, // 2 seconds
    cpu_usage: 80, // 80%
    memory_usage: 85 // 85%
  });

  const [circuitBreakerStates, setCircuitBreakerStates] = useState<Record<string, string>>({});

  // Fetch error logs for real-time monitoring
  const { data: errorLogs = [] } = useQuery({
    queryKey: ['error-logs-monitoring'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37297', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'id',
        IsAsc: false,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 5000
  });

  // Fetch performance metrics
  const { data: performanceMetrics = [] } = useQuery({
    queryKey: ['performance-metrics-monitoring'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37305', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'id',
        IsAsc: false,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 3000
  });

  // Fetch performance alerts
  const { data: performanceAlerts = [] } = useQuery({
    queryKey: ['performance-alerts-monitoring'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37306', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'id',
        IsAsc: false,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 2000
  });

  // Fetch network errors
  const { data: networkErrors = [] } = useQuery({
    queryKey: ['network-errors-monitoring'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37299', {
        PageNo: 1,
        PageSize: 30,
        OrderByField: 'id',
        IsAsc: false,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 4000
  });

  // Calculate real-time metrics
  const currentMetrics: MonitoringMetrics = {
    error_rate: errorLogs.length > 0 ? 
      (errorLogs.filter((log: any) => 
        new Date(log.created_at || Date.now()).getTime() > Date.now() - 3600000
      ).length / errorLogs.length) * 100 : 0,
    response_time: performanceMetrics.length > 0 ?
      performanceMetrics.reduce((sum: number, metric: any) => 
        sum + (parseFloat(metric.response_time) || 0), 0) / performanceMetrics.length : 0,
    throughput: performanceMetrics.length > 0 ?
      performanceMetrics.reduce((sum: number, metric: any) => 
        sum + (parseFloat(metric.requests_per_second) || 0), 0) / performanceMetrics.length : 0,
    cpu_usage: performanceMetrics.length > 0 ?
      performanceMetrics.reduce((sum: number, metric: any) => 
        sum + (parseFloat(metric.cpu_usage) || 0), 0) / performanceMetrics.length : 0,
    memory_usage: performanceMetrics.length > 0 ?
      performanceMetrics.reduce((sum: number, metric: any) => 
        sum + (parseFloat(metric.memory_usage) || 0), 0) / performanceMetrics.length : 0,
    disk_usage: 0,
    active_connections: performanceMetrics.length
  };

  // Determine system health
  const systemHealth: SystemHealth = {
    status: currentMetrics.error_rate > alertThresholds.error_rate || 
             currentMetrics.cpu_usage > alertThresholds.cpu_usage ? 'critical' :
             currentMetrics.response_time > alertThresholds.response_time ? 'degraded' : 'healthy',
    uptime: 99.9, // Mock uptime calculation
    last_check: new Date().toISOString(),
    components: {
      database: networkErrors.filter((err: any) => err.component === 'database').length > 0 ? 'critical' : 'healthy',
      api: currentMetrics.response_time > alertThresholds.response_time ? 'degraded' : 'healthy',
      storage: 'healthy'
    }
  };

  // Circuit breaker logic
  const updateCircuitBreaker = useCallback((component: string, errorCount: number) => {
    const threshold = 5; // 5 errors trigger circuit breaker
    const currentState = circuitBreakerStates[component] || 'closed';
    
    if (errorCount >= threshold && currentState === 'closed') {
      setCircuitBreakerStates(prev => ({ ...prev, [component]: 'open' }));
      toast.error(`Circuit breaker opened for ${component}`);
    } else if (errorCount < 2 && currentState === 'open') {
      setCircuitBreakerStates(prev => ({ ...prev, [component]: 'half-open' }));
      toast.info(`Circuit breaker half-open for ${component}`);
    } else if (errorCount === 0 && currentState === 'half-open') {
      setCircuitBreakerStates(prev => ({ ...prev, [component]: 'closed' }));
      toast.success(`Circuit breaker closed for ${component}`);
    }
  }, [circuitBreakerStates]);

  // Alert processing
  const processedAlerts: AlertData[] = [
    ...errorLogs.slice(0, 10).map((log: any) => ({
      id: log.id,
      severity: log.severity || 'warning',
      message: log.error_message || 'Unknown error',
      timestamp: log.created_at || new Date().toISOString(),
      resolved: false
    })),
    ...performanceAlerts.slice(0, 5).map((alert: any) => ({
      id: alert.id,
      severity: alert.severity || 'warning',
      message: alert.message || 'Performance alert',
      timestamp: alert.created_at || new Date().toISOString(),
      resolved: alert.resolved || false
    }))
  ];

  // Auto-trigger alerts based on thresholds
  useEffect(() => {
    if (currentMetrics.error_rate > alertThresholds.error_rate) {
      toast.error(`High error rate detected: ${currentMetrics.error_rate.toFixed(2)}%`);
    }
    if (currentMetrics.response_time > alertThresholds.response_time) {
      toast.warning(`High response time: ${currentMetrics.response_time.toFixed(0)}ms`);
    }
    if (currentMetrics.cpu_usage > alertThresholds.cpu_usage) {
      toast.error(`High CPU usage: ${currentMetrics.cpu_usage.toFixed(1)}%`);
    }
  }, [currentMetrics, alertThresholds]);

  return {
    currentMetrics,
    systemHealth,
    errorLogs,
    performanceMetrics,
    performanceAlerts,
    networkErrors,
    processedAlerts,
    alertThresholds,
    setAlertThresholds,
    circuitBreakerStates,
    updateCircuitBreaker
  };
};
