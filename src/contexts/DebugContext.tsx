// Re-export from consolidated context to maintain backward compatibility
// This file now just forwards to the main context implementation

export { DebugProvider, useDebug } from '@/debug';
export type {
  DebugContextType,
  NetworkStatus,
  ApiCall,
  DebugSettings } from
'@/debug';

// Keep the old import path working
export { DebugProvider as default } from '@/debug';