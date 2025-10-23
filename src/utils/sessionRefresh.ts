import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let refreshInterval: NodeJS.Timeout | null = null;

export function startSessionRefresh() {
  // Verificar sessão a cada 5 minutos
  refreshInterval = setInterval(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.warn('[SessionRefresh] Sessão não encontrada');
        stopSessionRefresh();
        
        toast.error('Sua sessão expirou', {
          description: 'Redirecionando para login...'
        });
        
        setTimeout(() => {
          localStorage.setItem('redirect_after_login', window.location.pathname);
          window.location.href = '/auth';
        }, 2000);
        
        return;
      }
      
      // Renovar sessão se estiver próxima de expirar (< 10 minutos)
      const expiresIn = (session.expires_at || 0) - Math.floor(Date.now() / 1000);
      
      if (expiresIn < 600) { // 10 minutos
        console.log('[SessionRefresh] Renovando sessão preventivamente...');
        
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[SessionRefresh] Erro ao renovar:', refreshError);
          stopSessionRefresh();
          window.location.href = '/auth';
        } else {
          console.log('[SessionRefresh] Sessão renovada com sucesso');
        }
      }
      
    } catch (err) {
      console.error('[SessionRefresh] Erro crítico:', err);
    }
  }, 5 * 60 * 1000); // A cada 5 minutos
  
  console.log('[SessionRefresh] Sistema de refresh iniciado');
}

export function stopSessionRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[SessionRefresh] Sistema de refresh parado');
  }
}
