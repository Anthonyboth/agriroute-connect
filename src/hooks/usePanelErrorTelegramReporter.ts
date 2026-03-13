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

    // ===== RATE LIMITER: Máximo 5 erros por minuto para evitar flooding =====
    const recentErrors: number[] = [];
    const RATE_LIMIT = 5;
    const RATE_WINDOW_MS = 60_000; // 1 minuto
    const recentMessages = new Set<string>(); // Deduplicação por mensagem

    const isRateLimited = (msg: string): boolean => {
      const now = Date.now();
      // Limpar erros antigos
      while (recentErrors.length > 0 && recentErrors[0] < now - RATE_WINDOW_MS) {
        recentErrors.shift();
      }
      // Checar rate limit
      if (recentErrors.length >= RATE_LIMIT) return true;
      // Deduplicar mensagem idêntica (mesma string nos últimos 30s)
      const msgKey = msg.slice(0, 100);
      if (recentMessages.has(msgKey)) return true;
      recentMessages.add(msgKey);
      setTimeout(() => recentMessages.delete(msgKey), 30_000);
      recentErrors.push(now);
      return false;
    };

    // Mensagens que são comportamento esperado do React/browser e NÃO devem ir pro Telegram
    const IGNORED_PATTERNS = [
      'signal is aborted without reason',
      'The operation was aborted',
      'AbortError',
      'aborted',
      'ResizeObserver loop',
      'ResizeObserver loop completed with undelivered notifications',
      'Load failed',
      'Failed to fetch',
      'NetworkError',
      'Refresh Token Not Found',
      'refresh_token_not_found',
      'Invalid Refresh Token',
      'cannot be a descendant of',
      'cannot contain a nested',
      'hydration error',
      'Encountered two children with the same key',
      'Non-unique keys may cause children',
      'senha incorretos',
      'Invalid login credentials',
      'invalid_credentials',
      // Capacitor GPS native errors — handled by app, not bugs
      'OS-PLUG-GLOC',
      'Location services are not enabled',
      'location permission',
      'location services',
      // FRT-045: Form validation messages are NOT errors
      'Erro de validação',
      'Por favor, envie',
      'Por favor, corrija',
      // Camera warmup messages — transient UX, not real errors
      'camera_warming_up',
      'A câmera ainda não está pronta',
      'Inicializando câmera',
      // FRT-066: APK desatualizado — erros de permissão de manifest não são bugs
      'Missing the following permissions',
      'AndroidManifest',
      'Permissão de localização negada',
      // FRT-067: Capacitor plugins não registrados (APK desatualizado ou cap sync pendente)
      'plugin is not implemented',
      // FRT-068: SplashScreen plugin ausente em builds nativos dessincronizados (ruído esperado)
      'erro ao ocultar splash',
      '"splashscreen" plugin is not implemented on android',
    ];

    const shouldIgnore = (msg: string): boolean => {
      const lower = msg.toLowerCase();
      return IGNORED_PATTERNS.some(p => lower.includes(p.toLowerCase()));
    };

    const reportError = (message: string, source: string, extra?: Record<string, unknown>) => {
      if (shouldIgnore(message)) return;
      if (isRateLimited(message)) return;

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
      // ✅ Ignorar AbortError no nível do evento também
      if (event.error?.name === 'AbortError') return;
      // ✅ Ignorar cross-origin script errors (Android/iOS reportam "Script error." ou msg vazia)
      if (!event.error && (!event.message || event.message === 'Script error.' || event.message === 'Script error')) return;
      const msg = event.error?.message || stringifyToastMessage(event.message);
      // ✅ Ignorar "Erro desconhecido" genérico (cross-origin sem info útil)
      if (msg === 'Erro desconhecido') return;
      reportError(msg, 'window_error_event', {
        file: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    };
    window.addEventListener('error', handleWindowErrorEvent, true);

    // ===== 5. unhandledrejection — promises rejeitadas =====
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      // ✅ Silenciar AbortError completamente (cleanup normal de useEffect/MapLibre)
      if (
        reason instanceof DOMException && reason.name === 'AbortError' ||
        (reason instanceof Error && (reason.name === 'AbortError' || reason.message?.includes('aborted')))
      ) {
        event.preventDefault(); // Impedir que escape para outros handlers
        return;
      }
      const msg = reason instanceof Error
        ? reason.message
        : stringifyToastMessage(reason);
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
        firstArg.includes('hot update') ||
        firstArg.toLowerCase().includes('wake_lock') ||
        firstArg.toLowerCase().includes('foregroundservice')
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
