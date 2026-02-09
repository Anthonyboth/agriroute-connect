import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook global reutilizável para verificar se o usuário está autenticado
 * e possui perfil completo no sistema.
 * 
 * USO: Em qualquer componente que precise diferenciar usuário logado de visitante.
 * - `isAuthenticated`: tem sessão ativa
 * - `hasProfile`: tem perfil com nome preenchido
 * - `isLoggedInWithProfile`: ambos (atalho)
 * - `isGuest`: sem sessão ou sem perfil
 */
export function useAuthenticatedUser() {
  const { profile, user, loading } = useAuth();

  const result = useMemo(() => {
    const isAuthenticated = !!user?.id;
    const hasProfile = !!(profile?.id && profile?.full_name);
    const isLoggedInWithProfile = isAuthenticated && hasProfile;
    const isGuest = !isAuthenticated || !hasProfile;

    return {
      isAuthenticated,
      hasProfile,
      isLoggedInWithProfile,
      isGuest,
      profile,
      user,
      loading,
    };
  }, [user?.id, profile?.id, profile?.full_name, loading]);

  return result;
}
