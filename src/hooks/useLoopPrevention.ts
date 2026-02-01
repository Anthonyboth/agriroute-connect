import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type LoopTrigger = 'RENDER_RATE' | 'REACT_UPDATE_DEPTH' | 'REACT_TOO_MANY_RERENDERS';

export interface LoopPreventionOptions {
  /** Janela (ms) para medir taxa de renders */
  renderWindowMs?: number;
  /** Máximo de renders dentro da janela antes de disparar proteção */
  maxRendersInWindow?: number;
  /** Throttle de alerta para Telegram (ms) */
  alertThrottleMs?: number;
}

export interface LoopTripDetails {
  trigger: LoopTrigger;
  renderCount?: number;
  windowMs?: number;
  errorMessage?: string;
  stack?: string;
}

const SUPABASE_URL = 'https://shnvtxejjecbnztdbbbl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg';

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
        platform,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        timestamp: new Date().toISOString(),
      },
    };

    // Função pública dedicada (sem auth) para alertas imediatos
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
 * Hook de "circuit breaker" para impedir que loops (render/update) congelem o app.
 * Quando detectado, ele:
 * 1) "tripa" (retorna isTripped=true) para que um Boundary possa parar de renderizar o app
 * 2) Notifica no Telegram (com throttle) para ação imediata
 */
export function useLoopPrevention(options: LoopPreventionOptions = {}) {
  const {
    renderWindowMs = 2000,
    maxRendersInWindow = 60,
    alertThrottleMs = 60000,
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

      // Throttle para evitar spam
      const now = safeNow();
      const last = safeGetLastAlertAt();
      if (!last || now - last >= alertThrottleMs) {
        safeSetLastAlertAt(now);
        notifyTelegram(details);
      }
    },
    [alertThrottleMs]
  );

  // Detector 1: taxa de re-renders muito alta (indicativo de loop)
  useEffect(() => {
    if (isTrippedRef.current) return;

    const now = safeNow();
    const arr = renderTimesRef.current;
    arr.push(now);

    // manter apenas eventos recentes
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

      if (msg.includes('Too many re-renders')) {
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

      if (msg.includes('Maximum update depth exceeded')) {
        trip({
          trigger: 'REACT_UPDATE_DEPTH',
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

  const reset = useCallback(() => {
    // Permite que o usuário tente recuperar manualmente sem reload
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
