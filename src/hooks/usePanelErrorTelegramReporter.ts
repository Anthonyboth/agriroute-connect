import { useEffect } from 'react';
import { toast } from 'sonner';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

const TOAST_THROTTLE_MS = 45_000;

const stringifyToastMessage = (message: unknown): string => {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  if (message == null) return 'Erro desconhecido (toast.error)';
  try {
    return String(message);
  } catch {
    return 'Erro desconhecido (toast.error)';
  }
};

/**
 * Captura notificações visíveis de erro (toast.error) nos painéis e reporta ao Telegram.
 * Mantém o comportamento original do toast e aplica throttle para evitar spam.
 */
export function usePanelErrorTelegramReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__panelToastTelegramPatched) return;

    (window as any).__panelToastTelegramPatched = true;

    const errorMonitoring = ErrorMonitoringService.getInstance();
    const originalToastError = toast.error.bind(toast);
    const throttleMap = new Map<string, number>();

    toast.error = ((message: unknown, ...args: unknown[]) => {
      const now = Date.now();
      const parsedMessage = stringifyToastMessage(message).slice(0, 300);
      const key = `panel_toast_error:${parsedMessage}`;
      const lastSentAt = throttleMap.get(key) ?? 0;

      if (now - lastSentAt >= TOAST_THROTTLE_MS) {
        throttleMap.set(key, now);

        errorMonitoring.captureError(new Error(parsedMessage), {
          source: 'user_panel_toast',
          functionName: 'toast.error',
          userFacing: true,
          route: window.location.pathname,
          metadata: {
            from_toast_error: true,
            href: window.location.href,
          },
        }).catch(() => {
          // fail silently to avoid breaking user flow
        });
      }

      return originalToastError(message as any, ...(args as any[]));
    }) as typeof toast.error;
  }, []);
}
