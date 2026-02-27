import { useEffect } from 'react';
import { toast } from 'sonner';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

const TOAST_THROTTLE_MS = 45_000;

const stringifyToastMessage = (message: unknown): string => {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  if (message == null) return 'Erro desconhecido';
  try {
    return String(message);
  } catch {
    return 'Erro desconhecido';
  }
};

/**
 * Captura ABSOLUTAMENTE TODOS os erros do app e reporta ao Telegram:
 * 1. toast.error (sonner) — erros visíveis ao usuário
 * 2. shadcn toast com variant="destructive"
 * 3. window.onerror — erros JS não capturados
 * 4. window.onunhandledrejection — promises rejeitadas
 * 5. console.error — qualquer console.error chamado
 * 
 * Todos os 5 painéis, todas as abas, modais, qualquer erro.
 */
export function usePanelErrorTelegramReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__panelToastTelegramPatched) return;

    (window as any).__panelToastTelegramPatched = true;

    const errorMonitoring = ErrorMonitoringService.getInstance();
    const throttleMap = new Map<string, number>();

    const shouldReport = (key: string): boolean => {
      const now = Date.now();
      const lastSentAt = throttleMap.get(key) ?? 0;
      if (now - lastSentAt >= TOAST_THROTTLE_MS) {
        throttleMap.set(key, now);
        return true;
      }
      return false;
    };

    const reportError = (message: string, source: string, extra?: Record<string, unknown>) => {
      const key = `${source}:${message.slice(0, 200)}`;
      if (!shouldReport(key)) return;

      errorMonitoring.captureError(new Error(message.slice(0, 500)), {
        source,
        functionName: source,
        userFacing: true,
        route: window.location.pathname,
        metadata: {
          ...extra,
          href: window.location.href,
        },
      }).catch(() => {
        // fail silently
      });
    };

    // ===== 1. Patch toast.error (sonner) =====
    const originalToastError = toast.error.bind(toast);
    toast.error = ((message: unknown, ...args: unknown[]) => {
      const parsed = stringifyToastMessage(message).slice(0, 300);
      reportError(parsed, 'user_panel_toast', { from_toast_error: true });
      return originalToastError(message as any, ...(args as any[]));
    }) as typeof toast.error;

    // ===== 2. Intercept shadcn toasts via custom event + DOM fallback =====
    const handleAppToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ variant?: string; title?: string; description?: string }>;
      const detail = customEvent.detail;
      if (!detail || detail.variant !== 'destructive') return;

      const msg = `${detail.title || ''} ${detail.description || ''}`.trim().slice(0, 300);
      if (msg.length > 3) {
        reportError(msg, 'user_panel_shadcn_toast', { variant: 'destructive', source: 'custom_event' });
      }
    };
    window.addEventListener('app-toast', handleAppToast as EventListener);

    const observer = new MutationObserver(() => {
      const destructiveToasts = document.querySelectorAll('.destructive');
      destructiveToasts.forEach((el) => {
        if (el.getAttribute('data-telegram-reported') === 'true') return;

        el.setAttribute('data-telegram-reported', 'true');
        const msg = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (msg.length > 3) {
          reportError(msg, 'user_panel_shadcn_toast', { variant: 'destructive', source: 'mutation_observer' });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ===== 3. window.onerror — erros JS globais =====
    const previousOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      const msg = error?.message || stringifyToastMessage(message);
      reportError(msg, 'window_onerror', {
        file: source,
        line: lineno,
        col: colno,
      });
      if (typeof previousOnError === 'function') {
        return previousOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // ===== 4. unhandledrejection — promises rejeitadas =====
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error
        ? event.reason.message
        : stringifyToastMessage(event.reason);
      reportError(msg, 'unhandled_promise_rejection');
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // ===== 5. Patch console.error =====
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: any[]) => {
      // Chamar o original primeiro
      originalConsoleError(...args);

      // Não reportar erros das próprias chamadas de monitoramento
      const firstArg = String(args[0] || '');
      if (
        firstArg.includes('[ErrorMonitoring]') ||
        firstArg.includes('telegram') ||
        firstArg.includes('report-error') ||
        firstArg.includes('[useErrorMonitoring]')
      ) {
        return;
      }

      const parts = args.map((a: unknown) => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a)?.slice(0, 100); } catch { return '[object]'; }
      });
      const msg = parts.join(' ').slice(0, 400);
      if (msg.length > 5) {
        reportError(msg, 'console_error');
      }
    };

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('app-toast', handleAppToast as EventListener);
      observer.disconnect();
      toast.error = originalToastError;
      console.error = originalConsoleError;
      window.onerror = previousOnError;
      delete (window as any).__panelToastTelegramPatched;
    };
  }, []);
}
