export interface NetworkConfig {
  VITE_API_BASE_URL: string;
  VITE_API_HEALTH_URL: string;
  VITE_HEARTBEAT_INTERVAL_MS: number;
  VITE_HEARTBEAT_TIMEOUT_MS: number;
}

const getEnvVar = (name: string, defaultValue: string | number): string | number => {
  const value = import.meta.env[name];

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // For numeric values, attempt to parse as number
  if (typeof defaultValue === 'number') {
    const numValue = Number(value);
    return isNaN(numValue) ? defaultValue : numValue;
  }

  return value;
};

export const networkConfig: NetworkConfig = {
  VITE_API_BASE_URL: getEnvVar('VITE_API_BASE_URL', window.location.origin) as string,
  VITE_API_HEALTH_URL: getEnvVar('VITE_API_HEALTH_URL', '/v1/health') as string,
  VITE_HEARTBEAT_INTERVAL_MS: getEnvVar('VITE_HEARTBEAT_INTERVAL_MS', 20000) as number,
  VITE_HEARTBEAT_TIMEOUT_MS: getEnvVar('VITE_HEARTBEAT_TIMEOUT_MS', 3000) as number
};

// Validate required configuration
if (!networkConfig.VITE_API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is required but not provided');
}

// Validate numeric values are within reasonable ranges
if (networkConfig.VITE_HEARTBEAT_INTERVAL_MS < 1000 || networkConfig.VITE_HEARTBEAT_INTERVAL_MS > 300000) {
  console.warn(`VITE_HEARTBEAT_INTERVAL_MS (${networkConfig.VITE_HEARTBEAT_INTERVAL_MS}ms) is outside recommended range (1000-300000ms)`);
}

if (networkConfig.VITE_HEARTBEAT_TIMEOUT_MS < 100 || networkConfig.VITE_HEARTBEAT_TIMEOUT_MS > 30000) {
  console.warn(`VITE_HEARTBEAT_TIMEOUT_MS (${networkConfig.VITE_HEARTBEAT_TIMEOUT_MS}ms) is outside recommended range (100-30000ms)`);
}

export default networkConfig;