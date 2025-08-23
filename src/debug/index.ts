// Barrel export for debug functionality
// This ensures all debug imports come from a single source

export { DebugProvider, useDebug } from './context';
export type { 
  DebugContextType, 
  DebugLog, 
  DebugInfo, 
  NetworkStatus, 
  ApiCall, 
  DebugSettings 
} from './context';

// Re-export for backward compatibility
export { DebugProvider as default } from './context';
