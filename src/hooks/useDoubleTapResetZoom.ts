import { useEffect } from 'react';

/**
 * Reseta o zoom da viewport para 1.0 ao dar dois toques rápidos na tela.
 * Funciona em conjunto com user-scalable=yes no viewport meta tag.
 */
export function useDoubleTapResetZoom() {
  useEffect(() => {
    let lastTap = 0;

    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (now - lastTap < DOUBLE_TAP_DELAY) {
        e.preventDefault();
        // Reset zoom via viewport meta
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes'
          );
        }
      }
      lastTap = now;
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => document.removeEventListener('touchend', handleTouchEnd);
  }, []);
}
