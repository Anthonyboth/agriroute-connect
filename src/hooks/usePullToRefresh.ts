import { useEffect } from 'react';

/**
 * Global pull-to-refresh hook.
 * VERY strict: only triggers when user deliberately pulls down from
 * the absolute top of the page with a long intentional gesture.
 * Uses a single useEffect to avoid hook count changes during HMR.
 */
export function usePullToRefresh() {
  useEffect(() => {
    const THRESHOLD = 250;
    const MAX_PULL = 300;
    const MIN_START_ZONE = 40;
    const MIN_PULL_BEFORE_VISUAL = 80;
    const MAX_HORIZONTAL_DRIFT = 40;

    let startY = 0;
    let startX = 0;
    let pulling = false;
    let rejected = false;
    let indicator: HTMLDivElement | null = null;

    // Create indicator element
    const el = document.createElement('div');
    el.id = 'pull-to-refresh-indicator';
    el.style.cssText = `
      position: fixed; top: 0; left: 50%;
      transform: translateX(-50%) translateY(-100%);
      z-index: 99999; transition: transform 0.2s ease, opacity 0.2s ease;
      opacity: 0; pointer-events: none;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 20px; border-radius: 0 0 16px 16px;
      background: hsl(var(--primary)); color: hsl(var(--primary-foreground));
      font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    el.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;">
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
      </svg>
      <span>Puxe para atualizar</span>
    `;
    document.body.appendChild(el);
    indicator = el;

    function hasOverlay(): boolean {
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
    }

    function isInScrollable(target: HTMLElement): boolean {
      let parent = target.parentElement;
      while (parent && parent !== document.body) {
        const s = window.getComputedStyle(parent);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight && parent.scrollTop > 0) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    }

    function hideIndicator() {
      if (!indicator) return;
      indicator.style.transform = 'translateX(-50%) translateY(-100%)';
      indicator.style.opacity = '0';
    }

    function updateIndicator(pullDistance: number) {
      if (!indicator) return;
      const effectivePull = Math.max(0, pullDistance - MIN_PULL_BEFORE_VISUAL);
      const effectiveThreshold = THRESHOLD - MIN_PULL_BEFORE_VISUAL;
      const progress = Math.min(effectivePull / effectiveThreshold, 1);
      const translateY = Math.min(effectivePull * 0.4, MAX_PULL * 0.4) - indicator.offsetHeight;
      indicator.style.transform = `translateX(-50%) translateY(${Math.max(translateY, -indicator.offsetHeight)}px)`;
      indicator.style.opacity = String(Math.min(progress, 1));
      const svg = indicator.querySelector('svg') as SVGElement | null;
      if (svg) svg.style.transform = `rotate(${progress * 360}deg)`;
      const span = indicator.querySelector('span');
      if (span) span.textContent = progress >= 1 ? 'Solte para atualizar' : 'Puxe para atualizar';
    }

    function onTouchStart(e: TouchEvent) {
      rejected = false;
      if (window.scrollY > 0) return;
      if (e.touches[0].clientY > MIN_START_ZONE) return;
      if (hasOverlay()) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-pull-refresh], input, textarea, select, [contenteditable], nav, [role="tablist"], [role="navigation"], header')) return;
      if (isInScrollable(target)) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      pulling = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling || rejected) return;
      if (window.scrollY > 0) { pulling = false; rejected = true; hideIndicator(); return; }
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const pullDistance = currentY - startY;
      const horizontalDrift = Math.abs(currentX - startX);
      if (pullDistance < 0) { pulling = false; rejected = true; hideIndicator(); return; }
      if (horizontalDrift > MAX_HORIZONTAL_DRIFT) { pulling = false; rejected = true; hideIndicator(); return; }
      if (pullDistance > MIN_PULL_BEFORE_VISUAL) {
        e.preventDefault();
        updateIndicator(pullDistance);
      }
    }

    function onTouchEnd() {
      if (!pulling || rejected) { pulling = false; rejected = false; hideIndicator(); return; }
      pulling = false;
      rejected = false;
      if (!indicator) return;
      const opacity = parseFloat(indicator.style.opacity || '0');
      if (opacity >= 1) {
        const span = indicator.querySelector('span');
        if (span) span.textContent = 'Atualizando...';
        const svg = indicator.querySelector('svg') as SVGElement | null;
        if (svg) svg.style.animation = 'spin 0.8s linear infinite';
        setTimeout(() => window.location.reload(), 300);
      } else {
        hideIndicator();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      if (indicator) { indicator.remove(); indicator = null; }
    };
  }, []);
}
