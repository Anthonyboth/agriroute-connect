import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let refreshInterval: NodeJS.Timeout | null = null;
const REDIRECT_COOLDOWN_KEY = 'last_auth_redirect';
const COOLDOWN_MS = 60000; // 60 segundos
let isInitialized = false;

export function startSessionRefresh() {
  // Prevenir inicialização duplicada
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;
  
  // Verificar sessão a cada 5 minutos
  refreshInterval = setInterval(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.error('[SessionRefresh] ❌ Sessão inválida ou erro ao obter sessão:', error);
        stopSessionRefresh();
        
        // Verificar cooldown para evitar múltiplos redirects
        const lastRedirect = sessionStorage.getItem(REDIRECT_COOLDOWN_KEY);
        const now = Date.now();
        
        if (lastRedirect && now - parseInt(lastRedirect) < COOLDOWN_MS) {
          console.log('[SessionRefresh] ⏸️ Redirect em cooldown, aguardando...');
          return;
        }
        
        sessionStorage.setItem(REDIRECT_COOLDOWN_KEY, now.toString());
        
        toast.error('Sessão perdida. Redirecionando para login...', {
          duration: 3000,
        });
        
        // Redirect para login após 3s
        setTimeout(() => {
          window.location.href = '/auth';
        }, 3000);
        
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
}

export function stopSessionRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isInitialized = false;
  }
  
  // ✅ Limpar qualquer estado remanescente
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('device_reg_'));
    if (keys.length > 0 && !localStorage.getItem('sb-shnvtxejjecbnztdbbbl-auth-token')) {
      // Só limpar se não houver sessão ativa
      keys.forEach(k => localStorage.removeItem(k));
    }
  } catch {}
}
