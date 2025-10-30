export interface CachedProfile {
  data: any;
  timestamp: number;
}

const CACHE_KEY = 'cached_user_profile';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

export function getCachedProfile(userId: string): any | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;
    
    const parsed: CachedProfile = JSON.parse(cached);
    
    // Verificar se ainda está válido
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      if (import.meta.env.DEV) {
        console.log('[ProfileCache] ✅ Retornando perfil do cache');
      }
      return parsed.data;
    }
    
    // Cache expirado
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
    return null;
  } catch (error) {
    console.error('[ProfileCache] Erro ao ler cache:', error);
    return null;
  }
}

export function setCachedProfile(userId: string, profile: any): void {
  try {
    const cached: CachedProfile = {
      data: profile,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(cached));
    if (import.meta.env.DEV) {
      console.log('[ProfileCache] ✅ Perfil salvo no cache');
    }
  } catch (error) {
    console.error('[ProfileCache] Erro ao salvar cache:', error);
  }
}

export function clearCachedProfile(userId: string): void {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
  } catch (error) {
    console.error('[ProfileCache] Erro ao limpar cache:', error);
  }
}
