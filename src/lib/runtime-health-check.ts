/**
 * ✅ RELEASE HARDENING: Runtime Health Check
 * 
 * Validates build integrity and reports issues without blocking UI.
 * Runs automatically on app load and before critical actions.
 */

import { supabase } from '@/integrations/supabase/client';
import { ENV, PLATFORM, getEnvironmentInfo } from '@/config/env';

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    buildId: boolean;
    assetsPath: boolean;
    modeConsistent: boolean;
    supabaseReachable: boolean;
  };
  errors: string[];
  timestamp: string;
}

let lastHealthCheck: HealthCheckResult | null = null;
let healthCheckPromise: Promise<HealthCheckResult> | null = null;

/**
 * Check if build assets are served correctly (not HTML)
 * 
 * NOTA: Em desenvolvimento (Vite dev server), os scripts são servidos diretamente
 * sem o prefixo /assets/. Isso NÃO é um problema - é comportamento normal.
 */
async function checkAssetIntegrity(): Promise<boolean> {
  try {
    // Em desenvolvimento, Vite serve scripts diretamente - isso é OK
    const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    // Find a script tag with /assets/ path (produção) ou qualquer script type=module (dev)
    const productionScripts = document.querySelectorAll('script[src*="/assets/"]');
    const devScripts = document.querySelectorAll('script[type="module"][src]');
    
    // Em desenvolvimento, aceitar scripts de módulo sem /assets/
    if (productionScripts.length === 0) {
      if (isDevelopment && devScripts.length > 0) {
        console.debug('[HealthCheck] Development mode - Vite dev scripts detected, OK');
        return true;
      }
      
      // Em produção, devemos ter /assets/ scripts
      if (!isDevelopment) {
        console.warn('[HealthCheck] Production mode - No /assets/ scripts found');
        return false;
      }
      
      // Fallback: aceitar se há qualquer script carregado
      console.debug('[HealthCheck] No /assets/ scripts, but dev mode - OK');
      return true;
    }

    // Check Content-Type of first asset (apenas em produção)
    const firstScript = productionScripts[0] as HTMLScriptElement;
    const response = await fetch(firstScript.src, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    
    // Asset should be JS, not HTML
    if (contentType.includes('text/html')) {
      console.error('[HealthCheck] CRITICAL: Assets being served as HTML!', {
        url: firstScript.src,
        contentType,
      });
      return false;
    }

    return response.ok && (contentType.includes('javascript') || contentType.includes('application/'));
  } catch (error) {
    console.error('[HealthCheck] Asset check failed:', error);
    // Em caso de erro de rede, não bloquear - retornar true
    return true;
  }
}

/**
 * Check if Supabase is reachable
 */
async function checkSupabaseReachable(): Promise<boolean> {
  try {
    // Simple health check - get session (doesn't require auth)
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Run complete health check
 */
export async function runHealthCheck(force = false): Promise<HealthCheckResult> {
  // Return cached result if available and not forced
  if (!force && lastHealthCheck && Date.now() - new Date(lastHealthCheck.timestamp).getTime() < 60000) {
    return lastHealthCheck;
  }

  // Prevent concurrent checks
  if (healthCheckPromise && !force) {
    return healthCheckPromise;
  }

  healthCheckPromise = (async () => {
    const errors: string[] = [];
    const timestamp = new Date().toISOString();

    // Check 1: Build ID present
    const buildIdPresent = !!(window as any).__APP_BUILD_ID;
    if (!buildIdPresent) {
      errors.push('BUILD_ID not found in window object');
    }

    // Check 2: Assets path correct (only in browser)
    const assetsOk = await checkAssetIntegrity();
    if (!assetsOk) {
      errors.push('Asset integrity check failed - assets may be served incorrectly');
    }

    // Check 3: Mode consistency
    const modeConsistent = ENV.MODE === (import.meta.env.MODE || 'development');
    if (!modeConsistent) {
      errors.push(`Mode mismatch: ENV.MODE=${ENV.MODE}, import.meta.env.MODE=${import.meta.env.MODE}`);
    }

    // Check 4: Supabase reachable
    const supabaseOk = await checkSupabaseReachable();
    if (!supabaseOk) {
      errors.push('Supabase unreachable');
    }

    const result: HealthCheckResult = {
      healthy: errors.length === 0,
      checks: {
        buildId: buildIdPresent,
        assetsPath: assetsOk,
        modeConsistent,
        supabaseReachable: supabaseOk,
      },
      errors,
      timestamp,
    };

    lastHealthCheck = result;

    // Log result
    if (result.healthy) {
      console.debug('[HealthCheck] ✅ All checks passed', {
        buildId: (window as any).__APP_BUILD_ID,
        platform: PLATFORM.NAME,
        mode: ENV.MODE,
      });
    } else {
      console.error('[HealthCheck] ❌ Health check failed:', result);
      
      // Report to backend (silent - no toast)
      reportHealthFailure(result).catch(() => {});
    }

    return result;
  })();

  const result = await healthCheckPromise;
  healthCheckPromise = null;
  return result;
}

/**
 * Report health check failure to backend
 */
async function reportHealthFailure(result: HealthCheckResult): Promise<void> {
  try {
    const envInfo = getEnvironmentInfo();
    
    await supabase.functions.invoke('report-error', {
      body: {
        errorType: 'HEALTH_CHECK_FAILED',
        errorMessage: result.errors.join('; '),
        context: {
          checks: result.checks,
          errors: result.errors,
          ...envInfo,
          url: window.location.href,
          timestamp: result.timestamp,
        },
      },
    });
  } catch (error) {
    console.error('[HealthCheck] Failed to report error:', error);
  }
}

/**
 * Run health check before critical action
 * Returns true if healthy or if check is skipped (never blocks UI)
 */
export async function ensureHealthy(actionName: string): Promise<boolean> {
  try {
    const result = await runHealthCheck();
    
    if (!result.healthy) {
      console.warn(`[HealthCheck] Running ${actionName} despite failed health check:`, result.errors);
    }
    
    // Always return true to never block UI
    return true;
  } catch (error) {
    console.error(`[HealthCheck] Error checking health for ${actionName}:`, error);
    // Never block UI
    return true;
  }
}

/**
 * Modal safety wrapper - ensures backdrop is always cleaned up
 */
export function cleanupModalBackdrop(): void {
  // Remove any stuck backdrop overlays
  const backdrops = document.querySelectorAll('[data-radix-portal], [role="dialog"], [data-state="open"]');
  backdrops.forEach((el) => {
    const backdrop = el.closest('[data-radix-portal]');
    if (backdrop && !backdrop.querySelector('[data-state="open"]')) {
      backdrop.remove();
    }
  });

  // Remove stuck body styles
  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.body.classList.remove('overflow-hidden', 'pointer-events-none');

  // Remove any orphaned overlays
  const overlays = document.querySelectorAll('.fixed.inset-0.bg-black\\/80, .fixed.inset-0.z-50');
  overlays.forEach((overlay) => {
    if (!overlay.querySelector('[role="dialog"]')) {
      overlay.remove();
    }
  });
}

/**
 * Safe modal opener with health check and cleanup
 */
export async function safeOpenModal(
  openFn: () => void,
  modalName: string
): Promise<void> {
  try {
    // Run health check (non-blocking)
    await ensureHealthy(`open_${modalName}`);
    
    // Open the modal
    openFn();
  } catch (error) {
    console.error(`[HealthCheck] Error opening ${modalName}:`, error);
    
    // Clean up any stuck state
    cleanupModalBackdrop();
    
    // Report error
    supabase.functions.invoke('report-error', {
      body: {
        errorType: 'MODAL_OPEN_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          modalName,
          url: window.location.href,
          buildId: (window as any).__APP_BUILD_ID,
          platform: PLATFORM.NAME,
        },
      },
    }).catch(() => {});
  }
}

/**
 * Initialize health check on app load
 */
export function initializeHealthCheck(): void {
  // Run initial check after a short delay (let app hydrate first)
  setTimeout(() => {
    runHealthCheck().catch(console.error);
  }, 2000);

  // Periodic check every 5 minutes (only in production)
  if (ENV.IS_PRODUCTION) {
    setInterval(() => {
      runHealthCheck().catch(console.error);
    }, 5 * 60 * 1000);
  }

  // Check on visibility change (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      runHealthCheck().catch(console.error);
    }
  });
}

export default {
  runHealthCheck,
  ensureHealthy,
  cleanupModalBackdrop,
  safeOpenModal,
  initializeHealthCheck,
};
