
interface PerformanceAnalytics {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalMetrics: number;
  alertsTriggered: number;
  performanceScore: number;
  trends: Record<string, {
    current: number;
    previous: number;
    change: number;
    trend: 'improving' | 'degrading' | 'stable';
  }>;
  bottlenecks: Array<{
    metric: string;
    severity: string;
    impact: number;
    recommendations: string[];
  }>;
  insights: string[];
}

class PerformanceAnalyticsEngine {
  public async generateAnalytics(timeRange: { start: Date; end: Date }): Promise<PerformanceAnalytics> {
    const [metrics, alerts] = await Promise.all([
      this.fetchMetricsData(timeRange),
      this.fetchAlertsData(timeRange)
    ]);

    const analytics: PerformanceAnalytics = {
      timeRange,
      totalMetrics: metrics.length,
      alertsTriggered: alerts.length,
      performanceScore: this.calculatePerformanceScore(metrics, alerts),
      trends: this.analyzeTrends(metrics),
      bottlenecks: this.identifyBottlenecks(metrics, alerts),
      insights: this.generateInsights(metrics, alerts)
    };

    return analytics;
  }

  private async fetchMetricsData(timeRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37304, {
        PageNo: 1,
        PageSize: 10000,
        Filters: [
          {
            name: 'created_at',
            op: 'GreaterThanOrEqual',
            value: timeRange.start.toISOString()
          },
          {
            name: 'created_at',
            op: 'LessThanOrEqual',
            value: timeRange.end.toISOString()
          }
        ],
        OrderByField: 'created_at',
        IsAsc: true
      });

      if (error) throw new Error(error);
      return data?.List || [];
    } catch (error) {
      console.error('Failed to fetch metrics data:', error);
      return [];
    }
  }

  private async fetchAlertsData(timeRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37305, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
          {
            name: 'created_at',
            op: 'GreaterThanOrEqual',
            value: timeRange.start.toISOString()
          },
          {
            name: 'created_at',
            op: 'LessThanOrEqual',
            value: timeRange.end.toISOString()
          }
        ],
        OrderByField: 'created_at',
        IsAsc: true
      });

      if (error) throw new Error(error);
      return data?.List || [];
    } catch (error) {
      console.error('Failed to fetch alerts data:', error);
      return [];
    }
  }

  private calculatePerformanceScore(metrics: any[], alerts: any[]): number {
    if (metrics.length === 0) return 100;

    let score = 100;
    
    // Penalize based on alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;

    score -= criticalAlerts * 20;
    score -= highAlerts * 10;
    score -= mediumAlerts * 5;

    // Factor in performance metrics quality
    const loadTimeMetrics = metrics.filter(m => m.metric_type === 'load_time');
    if (loadTimeMetrics.length > 0) {
      const avgLoadTime = loadTimeMetrics.reduce((sum, m) => sum + m.value, 0) / loadTimeMetrics.length;
      if (avgLoadTime > 5000) score -= 15;
      else if (avgLoadTime > 3000) score -= 10;
      else if (avgLoadTime > 1000) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private analyzeTrends(metrics: any[]): Record<string, any> {
    const trends: Record<string, any> = {};
    const metricGroups = this.groupMetricsByType(metrics);
    
    Object.keys(metricGroups).forEach(metricKey => {
      const metricData = metricGroups[metricKey];
      const midPoint = Math.floor(metricData.length / 2);
      
      const firstHalf = metricData.slice(0, midPoint);
      const secondHalf = metricData.slice(midPoint);
      
      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const previousAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
        const currentAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
        const change = ((currentAvg - previousAvg) / previousAvg) * 100;
        
        trends[metricKey] = {
          current: currentAvg,
          previous: previousAvg,
          change: change,
          trend: Math.abs(change) < 5 ? 'stable' : (change > 0 ? 'degrading' : 'improving')
        };
      }
    });

    return trends;
  }

  private groupMetricsByType(metrics: any[]): Record<string, any[]> {
    return metrics.reduce((groups, metric) => {
      const key = `${metric.metric_type}_${metric.metric_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(metric);
      return groups;
    }, {});
  }

  private identifyBottlenecks(metrics: any[], alerts: any[]): Array<any> {
    const bottlenecks: Array<any> = [];
    const metricGroups = this.groupMetricsByType(metrics);
    
    // Identify metrics with highest average values
    Object.keys(metricGroups).forEach(metricKey => {
      const metricData = metricGroups[metricKey];
      const avgValue = metricData.reduce((sum, m) => sum + m.value, 0) / metricData.length;
      const relatedAlerts = alerts.filter(a => 
        `${a.metric_type}_${a.metric_name}` === metricKey
      );
      
      if (relatedAlerts.length > 0) {
        const severityScore = relatedAlerts.reduce((score, alert) => {
          switch (alert.severity) {
            case 'critical': return score + 4;
            case 'high': return score + 3;
            case 'medium': return score + 2;
            default: return score + 1;
          }
        }, 0);

        bottlenecks.push({
          metric: metricKey,
          severity: this.determineSeverityFromScore(severityScore),
          impact: severityScore,
          recommendations: this.getBottleneckRecommendations(metricKey, avgValue)
        });
      }
    });

    return bottlenecks.sort((a, b) => b.impact - a.impact).slice(0, 10);
  }

  private determineSeverityFromScore(score: number): string {
    if (score >= 10) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private getBottleneckRecommendations(metricKey: string, avgValue: number): string[] {
    const recommendations: string[] = [];
    
    if (metricKey.includes('load_time')) {
      recommendations.push('Implement code splitting and lazy loading');
      recommendations.push('Optimize bundle size and remove unused code');
      recommendations.push('Use CDN for static assets');
    }
    
    if (metricKey.includes('api_response')) {
      recommendations.push('Implement API caching strategies');
      recommendations.push('Optimize database queries and indexes');
      recommendations.push('Consider API pagination and data filtering');
    }
    
    if (metricKey.includes('memory')) {
      recommendations.push('Check for memory leaks and dispose unused objects');
      recommendations.push('Optimize image and data caching');
      recommendations.push('Use virtual scrolling for large datasets');
    }

    return recommendations;
  }

  private generateInsights(metrics: any[], alerts: any[]): string[] {
    const insights: string[] = [];
    
    if (metrics.length === 0) {
      insights.push('No performance data available for analysis');
      return insights;
    }

    // Page load performance insights
    const loadTimeMetrics = metrics.filter(m => m.metric_type === 'load_time');
    if (loadTimeMetrics.length > 0) {
      const avgLoadTime = loadTimeMetrics.reduce((sum, m) => sum + m.value, 0) / loadTimeMetrics.length;
      if (avgLoadTime < 1000) {
        insights.push('Excellent page load performance - average load time under 1 second');
      } else if (avgLoadTime < 3000) {
        insights.push('Good page load performance - consider optimizing for faster loading');
      } else {
        insights.push('Page load performance needs improvement - implement optimization strategies');
      }
    }

    // API performance insights
    const apiMetrics = metrics.filter(m => m.metric_type === 'api_response');
    if (apiMetrics.length > 0) {
      const avgApiTime = apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length;
      if (avgApiTime > 2000) {
        insights.push('API response times are slow - consider caching and optimization');
      }
    }

    // Memory usage insights
    const memoryMetrics = metrics.filter(m => m.metric_type === 'memory');
    if (memoryMetrics.length > 0) {
      const maxMemory = Math.max(...memoryMetrics.map(m => m.value));
      if (maxMemory > 150) {
        insights.push('High memory usage detected - check for memory leaks');
      }
    }

    // Alert frequency insights
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      insights.push(`${criticalAlerts.length} critical performance issues detected - immediate attention required`);
    }

    // Performance trend insights
    const recentMetrics = metrics.slice(-100);
    const olderMetrics = metrics.slice(-200, -100);
    
    if (recentMetrics.length > 0 && olderMetrics.length > 0) {
      const recentAvg = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
      const olderAvg = olderMetrics.reduce((sum, m) => sum + m.value, 0) / olderMetrics.length;
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      if (change > 10) {
        insights.push('Performance is degrading over time - investigate recent changes');
      } else if (change < -10) {
        insights.push('Performance is improving - recent optimizations are effective');
      }
    }

    return insights;
  }

  public async generatePerformanceReport(timeRange: { start: Date; end: Date }): Promise<any> {
    const analytics = await this.generateAnalytics(timeRange);
    
    return {
      generatedAt: new Date().toISOString(),
      period: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
        durationDays: Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24))
      },
      summary: {
        performanceScore: analytics.performanceScore,
        totalMetrics: analytics.totalMetrics,
        alertsTriggered: analytics.alertsTriggered,
        criticalIssues: analytics.bottlenecks.filter(b => b.severity === 'critical').length
      },
      analytics,
      recommendations: this.generatePriorityRecommendations(analytics)
    };
  }

  private generatePriorityRecommendations(analytics: PerformanceAnalytics): Array<any> {
    const recommendations: Array<any> = [];
    
    // High priority recommendations based on bottlenecks
    analytics.bottlenecks.forEach(bottleneck => {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        recommendations.push({
          priority: bottleneck.severity === 'critical' ? 1 : 2,
          category: bottleneck.metric.split('_')[0],
          title: `Optimize ${bottleneck.metric.replace('_', ' ')} performance`,
          description: `Critical performance bottleneck identified`,
          recommendations: bottleneck.recommendations
        });
      }
    });

    // General recommendations based on performance score
    if (analytics.performanceScore < 70) {
      recommendations.push({
        priority: 1,
        category: 'overall',
        title: 'Overall Performance Optimization',
        description: 'Multiple performance issues detected',
        recommendations: [
          'Conduct comprehensive performance audit',
          'Implement performance monitoring alerts',
          'Review and optimize critical user journeys'
        ]
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }
}

export default PerformanceAnalyticsEngine;
