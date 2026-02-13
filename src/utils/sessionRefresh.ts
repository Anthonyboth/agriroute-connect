import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/devLogger';

let refreshInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Inicia o refresh de sessão silencioso
 * NUNCA faz logout automático - apenas renova token quando necessário
 */
export function startSessionRefresh() {
  if (isInitialized) return;
  isInitialized = true;
  
  refreshInterval = setInterval(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        devLog('[SessionRefresh] Sessão não encontrada, aguardando ação do usuário');
        return;
      }
      const expiresIn = (session.expires_at || 0) - Math.floor(Date.now() / 1000);
      if (expiresIn < 1800) {
        devLog('[SessionRefresh] Renovando sessão silenciosamente...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[SessionRefresh] Erro ao renovar (silencioso):', refreshError.message);
        } else {
          devLog('[SessionRefresh] ✅ Sessão renovada com sucesso');
        }
      }
    } catch (err) {
      console.warn('[SessionRefresh] Erro (silencioso):', err);
    }
  }, 30 * 60 * 1000);
}

export function stopSessionRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isInitialized = false;
  }
}
