import { supabase } from '@/integrations/supabase/client';

let refreshInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Inicia o refresh de sessão silencioso
 * NUNCA faz logout automático - apenas renova token quando necessário
 * O usuário só sai quando clica em "Sair"
 */
export function startSessionRefresh() {
  // Prevenir inicialização duplicada
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;
  
  // Verificar sessão a cada 30 minutos (aumentado de 5 para evitar checks excessivos)
  refreshInterval = setInterval(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Se não há sessão ou erro, apenas logar - NÃO fazer logout automático
      if (error || !session) {
        console.log('[SessionRefresh] Sessão não encontrada, aguardando ação do usuário');
        return;
      }
      
      // Renovar sessão se estiver próxima de expirar (< 30 minutos)
      const expiresIn = (session.expires_at || 0) - Math.floor(Date.now() / 1000);
      
      if (expiresIn < 1800) { // 30 minutos
        console.log('[SessionRefresh] Renovando sessão silenciosamente...');
        
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.warn('[SessionRefresh] Erro ao renovar (silencioso):', refreshError.message);
          // NÃO fazer redirect - deixar usuário continuar usando
        } else {
          console.log('[SessionRefresh] ✅ Sessão renovada com sucesso');
        }
      }
      
    } catch (err) {
      console.warn('[SessionRefresh] Erro (silencioso):', err);
      // NÃO fazer redirect - deixar usuário continuar usando
    }
  }, 30 * 60 * 1000); // A cada 30 minutos
}

export function stopSessionRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isInitialized = false;
  }
}
