
export interface NetworkDiagnostics {
  isOnline: boolean;
  connectionType?: string;
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  dnsResolution: {
    success: boolean;
    latency: number;
  };
  apiTest: {
    success: boolean;
    latency: number;
    statusCode?: number;
  };
  timestamp: number;
}

export class NetworkDiagnostics {
  private static instance: NetworkDiagnostics;

  static getInstance(): NetworkDiagnostics {
    if (!this.instance) {
      this.instance = new NetworkDiagnostics();
    }
    return this.instance;
  }

  async runDiagnostics(): Promise<NetworkDiagnostics> {
    const startTime = performance.now();

    // Get basic browser connection info
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    const diagnostics: NetworkDiagnostics = {
      isOnline: navigator.onLine,
      connectionType: connection?.type,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      effectiveType: connection?.effectiveType,
      dnsResolution: { success: false, latency: 0 },
      apiTest: { success: false, latency: 0 },
      timestamp: Date.now()
    };

    // Test DNS resolution
    try {
      const dnsStart = performance.now();
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('DNS timeout')), 5000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('DNS failed'));
        };

        img.src = `https://www.google.com/favicon.ico?${Date.now()}`;
      });

      diagnostics.dnsResolution = {
        success: true,
        latency: performance.now() - dnsStart
      };
    } catch (error) {
      diagnostics.dnsResolution = {
        success: false,
        latency: performance.now() - startTime
      };
    }

    // Test API connectivity
    try {
      const apiStart = performance.now();
      const response = await fetch(`${window.location.origin}/favicon.ico`, {
        method: 'HEAD',
        cache: 'no-cache'
      });

      diagnostics.apiTest = {
        success: response.ok,
        latency: performance.now() - apiStart,
        statusCode: response.status
      };
    } catch (error) {
      diagnostics.apiTest = {
        success: false,
        latency: performance.now() - startTime
      };
    }

    return diagnostics;
  }

  async getConnectionQuality(): Promise<'excellent' | 'good' | 'fair' | 'poor' | 'offline'> {
    if (!navigator.onLine) {
      return 'offline';
    }

    const diagnostics = await this.runDiagnostics();

    if (!diagnostics.apiTest.success) {
      return 'offline';
    }

    const latency = diagnostics.apiTest.latency;

    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 1000) return 'fair';
    return 'poor';
  }

  getConnectionAdvice(diagnostics: NetworkDiagnostics): string {
    if (!diagnostics.isOnline || !diagnostics.apiTest.success) {
      return "Check your internet connection and try again.";
    }

    if (diagnostics.apiTest.latency > 2000) {
      return "Your connection is slow. Some operations may take longer.";
    }

    if (!diagnostics.dnsResolution.success) {
      return "DNS resolution issues detected. Try switching networks.";
    }

    if (diagnostics.effectiveType === '2g') {
      return "Slow connection detected. Consider switching to a faster network.";
    }

    return "Connection appears to be working normally.";
  }
}

export const networkDiagnostics = NetworkDiagnostics.getInstance();