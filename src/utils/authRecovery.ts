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

export async function forceLogoutAndRedirect(redirectTo: string = '/') {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {}
  clearSupabaseAuthStorage();
  try { toast.error('Sua sessão expirou. Faça login novamente.'); } catch {}
  window.location.href = redirectTo;
}

export async function handleAuthError(error: any, redirectTo: string = '/') {
  if (isRefreshTokenInvalidError(error)) {
    await forceLogoutAndRedirect(redirectTo);
    return true;
  }
  return false;
}
