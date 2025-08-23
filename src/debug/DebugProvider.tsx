// Re-export from consolidated context to maintain backward compatibility
// This file now just forwards to the main context implementation

export { DebugProvider, useDebug } from './context';
export type { DebugContextType, DebugLog, DebugInfo } from './context';
export { DebugProvider as default } from './context';