import { useEffect, useRef, useCallback } from 'react';

/**
 * Global pull-to-refresh hook.
 * VERY strict: only triggers when user deliberately pulls down from
 * the absolute top of the page with a long intentional gesture.
 * Will NOT trigger during normal scrolling up/down.
 */
export function usePullToRefresh() {
  const startY = useRef(0);
  const startX = useRef(0);
  const isPulling = useRef(false);
  const gestureRejected = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const threshold = 250; // px needed to trigger refresh — very intentional
  const maxPull = 300;
  const minStartZone = 40; // touch must start in top 40px of viewport only
  const minPullBeforeVisual = 80; // don't show indicator until 80px of pure downward pull
  const maxHorizontalDrift = 40; // reject if finger drifts > 40px horizontally (it's a scroll)

  const createIndicator = useCallback(() => {
    if (indicatorRef.current) return;
    const el = document.createElement('div');
    el.id = 'pull-to-refresh-indicator';
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%) translateY(-100%);
      z-index: 99999;
      transition: transform 0.2s ease, opacity 0.2s ease;
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 0 0 16px 16px;
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    el.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
      </svg>
      <span>Puxe para atualizar</span>
    `;
    document.body.appendChild(el);
    indicatorRef.current = el;
  }, []);

  const updateIndicator = useCallback((pullDistance: number) => {
    const el = indicatorRef.current;
    if (!el) return;
    // Only show after minPullBeforeVisual
    const effectivePull = Math.max(0, pullDistance - minPullBeforeVisual);
    const effectiveThreshold = threshold - minPullBeforeVisual;
    const progress = Math.min(effectivePull / effectiveThreshold, 1);
    const translateY = Math.min(effectivePull * 0.4, maxPull * 0.4) - el.offsetHeight;
    el.style.transform = `translateX(-50%) translateY(${Math.max(translateY, -el.offsetHeight)}px)`;
    el.style.opacity = String(Math.min(progress, 1));

    const svg = el.querySelector('svg') as SVGElement | null;
    if (svg) {
      svg.style.transform = `rotate(${progress * 360}deg)`;
    }

    const span = el.querySelector('span');
    if (span) {
      span.textContent = progress >= 1 ? 'Solte para atualizar' : 'Puxe para atualizar';
    }
  }, []);

  const hideIndicator = useCallback(() => {
    const el = indicatorRef.current;
    if (!el) return;
    el.style.transform = 'translateX(-50%) translateY(-100%)';
    el.style.opacity = '0';
  }, []);

  const showRefreshing = useCallback(() => {
    const el = indicatorRef.current;
    if (!el) return;
    const span = el.querySelector('span');
    if (span) span.textContent = 'Atualizando...';
    const svg = el.querySelector('svg') as SVGElement | null;
    if (svg) svg.style.animation = 'spin 0.8s linear infinite';
  }, []);

  useEffect(() => {
    createIndicator();

    const hasAnythingOverMainScreen = (): boolean => {
      return !!(
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[role="alertdialog"]') ||
        document.querySelector('[role="listbox"]') ||
        document.querySelector('[role="menu"]') ||
        document.querySelector('[role="tooltip"]') ||
        document.querySelector('[data-state="open"]') ||
        document.querySelector('[data-radix-popper-content-wrapper]') ||
        document.querySelector('[data-radix-dialog-overlay]') ||
        document.querySelector('[data-radix-alert-dialog-overlay]') ||
        document.querySelector('.vaul-drawer-visible') ||
        document.querySelector('[data-sonner-toast]') ||
        document.querySelector('.fixed.inset-0') ||
        document.querySelector('.fixed.bottom-0[class*="z-"]') ||
        document.querySelector('[data-side][data-align]') ||
        document.querySelector('[data-expanded="true"]') ||
        document.querySelector('.sheet-content') ||
        document.querySelector('[data-vaul-drawer]')
      );
    };

    const isInsideScrollableContainer = (el: HTMLElement): boolean => {
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
          // Element is inside a scrollable container that has content to scroll
          if (parent.scrollTop > 0) return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      gestureRejected.current = false;

      // STRICT: page must be at absolute top
      if (window.scrollY > 0) return;

      // STRICT: touch must start in the very top 40px of viewport
      if (e.touches[0].clientY > minStartZone) return;

      // Block when ANY overlay is open
      if (hasAnythingOverMainScreen()) return;

      const target = e.target as HTMLElement;

      // Don't trigger inside opt-out containers
      if (target.closest('[data-no-pull-refresh]')) return;

      // Don't trigger inside form elements
      if (target.closest('input, textarea, select, [contenteditable]')) return;

      // Don't trigger inside scrollable containers that have scrolled
      if (isInsideScrollableContainer(target)) return;

      // Don't trigger inside nav bars, tabs, or interactive areas at top
      if (target.closest('nav, [role="tablist"], [role="navigation"], header')) return;

      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || gestureRejected.current) return;

      // If page scrolled during the gesture, abort
      if (window.scrollY > 0) {
        isPulling.current = false;
        gestureRejected.current = true;
        hideIndicator();
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const pullDistance = currentY - startY.current;
      const horizontalDrift = Math.abs(currentX - startX.current);

      // If pulling UP (scrolling down), reject immediately
      if (pullDistance < 0) {
        isPulling.current = false;
        gestureRejected.current = true;
        hideIndicator();
        return;
      }

      // If finger is drifting horizontally, this is a swipe not a pull-to-refresh
      if (horizontalDrift > maxHorizontalDrift) {
        isPulling.current = false;
        gestureRejected.current = true;
        hideIndicator();
        return;
      }

      // Only prevent default scroll after very significant intentional downward pull
      if (pullDistance > minPullBeforeVisual) {
        e.preventDefault();
        updateIndicator(pullDistance);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current || gestureRejected.current) {
        isPulling.current = false;
        gestureRejected.current = false;
        hideIndicator();
        return;
      }

      isPulling.current = false;
      gestureRejected.current = false;

      const el = indicatorRef.current;
      if (!el) return;

      const opacity = parseFloat(el.style.opacity || '0');
      if (opacity >= 1) {
        showRefreshing();
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        hideIndicator();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      if (indicatorRef.current) {
        indicatorRef.current.remove();
        indicatorRef.current = null;
      }
    };
  }, [createIndicator, updateIndicator, hideIndicator, showRefreshing]);
}
