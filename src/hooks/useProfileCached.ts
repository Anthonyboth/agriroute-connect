/**
 * src/hooks/useProfileCached.ts
 *
 * Hook centralizado para perfis de OUTROS usuários (não o usuário logado).
 * O perfil do usuário logado é gerenciado pelo AuthContext (useAuth).
 *
 * Regras:
 * - Cache global via useSmartQuery com TTL de 30 min
 * - Deduplicação automática (5 componentes pedindo o mesmo profile = 1 request)
 * - refetch(force=true) apenas quando necessário (ex: após update de perfil)
 * - NÃO faz polling
 */

import { useSmartQuery, invalidateSmartCache } from './useSmartQuery';
import { supabase } from '@/integrations/supabase/client';

const PROFILE_TTL_MS = 30 * 60 * 1000; // 30 minutos

export interface CachedProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  contact_phone?: string;
  role?: string;
  active_mode?: string;
  selfie_url?: string;
  rating?: number;
  base_city_name?: string;
  base_state?: string;
  current_city_name?: string;
  current_state?: string;
  service_types?: string[];
  cpf_cnpj?: string;
  rntrc?: string;
  status?: string;
}

/**
 * Busca o perfil de um usuário pelo profile ID (profiles.id).
 * Usa cache global de 30min com deduplicação.
 */
export function useProfileCached(profileId: string | null | undefined) {
  const key = profileId ? `profile:${profileId}` : '';

  const result = useSmartQuery<CachedProfile | null>({
    key,
    fetcher: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, full_name, role,
          active_mode, selfie_url, rating, base_city_name, base_state,
          current_city_name, current_state, service_types, status
        `)
        .eq('id', profileId)
        .maybeSingle();

      if (error) throw error;
      return data as CachedProfile | null;
    },
    ttlMs: PROFILE_TTL_MS,
    enabled: !!profileId,
    refetchOnFocus: false, // Perfis de terceiros não precisam atualizar no focus
    refetchOnReconnect: true,
    refetchOnMount: 'stale',
  });

  return {
    profile: result.data,
    loading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    isRefreshing: result.isRefreshing,
  };
}

/**
 * Busca o perfil de um usuário pelo user_id (auth.users.id).
 * Usado quando temos apenas o user_id (ex: contextos de autenticação).
 */
export function useProfileCachedByUserId(userId: string | null | undefined) {
  const key = userId ? `profile-by-uid:${userId}` : '';

  const result = useSmartQuery<CachedProfile | null>({
    key,
    fetcher: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, full_name, role,
          active_mode, selfie_url, rating, base_city_name, base_state,
          current_city_name, current_state, service_types, status
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as CachedProfile | null;
    },
    ttlMs: PROFILE_TTL_MS,
    enabled: !!userId,
    refetchOnFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: 'stale',
  });

  return {
    profile: result.data,
    loading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    isRefreshing: result.isRefreshing,
  };
}

/**
 * Invalida o cache de um perfil específico.
 * Chamar após atualizar dados do perfil.
 */
export function invalidateProfileCache(profileId: string): void {
  invalidateSmartCache(`profile:${profileId}`);
}

/**
 * Invalida o cache de perfil por user_id.
 */
export function invalidateProfileCacheByUserId(userId: string): void {
  invalidateSmartCache(`profile-by-uid:${userId}`);
}
