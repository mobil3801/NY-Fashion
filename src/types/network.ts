
export type ConnectionErrorType = 
  | 'network_unavailable'
  | 'server_error'
  | 'timeout'
  | 'dns_error'
  | 'unknown';

export type ConnectionState = 
  | 'online'
  | 'offline'
  | 'reconnecting'
  | 'poor_connection'
  | 'recovering';

export interface EnhancedNetStatus {
  online: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  errorType?: ConnectionErrorType;
  state: ConnectionState;
  retryAttempts: number;
  nextRetryAt?: Date;
}

export interface ConnectionRecoveryInfo {
  wasOfflineFor: number; // milliseconds
  recoveryTime: Date;
  failureCount: number;
}

export interface NetworkErrorDetails {
  type: ConnectionErrorType;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  suggestedAction?: string;
}
