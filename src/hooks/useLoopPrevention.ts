import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type LoopTrigger = 'RENDER_RATE' | 'REACT_UPDATE_DEPTH' | 'REACT_TOO_MANY_RERENDERS' | 'EVENT_LOOP_BLOCKED';

export interface LoopPreventionOptions {
  /** Janela (ms) para medir taxa de renders */
  renderWindowMs?: number;
  /** Máximo de renders dentro da janela antes de disparar proteção */
  maxRendersInWindow?: number;
  /** Throttle de alerta para Telegram (ms) */
  alertThrottleMs?: number;
  /** Intervalo de monitoramento do event loop (ms) */
  eventLoopCheckMs?: number;
  /** Atraso tolerado (ms) acima do intervalo para considerar bloqueio */
  eventLoopDriftThresholdMs?: number;
  /** Quantos bloqueios consecutivos aceitamos antes de disparar */
  blockedTicksThreshold?: number;
}

export interface LoopTripDetails {
  trigger: LoopTrigger;
  renderCount?: number;
  windowMs?: number;
  errorMessage?: string;
  stack?: string;
  driftMs?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ALERT_LAST_SENT_KEY = 'loop_prevention_last_alert_at';

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

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
        driftMs: details.driftMs,
        errorMessage: details.errorMessage,
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
    // Nunca propagar erro aqui (evita piorar o loop)
  }
}

/**
 * useLoopPrevention
 *
 * Hook de circuit breaker para impedir congelamento do app.
 *
 * Detecta:
 * 1) taxa anormal de re-renders (loop React clássico)
 * 2) erros React de hooks/render (Maximum update depth / Too many re-renders)
 * 3) bloqueio severo de event loop (UI congelando por tarefas pesadas)
 */
export function useLoopPrevention(options: LoopPreventionOptions = {}) {
  const {
    renderWindowMs = 2000,
    maxRendersInWindow = 80,
    alertThrottleMs = 60000,
    eventLoopCheckMs = 2000,
    eventLoopDriftThresholdMs = 1800,
    blockedTicksThreshold = 3,
  } = options;

  const [isTripped, setIsTripped] = useState(false);
  const isTrippedRef = useRef(false);
  const renderTimesRef = useRef<number[]>([]);
  const tripDetailsRef = useRef<LoopTripDetails | null>(null);

  const trip = useCallback(
    (details: LoopTripDetails) => {
      if (isTrippedRef.current) return;

      isTrippedRef.current = true;
      tripDetailsRef.current = details;
      setIsTripped(true);

      const now = safeNow();
      const last = safeGetLastAlertAt();
      if (!last || now - last >= alertThrottleMs) {
        safeSetLastAlertAt(now);
        void notifyTelegram(details);
      }
    },
    [alertThrottleMs]
  );

  // Detector 1: taxa de re-renders muito alta
  useEffect(() => {
    if (isTrippedRef.current) return;

    const now = safeNow();
    const arr = renderTimesRef.current;
    arr.push(now);

    const cutoff = now - renderWindowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();

    if (arr.length >= maxRendersInWindow) {
      trip({
        trigger: 'RENDER_RATE',
        renderCount: arr.length,
        windowMs: renderWindowMs,
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
        trip({
          trigger: 'REACT_UPDATE_DEPTH',
          errorMessage: msg,
          stack: event?.error?.stack,
        });
      }

      if (msg.includes('Too many re-renders') || msg.includes('Rendered more hooks than during the previous render')) {
        trip({
          trigger: 'REACT_TOO_MANY_RERENDERS',
          errorMessage: msg,
          stack: event?.error?.stack,
        });
      }
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason: any = (event as any)?.reason;
      const msg = reason?.message || String(reason || '');
      if (typeof msg !== 'string') return;

      if (
        msg.includes('Maximum update depth exceeded') ||
        msg.includes('Too many re-renders') ||
        msg.includes('Rendered more hooks than during the previous render')
      ) {
        trip({
          trigger: msg.includes('Maximum update depth exceeded')
            ? 'REACT_UPDATE_DEPTH'
            : 'REACT_TOO_MANY_RERENDERS',
          errorMessage: msg,
          stack: reason?.stack,
        });
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [trip]);

  // Detector 3: event loop bloqueado (anti-freeze sem monkey patch global)
  useEffect(() => {
    if (isTrippedRef.current) return;

    let blockedTicks = 0;
    let expectedAt = safeNow() + eventLoopCheckMs;

    const timer = window.setInterval(() => {
      if (isTrippedRef.current) return;

      const now = safeNow();
      const drift = now - expectedAt;
      expectedAt = now + eventLoopCheckMs;

      if (drift > eventLoopDriftThresholdMs) {
        blockedTicks += 1;
      } else {
        blockedTicks = 0;
      }

      if (blockedTicks >= blockedTicksThreshold) {
        trip({
          trigger: 'EVENT_LOOP_BLOCKED',
          driftMs: drift,
          errorMessage: `Event loop drift ${drift}ms (${blockedTicks} consecutive ticks)`,
        });
      }
    }, eventLoopCheckMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [trip, eventLoopCheckMs, eventLoopDriftThresholdMs, blockedTicksThreshold]);

  const reset = useCallback(() => {
    isTrippedRef.current = false;
    tripDetailsRef.current = null;
    renderTimesRef.current = [];
    setIsTripped(false);
  }, []);

  return {
    isTripped,
    tripDetails: tripDetailsRef.current,
    reset,
  };
}

export default useLoopPrevention;

