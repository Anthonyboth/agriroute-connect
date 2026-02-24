import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type LoopTrigger =
  | 'RENDER_RATE'
  | 'RENDER_RATE_SLOW'
  | 'REACT_UPDATE_DEPTH'
  | 'REACT_TOO_MANY_RERENDERS'
  | 'FETCH_FLOOD'
  | 'LONG_TASK_FLOOD';

export interface LoopPreventionOptions {
  /** Janela (ms) para medir taxa de renders rápidos */
  renderWindowMs?: number;
  /** Máximo de renders dentro da janela antes de disparar proteção */
  maxRendersInWindow?: number;
  /** Janela longa (ms) para detectar loops lentos */
  slowRenderWindowMs?: number;
  /** Máximo de renders na janela longa */
  maxRendersInSlowWindow?: number;
  /** Throttle de alerta para Telegram (ms) */
  alertThrottleMs?: number;
}

export interface LoopTripDetails {
  trigger: LoopTrigger;
  renderCount?: number;
  windowMs?: number;
  errorMessage?: string;
  stack?: string;
  fetchUrl?: string;
  fetchCount?: number;
}

const SUPABASE_URL = 'https://shnvtxejjecbnztdbbbl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg';

const ALERT_LAST_SENT_KEY = 'loop_prevention_last_alert_at';
const FETCH_FLOOD_WINDOW_MS = 10_000; // 10s
const FETCH_FLOOD_THRESHOLD = 30; // 30 requests iguais em 10s = flood
const LONG_TASK_WINDOW_MS = 30_000; // 30s
const LONG_TASK_THRESHOLD = 10; // 10 long tasks em 30s

function safeNow(): number {
  return Date.now();
}

function safeGetLastAlertAt(): number {
  try {
    return parseInt(localStorage.getItem(ALERT_LAST_SENT_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function safeSetLastAlertAt(value: number): void {
  try {
    localStorage.setItem(ALERT_LAST_SENT_KEY, String(value));
  } catch {
    // ignore
  }
}

async function notifyTelegram(details: LoopTripDetails): Promise<void> {
  try {
    const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';

    const payload = {
      errorType: 'FRONTEND',
      errorCategory: 'CRITICAL',
      errorMessage: `LOOP_PREVENTED (${details.trigger})`,
      module: 'useLoopPrevention',
      functionName: 'trip',
      route: typeof window !== 'undefined' ? window.location.pathname : 'N/A',
      errorStack: details.stack,
      metadata: {
        trigger: details.trigger,
        renderCount: details.renderCount,
        windowMs: details.windowMs,
        errorMessage: details.errorMessage,
        fetchUrl: details.fetchUrl,
        fetchCount: details.fetchCount,
        platform,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        timestamp: new Date().toISOString(),
      },
    };

    await fetch(`${SUPABASE_URL}/functions/v1/telegram-error-notifier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        'X-Skip-Error-Monitoring': 'true',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Nunca propagar erro aqui
  }
}

// ============================================================
// Detector global de fetch flood (intercepta XMLHttpRequest e fetch)
// ============================================================
interface FetchEntry { url: string; ts: number }

const _fetchLog: FetchEntry[] = [];
let _fetchFloodCallback: ((url: string, count: number) => void) | null = null;
let _fetchInterceptInstalled = false;

function installFetchInterceptor() {
  if (_fetchInterceptInstalled || typeof window === 'undefined') return;
  _fetchInterceptInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request)?.url || '';
      // Não monitorar a própria chamada de alerta
      if (!url.includes('telegram-error-notifier') && !url.includes('X-Skip-Error-Monitoring')) {
        recordFetchCall(url);
      }
    } catch { /* ignore */ }
    return originalFetch.apply(this, [input, init] as any);
  };
}

function recordFetchCall(url: string) {
  const now = safeNow();
  _fetchLog.push({ url, ts: now });

  // Limpar entradas antigas
  const cutoff = now - FETCH_FLOOD_WINDOW_MS;
  while (_fetchLog.length && _fetchLog[0].ts < cutoff) _fetchLog.shift();

  // Contar chamadas para essa URL (normalizada)
  const normalizedUrl = normalizeUrl(url);
  let count = 0;
  for (const entry of _fetchLog) {
    if (normalizeUrl(entry.url) === normalizedUrl) count++;
  }

  if (count >= FETCH_FLOOD_THRESHOLD && _fetchFloodCallback) {
    _fetchFloodCallback(normalizedUrl, count);
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    // Remover query params únicos (timestamps, etc) — manter apenas pathname
    return u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

// ============================================================
// Hook principal
// ============================================================

/**
 * useLoopPrevention v2
 *
 * Circuit breaker que detecta:
 * 1) Render rate alto (60 renders / 2s) — loop rápido
 * 2) Render rate sustentado (200 renders / 15s) — loop lento que trava
 * 3) Erros React de update depth / too many re-renders
 * 4) Fetch flood (30+ requests iguais em 10s)
 * 5) Long task flood (10+ long tasks em 30s via PerformanceObserver)
 *
 * Quando detectado:
 * - Para o app (isTripped=true) → LoopPreventionBoundary mostra UI de recuperação
 * - Envia alerta ao Telegram com detalhes do incidente
 */
export function useLoopPrevention(options: LoopPreventionOptions = {}) {
  const {
    renderWindowMs = 2000,
    maxRendersInWindow = 60,
    slowRenderWindowMs = 15000,
    maxRendersInSlowWindow = 200,
    alertThrottleMs = 60000,
  } = options;

  const [isTripped, setIsTripped] = useState(false);
  const isTrippedRef = useRef(false);
  const renderTimesRef = useRef<number[]>([]);
  const tripDetailsRef = useRef<LoopTripDetails | null>(null);
  const longTaskTimesRef = useRef<number[]>([]);

  const trip = useCallback(
    (details: LoopTripDetails) => {
      if (isTrippedRef.current) return;
      isTrippedRef.current = true;
      tripDetailsRef.current = details;
      setIsTripped(true);

      console.error(`[LOOP-PREVENTION] 🚨 Circuit breaker ativado: ${details.trigger}`, details);

      const now = safeNow();
      const last = safeGetLastAlertAt();
      if (!last || now - last >= alertThrottleMs) {
        safeSetLastAlertAt(now);
        notifyTelegram(details);
      }
    },
    [alertThrottleMs]
  );

  // Detector 1: taxa de re-renders rápida (loop clássico)
  useEffect(() => {
    if (isTrippedRef.current) return;

    const now = safeNow();
    const arr = renderTimesRef.current;
    arr.push(now);

    // Limpar entradas antigas (usar janela lenta como máximo)
    const cutoff = now - slowRenderWindowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();

    // Check rápido (2s)
    const fastCutoff = now - renderWindowMs;
    const fastCount = arr.filter(t => t >= fastCutoff).length;
    if (fastCount >= maxRendersInWindow) {
      trip({
        trigger: 'RENDER_RATE',
        renderCount: fastCount,
        windowMs: renderWindowMs,
      });
      return;
    }

    // Check lento (15s) — detecta loops que não atingem 60/2s mas mantêm 200/15s
    if (arr.length >= maxRendersInSlowWindow) {
      trip({
        trigger: 'RENDER_RATE_SLOW',
        renderCount: arr.length,
        windowMs: slowRenderWindowMs,
      });
    }
  });

  // Detector 2: erros típicos de loop do React
  useEffect(() => {
    if (isTrippedRef.current) return;

    const onError = (event: ErrorEvent) => {
      const msg = event?.error?.message || event?.message || '';
      if (typeof msg !== 'string') return;

      if (msg.includes('Maximum update depth exceeded')) {
        trip({ trigger: 'REACT_UPDATE_DEPTH', errorMessage: msg, stack: event?.error?.stack });
      }
      if (msg.includes('Too many re-renders')) {
        trip({ trigger: 'REACT_TOO_MANY_RERENDERS', errorMessage: msg, stack: event?.error?.stack });
      }
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason: any = (event as any)?.reason;
      const msg = reason?.message || String(reason || '');
      if (typeof msg !== 'string') return;

      if (msg.includes('Maximum update depth exceeded')) {
        trip({ trigger: 'REACT_UPDATE_DEPTH', errorMessage: msg, stack: reason?.stack });
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [trip]);

  // Detector 3: fetch flood (interceptor global)
  useEffect(() => {
    installFetchInterceptor();

    _fetchFloodCallback = (url: string, count: number) => {
      if (isTrippedRef.current) return;
      trip({
        trigger: 'FETCH_FLOOD',
        fetchUrl: url,
        fetchCount: count,
        errorMessage: `${count} fetch calls to ${url} in ${FETCH_FLOOD_WINDOW_MS / 1000}s`,
      });
    };

    return () => {
      _fetchFloodCallback = null;
    };
  }, [trip]);

  // Detector 4: long task flood (PerformanceObserver)
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        if (isTrippedRef.current) return;

        const now = safeNow();
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            longTaskTimesRef.current.push(now);
          }
        }

        // Limpar antigos
        const cutoff = now - LONG_TASK_WINDOW_MS;
        const arr = longTaskTimesRef.current;
        while (arr.length && arr[0] < cutoff) arr.shift();

        if (arr.length >= LONG_TASK_THRESHOLD) {
          trip({
            trigger: 'LONG_TASK_FLOOD',
            renderCount: arr.length,
            windowMs: LONG_TASK_WINDOW_MS,
            errorMessage: `${arr.length} long tasks in ${LONG_TASK_WINDOW_MS / 1000}s`,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: false });
    } catch {
      // PerformanceObserver longtask não suportado
    }

    return () => {
      observer?.disconnect();
    };
  }, [trip]);

  const reset = useCallback(() => {
    isTrippedRef.current = false;
    tripDetailsRef.current = null;
    renderTimesRef.current = [];
    longTaskTimesRef.current = [];
    _fetchLog.length = 0;
    setIsTripped(false);
  }, []);

  return {
    isTripped,
    tripDetails: tripDetailsRef.current,
    reset,
  };
}

export default useLoopPrevention;
