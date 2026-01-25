/**
 * Debug utilities for authentication - DEV only
 * Used to validate single-flight logout and single listener
 */

declare global {
  interface Window {
    __AUTH_LISTENERS__: number;
    __SIGNOUT_CALLS__: number;
  }
}

export function initAuthDebug() {
  if (!import.meta.env.DEV) return;
  
  window.__AUTH_LISTENERS__ = 0;
  window.__SIGNOUT_CALLS__ = 0;
  
  console.log('[AuthDebug] Initialized. Check window.__AUTH_LISTENERS__ and window.__SIGNOUT_CALLS__');
}

export function incrementAuthListeners() {
  if (!import.meta.env.DEV) return;
  
  window.__AUTH_LISTENERS__ = (window.__AUTH_LISTENERS__ || 0) + 1;
  console.log(`[AUTH] listener registered. active=${window.__AUTH_LISTENERS__}`);
}

export function decrementAuthListeners() {
  if (!import.meta.env.DEV) return;
  
  window.__AUTH_LISTENERS__ = Math.max(0, (window.__AUTH_LISTENERS__ || 1) - 1);
  console.log(`[AUTH] listener unsubscribed. active=${window.__AUTH_LISTENERS__}`);
}

export function incrementSignOutCalls() {
  if (!import.meta.env.DEV) return;
  
  window.__SIGNOUT_CALLS__ = (window.__SIGNOUT_CALLS__ || 0) + 1;
  console.log(`[AUTH] logout called count=${window.__SIGNOUT_CALLS__}`);
}

// Initialize on load
if (typeof window !== 'undefined') {
  initAuthDebug();
}
