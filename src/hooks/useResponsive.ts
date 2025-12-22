import { useState, useEffect, useMemo } from 'react';

/**
 * Breakpoint definitions for precise device detection
 */
const BREAKPOINTS = {
  xs: 320,   // Small phones (iPhone SE, etc.)
  sm: 375,   // Standard phones (iPhone 6/7/8, etc.)
  md: 414,   // Large phones (iPhone Plus, etc.)
  lg: 768,   // Tablets
  xl: 1024,  // Laptops
  '2xl': 1280, // Desktops
  '3xl': 1536, // Large screens
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

interface ResponsiveState {
  // Core dimensions
  width: number;
  height: number;
  
  // Device types
  isMobile: boolean;
  isSmallMobile: boolean;   // <= 320px
  isMediumMobile: boolean;  // 321-375px
  isLargeMobile: boolean;   // 376-414px
  isExtraLargeMobile: boolean; // 415-767px
  isTablet: boolean;        // 768-1023px
  isDesktop: boolean;       // >= 1024px
  isLargeDesktop: boolean;  // >= 1280px
  
  // Orientation
  orientation: 'portrait' | 'landscape';
  isPortrait: boolean;
  isLandscape: boolean;
  
  // Current breakpoint
  breakpoint: Breakpoint;
  
  // Touch support
  isTouchDevice: boolean;
  
  // Utility functions
  isAbove: (bp: Breakpoint) => boolean;
  isBelow: (bp: Breakpoint) => boolean;
  isBetween: (minBp: Breakpoint, maxBp: Breakpoint) => boolean;
}

/**
 * Advanced responsive hook with precise mobile breakpoints
 * Detects device type with granular mobile sizes (320px, 375px, 414px)
 */
export function useResponsive(): ResponsiveState {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Initial call
    handleResize();

    // Throttled resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const throttledResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', throttledResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', throttledResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const state = useMemo((): ResponsiveState => {
    const { width, height } = dimensions;
    
    // Determine current breakpoint
    const getBreakpoint = (): Breakpoint => {
      if (width < BREAKPOINTS.xs) return 'xs';
      if (width < BREAKPOINTS.sm) return 'xs';
      if (width < BREAKPOINTS.md) return 'sm';
      if (width < BREAKPOINTS.lg) return 'md';
      if (width < BREAKPOINTS.xl) return 'lg';
      if (width < BREAKPOINTS['2xl']) return 'xl';
      return '2xl';
    };

    const breakpoint = getBreakpoint();
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // Touch detection
    const isTouchDevice = typeof window !== 'undefined' && (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );

    // Utility functions
    const isAbove = (bp: Breakpoint): boolean => width >= BREAKPOINTS[bp];
    const isBelow = (bp: Breakpoint): boolean => width < BREAKPOINTS[bp];
    const isBetween = (minBp: Breakpoint, maxBp: Breakpoint): boolean => 
      width >= BREAKPOINTS[minBp] && width < BREAKPOINTS[maxBp];

    return {
      width,
      height,
      
      // Device types with specific mobile breakpoints
      isMobile: width < BREAKPOINTS.lg,
      isSmallMobile: width <= BREAKPOINTS.xs,
      isMediumMobile: width > BREAKPOINTS.xs && width <= BREAKPOINTS.sm,
      isLargeMobile: width > BREAKPOINTS.sm && width <= BREAKPOINTS.md,
      isExtraLargeMobile: width > BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isTablet: width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl,
      isDesktop: width >= BREAKPOINTS.xl,
      isLargeDesktop: width >= BREAKPOINTS['2xl'],
      
      // Orientation
      orientation,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      
      // Breakpoint
      breakpoint,
      
      // Touch
      isTouchDevice,
      
      // Utilities
      isAbove,
      isBelow,
      isBetween,
    };
  }, [dimensions]);

  return state;
}

/**
 * Hook to get only the current breakpoint (lighter weight)
 */
export function useBreakpoint(): Breakpoint {
  const { breakpoint } = useResponsive();
  return breakpoint;
}

/**
 * Hook for conditional rendering based on breakpoint
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export { BREAKPOINTS };
export type { Breakpoint, ResponsiveState };
