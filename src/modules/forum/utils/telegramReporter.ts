/**
 * Centralized Telegram error reporter for the Forum module.
 * All forum operations route their errors through here.
 */
import { supabase } from '@/integrations/supabase/client';

interface ForumTelegramReport {
  title: string;
  message: string;
  source: string;
  severity?: 'error' | 'warn' | 'info';
  metadata?: Record<string, unknown>;
}

export async function reportForumErrorToTelegram(report: ForumTelegramReport): Promise<void> {
  try {
    await supabase.functions.invoke('send-telegram-alert', {
      body: {
        type: 'forum_error',
        title: report.title,
        message: report.message,
        severity: report.severity || 'error',
        source: report.source,
        metadata: report.metadata,
      },
    });
  } catch (err) {
    // Never let the reporter itself crash the app
    console.debug('[Forum] Telegram report failed silently:', err);
  }
}

/**
 * Wraps a forum mutation's onError to auto-report to Telegram.
 */
export function forumErrorHandler(source: string, friendlyTitle: string) {
  return (error: any) => {
    console.error(`[Forum] ${source} error:`, error);
    reportForumErrorToTelegram({
      title: `🔴 Erro no Fórum - ${friendlyTitle}`,
      message: `**Erro**: ${error?.message || 'Desconhecido'}\n**Fonte**: ${source}`,
      source,
    });
  };
}
