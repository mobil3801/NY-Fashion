
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import ComprehensivePerformanceMonitor from '@/utils/comprehensive-performance-monitor';
import PerformanceAnalyticsEngine from '@/utils/performance-analytics-engine';

interface PerformanceMonitoringContextType {
  performanceMonitor: ComprehensivePerformanceMonitor;
  analyticsEngine: PerformanceAnalyticsEngine;
  isEnabled: boolean;
  toggleMonitoring: () => void;
  getPerformanceSnapshot: () => any;
  exportPerformanceData: (timeRange: { start: Date; end: Date }) => Promise<any>;
}

const PerformanceMonitoringContext = createContext<PerformanceMonitoringContextType | null>(null);

interface PerformanceMonitoringProviderProps {
  children: ReactNode;
  enableByDefault?: boolean;
}

export const PerformanceMonitoringProvider: React.FC<PerformanceMonitoringProviderProps> = ({ 
  children, 
  enableByDefault = true 
}) => {
  const [performanceMonitor] = useState(() => new ComprehensivePerformanceMonitor());
  const [analyticsEngine] = useState(() => new PerformanceAnalyticsEngine());
  const [isEnabled, setIsEnabled] = useState(enableByDefault);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      performanceMonitor.destroy();
    };
  }, [performanceMonitor]);

  const toggleMonitoring = () => {
    setIsEnabled(!isEnabled);
    if (!isEnabled) {
      // Re-initialize monitoring if it was disabled
      window.location.reload();
    }
  };

  const getPerformanceSnapshot = () => {
    return {
      metrics: performanceMonitor.getMetricsSummary(),
      apiMetrics: performanceMonitor.getAPIMetricsSummary(),
      timestamp: new Date().toISOString()
    };
  };

  const exportPerformanceData = async (timeRange: { start: Date; end: Date }) => {
    try {
      const report = await analyticsEngine.generatePerformanceReport(timeRange);
      return report;
    } catch (error) {
      console.error('Failed to export performance data:', error);
      throw error;
    }
  };

  return (
    <PerformanceMonitoringContext.Provider
      value={{
        performanceMonitor,
        analyticsEngine,
        isEnabled,
        toggleMonitoring,
        getPerformanceSnapshot,
        exportPerformanceData
      }}
    >
      {children}
    </PerformanceMonitoringContext.Provider>
  );
};

export const usePerformanceMonitoring = (): PerformanceMonitoringContextType => {
  const context = useContext(PerformanceMonitoringContext);
  if (!context) {
    throw new Error('usePerformanceMonitoring must be used within a PerformanceMonitoringProvider');
  }
  return context;
};

export default PerformanceMonitoringProvider;
