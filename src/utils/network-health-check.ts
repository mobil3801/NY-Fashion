
import { apiClient } from '@/lib/network/client';

export interface NetworkHealthCheck {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
  diagnostics: {
    browserSupport: boolean;
    networkAccess: boolean;
    apiClient: boolean;
    websockets?: boolean;
  };
}

export async function performNetworkHealthCheck(): Promise<NetworkHealthCheck> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const diagnostics = {
    browserSupport: true,
    networkAccess: true,
    apiClient: true,
    websockets: undefined as boolean | undefined
  };

  try {
    // Check browser support
    if (typeof window === 'undefined') {
      issues.push('Window object not available');
      diagnostics.browserSupport = false;
    }

    if (typeof navigator === 'undefined') {
      issues.push('Navigator object not available');
      diagnostics.browserSupport = false;
    }

    if (typeof fetch === 'undefined') {
      issues.push('Fetch API not available');
      diagnostics.browserSupport = false;
      recommendations.push('Update your browser to a modern version');
    }

    // Check network access
    if (navigator?.onLine === false) {
      issues.push('Browser reports offline status');
      diagnostics.networkAccess = false;
      recommendations.push('Check your internet connection');
    }

    // Test basic connectivity with a lightweight request
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status >= 500) {
        issues.push('Server appears to be having issues');
        recommendations.push('Try again in a few minutes');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          issues.push('Network request timed out');
          recommendations.push('Check your internet connection speed');
        } else if (error.message.includes('Failed to fetch')) {
          issues.push('Unable to connect to server');
          diagnostics.networkAccess = false;
          recommendations.push('Check your firewall and network settings');
        }
      }
    }

    // Check API client health
    try {
      const clientDiagnostics = apiClient.getNetworkDiagnostics();
      if (!clientDiagnostics.isOnline) {
        issues.push('API client reports offline status');
        diagnostics.apiClient = false;
      }
    } catch (error) {
      issues.push('API client initialization failed');
      diagnostics.apiClient = false;
      recommendations.push('Refresh the page to reinitialize network services');
    }

    // Optional: Check WebSocket support (for real-time features)
    if (typeof WebSocket !== 'undefined') {
      diagnostics.websockets = true;
    } else {
      diagnostics.websockets = false;
      // WebSocket support is optional, so don't add to critical issues
    }

  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    recommendations.push('Refresh the page and try again');
  }

  const isHealthy = issues.length === 0;

  return {
    isHealthy,
    issues,
    recommendations,
    diagnostics
  };
}

export function getNetworkHealthSummary(healthCheck: NetworkHealthCheck): string {
  if (healthCheck.isHealthy) {
    return 'All network services are functioning normally.';
  }

  const criticalIssues = healthCheck.issues.filter((issue) =>
  issue.includes('not available') ||
  issue.includes('failed') ||
  issue.includes('offline')
  );

  if (criticalIssues.length > 0) {
    return `Critical network issues detected: ${criticalIssues[0]}`;
  }

  return `Network issues detected: ${healthCheck.issues[0]}`;
}

export function formatNetworkDiagnostics(healthCheck: NetworkHealthCheck): string {
  const { diagnostics } = healthCheck;

  return [
  `Browser Support: ${diagnostics.browserSupport ? '✅' : '❌'}`,
  `Network Access: ${diagnostics.networkAccess ? '✅' : '❌'}`,
  `API Client: ${diagnostics.apiClient ? '✅' : '❌'}`,
  diagnostics.websockets !== undefined ? `WebSockets: ${diagnostics.websockets ? '✅' : '❌'}` : null].
  filter(Boolean).join('\n');
}

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as any).networkHealthCheck = performNetworkHealthCheck;
}