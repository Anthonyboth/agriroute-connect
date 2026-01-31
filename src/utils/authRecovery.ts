import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PATTERNS = [
  'refresh_token_not_found',
  'invalid refresh token',
  'invalid refresh token: refresh token not found',
  'jwt expired',
  'token revoked',
  'invalid credentials'
];

export function isRefreshTokenInvalidError(error: any): boolean {
  if (!error) return false;
  const code = String((error.code || error.error_code || '')).toLowerCase();
  const message = String((error.message || error.error_description || '')).toLowerCase();
  return PATTERNS.some((p) => code.includes(p) || message.includes(p));
}

export function clearSupabaseAuthStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch {}
  } catch {}
}

export async function forceLogoutAndRedirect(redirectTo: string = '/auth') {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {}
  clearSupabaseAuthStorage();
  // ❌ REMOVIDO: toast.error('Sua sessão expirou.') - logout silencioso
  window.location.href = redirectTo;
}

export async function handleAuthError(error: any, redirectTo: string = '/') {
  if (isRefreshTokenInvalidError(error)) {
    await forceLogoutAndRedirect(redirectTo);
    return true;
  }
  return false;
}

export async function ensureAuthBeforeAction(actionName: string): Promise<boolean> {
  try {
    const path = window.location.pathname;
    const isPublicOrPreAuthRoute =
      path === '/' ||
      path.startsWith('/sobre') ||
      path.startsWith('/ajuda') ||
      path.startsWith('/cadastro-motorista') ||
      path.startsWith('/cadastro-motorista-afiliado');

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn(`[Auth] ${actionName}: Sessão inválida, tentando refresh...`);
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        // ✅ Não force redirect em rotas públicas/pré-auth (cadastro por link, landing pages)
        if (isPublicOrPreAuthRoute) {
          toast.error('Você precisa estar logado para continuar.');
          return false;
        }

        toast.error('Sessão expirada. Faça login novamente.');
        setTimeout(() => {
          localStorage.setItem('redirect_after_login', window.location.pathname);
          window.location.href = '/auth';
        }, 1500);
        
        return false;
      }
      
      console.log(`[Auth] ${actionName}: Sessão renovada`);
      return true;
    }
    
    return true;
    
  } catch (err) {
    console.error(`[Auth] ${actionName}: Erro ao verificar sessão`, err);
    return false;
  }
}
