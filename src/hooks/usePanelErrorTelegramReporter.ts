import { useEffect } from 'react';
import { toast } from 'sonner';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';


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

    // Mensagens que são comportamento esperado do React/browser e NÃO devem ir pro Telegram
    const IGNORED_PATTERNS = [
      'signal is aborted without reason',
      'The operation was aborted',
      'AbortError',
      'aborted',
      'ResizeObserver loop',
      'ResizeObserver loop completed with undelivered notifications',
      'Load failed',          // Safari fetch cancel
      'Failed to fetch',      // offline/unmount
      'NetworkError',
      'Refresh Token Not Found',  // Sessão expirada - ciclo normal de auth
      'refresh_token_not_found',  // Mesmo erro via código
      'Invalid Refresh Token',    // Token revogado/expirado
    ];

    const shouldIgnore = (msg: string): boolean => {
      const lower = msg.toLowerCase();
      return IGNORED_PATTERNS.some(p => lower.includes(p.toLowerCase()));
    };

    const reportError = (message: string, source: string, extra?: Record<string, unknown>) => {
      if (shouldIgnore(message)) return;

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

    // ===== 4. window error event listener (captura adicional global) =====
    const handleWindowErrorEvent = (event: ErrorEvent) => {
      const msg = event.error?.message || stringifyToastMessage(event.message);
      reportError(msg, 'window_error_event', {
        file: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    };
    window.addEventListener('error', handleWindowErrorEvent, true);

    // ===== 5. unhandledrejection — promises rejeitadas =====
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
        firstArg.includes('[useErrorMonitoring]') ||
        firstArg.includes('[hmr]') ||
        firstArg.includes('[vite]') ||
        firstArg.includes('hot update')
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
      window.removeEventListener('error', handleWindowErrorEvent, true);
      window.removeEventListener('app-toast', handleAppToast as EventListener);
      observer.disconnect();
      toast.error = originalToastError;
      console.error = originalConsoleError;
      window.onerror = previousOnError;
      delete (window as any).__panelToastTelegramPatched;
    };
  }, []);
}
