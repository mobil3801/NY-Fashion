import { useState, useEffect } from 'react';

// Breakpoint constants
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAbove = (breakpoint: Breakpoint) => windowSize.width >= BREAKPOINTS[breakpoint];
  const isBelow = (breakpoint: Breakpoint) => windowSize.width < BREAKPOINTS[breakpoint];

  return {
    width: windowSize.width,
    height: windowSize.height,
    isAbove,
    isBelow,
    isMobile: windowSize.width < BREAKPOINTS.md,
    isTablet: windowSize.width >= BREAKPOINTS.md && windowSize.width < BREAKPOINTS.lg,
    isDesktop: windowSize.width >= BREAKPOINTS.lg,
    isXl: windowSize.width >= BREAKPOINTS.xl,
    is2Xl: windowSize.width >= BREAKPOINTS['2xl']
  };
}

// Utility functions for conditional responsive behavior
export function isMobileDevice() {
  return typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.md;
}

export function isTabletDevice() {
  return typeof window !== 'undefined' &&
  window.innerWidth >= BREAKPOINTS.md &&
  window.innerWidth < BREAKPOINTS.lg;
}

export function isDesktopDevice() {
  return typeof window !== 'undefined' && window.innerWidth >= BREAKPOINTS.lg;
}

export default useResponsive;