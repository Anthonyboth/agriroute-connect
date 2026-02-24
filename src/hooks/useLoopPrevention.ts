import { useCallback, useEffect, useRef, useState } from 'react';

type LoopTrigger = 'REACT_UPDATE_DEPTH' | 'REACT_TOO_MANY_RERENDERS';

export interface LoopPreventionOptions {
  /** Throttle de alerta para Telegram (ms) */
  alertThrottleMs?: number;
}

export interface LoopTripDetails {
  trigger: LoopTrigger;
  errorMessage?: string;
  stack?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ALERT_LAST_SENT_KEY = 'loop_prevention_last_alert_at';

async function notifyTelegram(details: LoopTripDetails): Promise<void> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

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
        errorMessage: details.errorMessage,
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
    // Never propagate errors here
  }
}

/**
 * useLoopPrevention
 *
 * Lightweight circuit breaker — only catches React-thrown loop errors.
 * NO per-render tracking, NO event-loop polling, NO fetch interception.
 */
export function useLoopPrevention(options: LoopPreventionOptions = {}) {
  const { alertThrottleMs = 60000 } = options;

  const [isTripped, setIsTripped] = useState(false);
  const isTrippedRef = useRef(false);
  const tripDetailsRef = useRef<LoopTripDetails | null>(null);

  const trip = useCallback(
    (details: LoopTripDetails) => {
      if (isTrippedRef.current) return;

      isTrippedRef.current = true;
      tripDetailsRef.current = details;
      setIsTripped(true);

      try {
        const now = Date.now();
        const last = parseInt(localStorage.getItem(ALERT_LAST_SENT_KEY) || '0', 10) || 0;
        if (!last || now - last >= alertThrottleMs) {
          localStorage.setItem(ALERT_LAST_SENT_KEY, String(now));
          void notifyTelegram(details);
        }
      } catch {
        // ignore
      }
    },
    [alertThrottleMs]
  );

  // Only detector: React-thrown errors (Maximum update depth / Too many re-renders / hook mismatch)
  useEffect(() => {
    if (isTrippedRef.current) return;

    const onError = (event: ErrorEvent) => {
      const msg = event?.error?.message || event?.message || '';
      if (typeof msg !== 'string') return;

      if (msg.includes('Maximum update depth exceeded')) {
        trip({ trigger: 'REACT_UPDATE_DEPTH', errorMessage: msg, stack: event?.error?.stack });
      } else if (
        msg.includes('Too many re-renders') ||
        msg.includes('Rendered more hooks than during the previous render') ||
        msg.includes('Rendered fewer hooks than expected')
      ) {
        trip({ trigger: 'REACT_TOO_MANY_RERENDERS', errorMessage: msg, stack: event?.error?.stack });
      }
    };

    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, [trip]);

  const reset = useCallback(() => {
    isTrippedRef.current = false;
    tripDetailsRef.current = null;
    setIsTripped(false);
  }, []);

  return {
    isTripped,
    tripDetails: tripDetailsRef.current,
    reset,
  };
}

export default useLoopPrevention;
