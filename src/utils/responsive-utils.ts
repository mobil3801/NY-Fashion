/**
 * Responsive Utilities
 * Utilities for handling responsive layout behavior
 */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Get current screen size category
 */
export const getCurrentBreakpoint = (): Breakpoint => {
  const width = window.innerWidth;

  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';

  return 'sm'; // Default to smallest
};

/**
 * Check if current screen size is mobile
 */
export const isMobileScreen = (): boolean => {
  return window.innerWidth < BREAKPOINTS.lg;
};

/**
 * Check if current screen size is tablet
 */
export const isTabletScreen = (): boolean => {
  const width = window.innerWidth;
  return width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
};

/**
 * Check if current screen size is desktop
 */
export const isDesktopScreen = (): boolean => {
  return window.innerWidth >= BREAKPOINTS.lg;
};

/**
 * Get responsive class names based on current screen size
 */
export const getResponsiveClasses = (
mobile: string = '',
tablet: string = '',
desktop: string = '')
: string => {
  const breakpoint = getCurrentBreakpoint();

  if (breakpoint === 'sm' || breakpoint === 'md') {
    return mobile;
  } else if (breakpoint === 'lg') {
    return tablet || desktop;
  } else {
    return desktop;
  }
};

/**
 * Debounced resize handler
 */
export const createDebouncedResizeHandler = (
callback: () => void,
delay: number = 150)
: (() => void) => {
  let timeoutId: NodeJS.Timeout;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  const debouncedHandler = () => {
    cleanup();
    timeoutId = setTimeout(callback, delay);
  };

  // Return handler with cleanup
  const handler = () => debouncedHandler();
  (handler as any).cleanup = cleanup;

  return handler;
};

/**
 * Hook for responsive behavior with proper cleanup
 */
export const useResponsiveLayout = (
onMobile?: () => void,
onDesktop?: () => void) =>
{
  const handleResize = createDebouncedResizeHandler(() => {
    if (isMobileScreen() && onMobile) {
      onMobile();
    } else if (isDesktopScreen() && onDesktop) {
      onDesktop();
    }
  });

  return {
    handleResize,
    cleanup: (handleResize as any).cleanup,
    isMobile: isMobileScreen(),
    isDesktop: isDesktopScreen(),
    breakpoint: getCurrentBreakpoint()
  };
};

/**
 * CSS custom properties for responsive values
 */
export const setResponsiveCSSProperties = (element: HTMLElement) => {
  const updateProperties = () => {
    const width = window.innerWidth;
    element.style.setProperty('--screen-width', `${width}px`);
    element.style.setProperty('--is-mobile', isMobileScreen() ? '1' : '0');
    element.style.setProperty('--is-desktop', isDesktopScreen() ? '1' : '0');
    element.style.setProperty('--current-breakpoint', getCurrentBreakpoint());
  };

  updateProperties();

  const handler = createDebouncedResizeHandler(updateProperties);
  window.addEventListener('resize', handler);

  return () => {
    window.removeEventListener('resize', handler);
    (handler as any).cleanup();
  };
};