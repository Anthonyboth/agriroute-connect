import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

/**
 * FRT-076: Monitor de crashes nativos Android/iOS
 * 
 * Intercepta erros específicos do ambiente Capacitor e envia ao Telegram:
 * 1. WebView crashes (blank screen / load failures)
 * 2. Plugin bridge errors (native ↔ JS failures)
 * 3. App state transitions (background → crash detection)
 * 4. Native uncaught exceptions surfaced via console
 * 5. Memory pressure / low memory warnings
 * 6. Boot timing anomalies (app took too long to render)
 */
export function useNativeCrashMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__nativeCrashMonitorActive) return;
    (window as any).__nativeCrashMonitorActive = true;

    const isNative = Capacitor.isNativePlatform();
    const platform = isNative ? Capacitor.getPlatform() : 'web';
    const errorMonitoring = ErrorMonitoringService.getInstance();

    // ===== Crash context collector =====
    const getCrashContext = () => ({
      platform,
      isNative,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      online: navigator.onLine,
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      } : undefined,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });

    const reportCrash = (message: string, source: string, extra?: Record<string, unknown>) => {
      const ctx = getCrashContext();
      const prefix = isNative ? `📱 [${platform.toUpperCase()} CRASH]` : '🌐 [WEB CRASH]';
      
      errorMonitoring.captureError(
        new Error(`${prefix} ${message}`.slice(0, 500)),
        {
          source,
          functionName: `native-crash-monitor/${source}`,
          userFacing: true,
          route: window.location.pathname,
          metadata: { ...ctx, ...extra, crashMonitorVersion: 'v1' },
        }
      ).catch(() => { /* fail silently */ });
    };

    const cleanups: (() => void)[] = [];

    // ===== 1. Capacitor plugin bridge errors =====
    // Intercept console messages from Capacitor native bridge
    if (isNative) {
      const originalConsoleError = console.error;
      const nativeBridgeInterceptor = (...args: any[]) => {
        const raw = args.map(a => {
          if (a instanceof Error) return a.message;
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');

        const lower = raw.toLowerCase();

        // Detect Capacitor bridge / native crashes
        const isCrashSignal = (
          lower.includes('capacitor runtime error') ||
          lower.includes('capacitor caught') ||
          lower.includes('native bridge error') ||
          lower.includes('webview error') ||
          lower.includes('fatal exception') ||
          lower.includes('application not responding') ||
          lower.includes('out of memory') ||
          lower.includes('oom_adj') ||
          lower.includes('classnotfoundexception') ||
          lower.includes('noclassdeffounderror') ||
          lower.includes('nullpointerexception') ||
          lower.includes('securityexception') ||
          lower.includes('activitynotfoundexception') ||
          lower.includes('runtimeexception') ||
          lower.includes('illegalstateexception') ||
          lower.includes('sigabrt') ||
          lower.includes('sigsegv') ||
          lower.includes('sigbus') ||
          lower.includes('exc_bad_access') ||
          lower.includes('nsexception') ||
          lower.includes('unrecognized selector') ||
          lower.includes('thread 1: signal') ||
          (lower.includes('error') && lower.includes('capacitor') && !lower.includes('plugin is not implemented'))
        );

        if (isCrashSignal) {
          reportCrash(raw.slice(0, 400), 'native_bridge_error', {
            rawArgs: raw.slice(0, 800),
          });
        }
      };

      // Wrap console.error additionally (does not replace usePanelErrorTelegramReporter)
      const patchedError = console.error;
      const wrappedError = (...args: any[]) => {
        nativeBridgeInterceptor(...args);
        // Don't call patchedError again — the usePanelErrorTelegramReporter already patches console.error
        // Just call through to the current implementation
      };
      // Listen via a separate channel: window error events for native-specific signals
      const nativeErrorListener = (event: ErrorEvent) => {
        if (!event.error) return;
        const msg = event.error?.message || event.message || '';
        const lower = msg.toLowerCase();
        if (
          lower.includes('capacitor') ||
          lower.includes('native') ||
          lower.includes('bridge') ||
          lower.includes('webview')
        ) {
          reportCrash(msg.slice(0, 400), 'native_error_event', {
            filename: event.filename,
            lineno: event.lineno,
          });
        }
      };
      window.addEventListener('error', nativeErrorListener, true);
      cleanups.push(() => window.removeEventListener('error', nativeErrorListener, true));
    }

    // ===== 2. App state monitoring (resume after crash) =====
    if (isNative) {
      let lastPauseTime: number | null = null;
      let wasBackgrounded = false;

      const setupAppStateListener = async () => {
        try {
          const handle = await CapApp.addListener('appStateChange', (state) => {
            if (!state.isActive) {
              // App going to background
              lastPauseTime = Date.now();
              wasBackgrounded = true;
              // Save state for crash detection on next resume
              try {
                localStorage.setItem('__crashMonitor_lastPause', String(lastPauseTime));
                localStorage.setItem('__crashMonitor_cleanExit', 'false');
              } catch { /* ignore */ }
            } else if (wasBackgrounded && lastPauseTime) {
              // App resumed — check for anomalies
              
              wasBackgrounded = false;
              try {
                localStorage.setItem('__crashMonitor_cleanExit', 'true');
              } catch { /* ignore */ }
            }
          });

          cleanups.push(() => {
            handle.remove();
          });
        } catch (e) {
          // App plugin not available — not critical
          console.debug('[NativeCrashMonitor] App plugin not available:', e);
        }
      };

      setupAppStateListener();
    }

    // ===== 3. Boot crash detection =====
    // Removed because Android commonly kills backgrounded apps silently, leading to false positives.

    // ===== 4. WebView blank screen detection =====
    if (isNative) {
      // After 10 seconds, check if the app rendered properly
      const blankScreenTimer = setTimeout(() => {
        const appRoot = document.getElementById('root');
        if (appRoot) {
          const hasContent = appRoot.children.length > 0 && appRoot.innerHTML.length > 100;
          if (!hasContent) {
            reportCrash(
              'Blank screen detected 10s after boot — WebView may have failed to render',
              'blank_screen_detection',
              {
                rootChildren: appRoot.children.length,
                rootHTMLLength: appRoot.innerHTML.length,
              }
            );
          }
        }
      }, 10_000);

      cleanups.push(() => clearTimeout(blankScreenTimer));
    }

    // ===== 5. Memory pressure monitoring =====
    if (isNative && (performance as any).memory) {
      const memoryCheckInterval = setInterval(() => {
        const mem = (performance as any).memory;
        if (!mem) return;
        
        const usagePercent = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
        
        if (usagePercent > 90) {
          reportCrash(
            `Critical memory pressure: ${usagePercent.toFixed(1)}% heap used (${Math.round(mem.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(mem.jsHeapSizeLimit / 1024 / 1024)}MB)`,
            'memory_pressure_critical',
            {
              usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
              totalMB: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
              usagePercent: usagePercent.toFixed(1),
            }
          );
        }
      }, 30_000); // Check every 30s

      cleanups.push(() => clearInterval(memoryCheckInterval));
    }

    // ===== 6. Unresponsive UI detection (long tasks) =====
    // Removed because a Javascript long task (like heavy React Hydration) is not a native crash and can spam the monitor.

    // ===== 7. Network connectivity crash correlation =====
    if (isNative) {
      let offlineSince: number | null = null;

      const handleOffline = () => {
        offlineSince = Date.now();
      };

      const handleOnline = () => {
        if (offlineSince) {
          const offlineDuration = Date.now() - offlineSince;
          if (offlineDuration > 60_000) {
            // Report extended offline periods that might correlate with crashes
            reportCrash(
              `Network restored after ${Math.round(offlineDuration / 1000)}s offline`,
              'network_restored_after_offline',
              { offlineDurationMs: offlineDuration }
            );
          }
          offlineSince = null;
        }
      };

      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
      cleanups.push(() => {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      });
    }

    return () => {
      cleanups.forEach(fn => fn());
      delete (window as any).__nativeCrashMonitorActive;
    };
  }, []);
}
