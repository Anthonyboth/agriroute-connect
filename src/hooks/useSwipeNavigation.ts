import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SwipeNavigationOptions {
  /** Minimum horizontal swipe distance in pixels to trigger navigation */
  threshold?: number;
  /** Maximum vertical movement allowed during swipe */
  maxVerticalMovement?: number;
  /** Enable/disable the hook */
  enabled?: boolean;
  /** Custom callback when swipe back is triggered */
  onSwipeBack?: () => void;
  /** Routes where swipe navigation should be disabled */
  disabledRoutes?: string[];
}

/**
 * Hook that enables swipe-to-go-back navigation on mobile devices.
 * Detects horizontal swipes from the left edge of the screen.
 */
export function useSwipeNavigation(options: SwipeNavigationOptions = {}) {
  const {
    threshold = 80,
    maxVerticalMovement = 100,
    enabled = true,
    onSwipeBack,
    disabledRoutes = ['/auth', '/complete-profile', '/']
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const swipeIndicator = useRef<HTMLDivElement | null>(null);

  // Check if current route should have swipe disabled
  const isSwipeDisabled = useCallback(() => {
    return disabledRoutes.some(route => 
      location.pathname === route || 
      location.pathname.startsWith(route + '/')
    );
  }, [location.pathname, disabledRoutes]);

  const createSwipeIndicator = useCallback(() => {
    if (swipeIndicator.current) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'swipe-back-indicator';
    indicator.style.cssText = `
      position: fixed;
      left: 0;
      top: 50%;
      transform: translateY(-50%) translateX(-100%);
      width: 40px;
      height: 80px;
      background: linear-gradient(90deg, hsl(var(--primary)) 0%, transparent 100%);
      border-radius: 0 40px 40px 0;
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const arrow = document.createElement('span');
    arrow.innerHTML = '←';
    arrow.style.cssText = `
      color: hsl(var(--primary-foreground));
      font-size: 20px;
      font-weight: bold;
      margin-left: 8px;
    `;
    indicator.appendChild(arrow);
    
    document.body.appendChild(indicator);
    swipeIndicator.current = indicator;
  }, []);

  const removeSwipeIndicator = useCallback(() => {
    if (swipeIndicator.current) {
      swipeIndicator.current.remove();
      swipeIndicator.current = null;
    }
  }, []);

  const updateIndicator = useCallback((progress: number) => {
    if (!swipeIndicator.current) return;
    
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    swipeIndicator.current.style.opacity = String(clampedProgress);
    swipeIndicator.current.style.transform = `translateY(-50%) translateX(${-100 + (clampedProgress * 100)}%)`;
  }, []);

  const resetIndicator = useCallback(() => {
    if (!swipeIndicator.current) return;
    swipeIndicator.current.style.opacity = '0';
    swipeIndicator.current.style.transform = 'translateY(-50%) translateX(-100%)';
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isSwipeDisabled()) return;
    
    const touch = e.touches[0];
    
    // Only trigger if touch starts from left edge (within 30px)
    if (touch.clientX > 30) return;
    
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwiping.current = true;
    
    createSwipeIndicator();
  }, [enabled, isSwipeDisabled, createSwipeIndicator]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current || !enabled) return;
    
    const touch = e.touches[0];
    touchEndX.current = touch.clientX;
    touchEndY.current = touch.clientY;
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    
    // Cancel if too much vertical movement
    if (deltaY > maxVerticalMovement) {
      isSwiping.current = false;
      resetIndicator();
      return;
    }
    
    // Update visual indicator
    if (deltaX > 0) {
      const progress = Math.min(deltaX / threshold, 1);
      updateIndicator(progress);
    }
  }, [enabled, maxVerticalMovement, threshold, resetIndicator, updateIndicator]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current || !enabled) {
      resetIndicator();
      return;
    }
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    
    // Check if swipe meets criteria
    if (deltaX >= threshold && deltaY <= maxVerticalMovement) {
      // Trigger navigation
      if (onSwipeBack) {
        onSwipeBack();
      } else {
        navigate(-1);
      }
    }
    
    // Reset
    isSwiping.current = false;
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
    
    resetIndicator();
    
    // Cleanup indicator after animation
    setTimeout(removeSwipeIndicator, 200);
  }, [enabled, threshold, maxVerticalMovement, onSwipeBack, navigate, resetIndicator, removeSwipeIndicator]);

  useEffect(() => {
    if (!enabled) return;

    // Only enable on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      removeSwipeIndicator();
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, removeSwipeIndicator]);

  return {
    isSwipeDisabled: isSwipeDisabled()
  };
}

export default useSwipeNavigation;
