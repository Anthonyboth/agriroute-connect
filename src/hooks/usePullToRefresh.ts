import { useEffect, useRef, useCallback } from 'react';

/**
 * Global pull-to-refresh hook.
 * When user swipes down from the top of the page, triggers a full reload.
 * Works on mobile (touch) and respects scroll position.
 */
export function usePullToRefresh() {
  const startY = useRef(0);
  const isPulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const threshold = 120; // px to trigger refresh
  const maxPull = 160;

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
    const progress = Math.min(pullDistance / threshold, 1);
    const translateY = Math.min(pullDistance * 0.5, maxPull * 0.5) - el.offsetHeight;
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

    const isModalOrOverlayOpen = (): boolean => {
      // Check for any open dialog/modal/sheet/drawer/popover/dropdown
      return !!(
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[role="alertdialog"]') ||
        document.querySelector('[data-state="open"][data-radix-popper-content-wrapper]') ||
        document.querySelector('[data-state="open"].fixed') ||
        document.querySelector('.vaul-drawer-visible') ||
        document.querySelector('[data-radix-dialog-overlay]') ||
        document.querySelector('[data-radix-alert-dialog-overlay]')
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      // Only trigger when at the very top of the page
      if (window.scrollY > 5) return;
      // Block pull-to-refresh when any modal/dialog/sheet is open
      if (isModalOrOverlayOpen()) return;
      // Don't trigger inside scrollable containers that aren't at top
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-pull-refresh]')) return;

      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      if (window.scrollY > 5) {
        isPulling.current = false;
        hideIndicator();
        return;
      }

      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY.current;

      if (pullDistance < 0) {
        isPulling.current = false;
        hideIndicator();
        return;
      }

      if (pullDistance > 10) {
        // Prevent default scroll to allow our custom pull behavior
        e.preventDefault();
      }

      updateIndicator(pullDistance);
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      const el = indicatorRef.current;
      if (!el) return;

      const opacity = parseFloat(el.style.opacity || '0');
      if (opacity >= 1) {
        // Threshold reached — refresh
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
