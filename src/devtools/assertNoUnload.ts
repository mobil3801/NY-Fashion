/**
 * Development-time protection against unload handlers
 * Prevents introduction of problematic unload/beforeunload listeners
 */

export interface UnloadDetectionConfig {
  throwOnUnload?: boolean;
  throwOnBeforeUnload?: boolean;
  logWarnings?: boolean;
  allowedOrigins?: string[]; // Allow certain third-party scripts
}

const DEFAULT_CONFIG: UnloadDetectionConfig = {
  throwOnUnload: true,
  throwOnBeforeUnload: true,
  logWarnings: true,
  allowedOrigins: []
};

let isProtectionEnabled = false;
let originalAddEventListener: typeof EventTarget.prototype.addEventListener;
let originalRemoveEventListener: typeof EventTarget.prototype.removeEventListener;

export function enableUnloadProtection(config: UnloadDetectionConfig = {}) {
  if (isProtectionEnabled) return;

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Store original methods
  originalAddEventListener = EventTarget.prototype.addEventListener;
  originalRemoveEventListener = EventTarget.prototype.removeEventListener;

  // Override addEventListener
  EventTarget.prototype.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions)
  {
    // Check if this is a problematic event type
    if (type === 'unload' || type === 'beforeunload') {
      const stack = new Error().stack || '';
      const isThirdParty = finalConfig.allowedOrigins?.some((origin) =>
      stack.includes(origin)
      );

      if (!isThirdParty) {
        const message = `❌ Unload handler detected: "${type}". Use pagehide + visibilitychange instead for BFCache compatibility.`;

        if (finalConfig.logWarnings) {
          console.warn(message, '\nStack trace:', stack);
        }

        if (
        type === 'unload' && finalConfig.throwOnUnload ||
        type === 'beforeunload' && finalConfig.throwOnBeforeUnload)
        {
          throw new Error(message + '\n\nUse src/hooks/usePageLifecycle.ts instead.');
        }
      }
    }

    // Call original method
    return originalAddEventListener.call(this, type, listener, options);
  };

  isProtectionEnabled = true;

  if (finalConfig.logWarnings) {
    console.info('🛡️ Unload protection enabled in development mode');
  }
}

export function disableUnloadProtection() {
  if (!isProtectionEnabled) return;

  // Restore original methods
  EventTarget.prototype.addEventListener = originalAddEventListener;
  EventTarget.prototype.removeEventListener = originalRemoveEventListener;

  isProtectionEnabled = false;
  console.info('🛡️ Unload protection disabled');
}

export function checkForExistingUnloadHandlers(): Array<{
  target: string;
  type: string;
  count: number;
}> {
  const results: Array<{target: string;type: string;count: number;}> = [];

  // Check window listeners (this is a best-effort check)
  const checkTarget = (target: EventTarget, name: string) => {
    // We can't directly enumerate event listeners, but we can check getEventListeners in dev tools
    if (typeof (window as any).getEventListeners === 'function') {
      try {
        const listeners = (window as any).getEventListeners(target);

        ['unload', 'beforeunload'].forEach((type) => {
          if (listeners[type] && listeners[type].length > 0) {
            results.push({
              target: name,
              type,
              count: listeners[type].length
            });
          }
        });
      } catch (error) {









        // getEventListeners might not be available
      }}};checkTarget(window, 'window');checkTarget(document, 'document');checkTarget(document.body, 'document.body');return results;}

export function reportUnloadHandlers() {
  const handlers = checkForExistingUnloadHandlers();

  if (handlers.length > 0) {
    console.warn('⚠️ Found existing unload handlers:', handlers);
    console.info('💡 Consider replacing with pagehide + visibilitychange for better compatibility');
    return handlers;
  } else {
    console.info('✅ No problematic unload handlers detected');
    return [];
  }
}

// Auto-enable in development
if (import.meta.env?.DEV) {
  enableUnloadProtection({
    throwOnUnload: true,
    throwOnBeforeUnload: false, // Allow beforeunload for form protection
    logWarnings: true,
    allowedOrigins: ['easysite.ai', 'googleapis.com'] // Allow certain third-party scripts
  });
}

export default {
  enableUnloadProtection,
  disableUnloadProtection,
  checkForExistingUnloadHandlers,
  reportUnloadHandlers
};