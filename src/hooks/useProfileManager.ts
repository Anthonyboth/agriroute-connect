/**
 * src/hooks/useProfileManager.ts
 *
 * Hook centralizado para gerenciamento de perfis do usuário logado.
 * Responsabilidades:
 * - Garantir que o usuário só acesse seus próprios perfis
 * - Detectar e gerenciar perfis duplicados
 * - Controlar acesso a painéis baseado em role + status de aprovação
 * - Fornecer helpers para redirecionamento por role
 * - Prevenir acesso a perfis de terceiros
 *
 * Este hook NÃO substitui useAuth – ele complementa,
 * consumindo dados do AuthContext e adicionando lógica de negócio.
 */

import { useMemo, useCallback } from 'react';
import { useAuth, type UserProfile } from './useAuth';
import { getDashboardByRole, type ValidRole, VALID_ROLES } from '@/lib/auth-utils';

// ── Tipos ──────────────────────────────────────────────────────────────────

export type PanelAccess = 'full' | 'pending' | 'rejected' | 'none';

export interface ProfileAccessInfo {
  /** Perfil ativo do usuário logado */
  profile: UserProfile | null;
  /** Todos os perfis do usuário logado */
  profiles: UserProfile[];
  /** Se o usuário está autenticado */
  isAuthenticated: boolean;
  /** Se o loading inicial ainda está ativo */
  loading: boolean;
  /** Se o perfil ativo foi aprovado */
  isApproved: boolean;
  /** Se o usuário é admin */
  isAdmin: boolean;
  /** Se o usuário possui múltiplos perfis */
  hasMultipleProfiles: boolean;
  /** Nível de acesso ao painel atual */
  panelAccess: PanelAccess;
  /** Rota correta do dashboard para o perfil ativo */
  dashboardRoute: string;
  /** Roles que o usuário pode adicionar (sem duplicar) */
  availableRoles: ValidRole[];
  /** Se existe duplicação de role detectada */
  hasDuplicateRoles: boolean;
  /** Roles duplicados encontrados */
  duplicateRoles: string[];
}

export interface ProfileManagerActions {
  /** Trocar para outro perfil do mesmo usuário */
  switchProfile: (profileId: string) => void;
  /** Verificar se um profileId pertence ao usuário logado */
  isOwnProfile: (profileId: string) => boolean;
  /** Verificar se o usuário pode acessar um painel específico */
  canAccessPanel: (role: string) => boolean;
  /** Obter a rota do dashboard para um role específico */
  getDashboardForRole: (role: string) => string;
  /** Forçar revalidação do perfil no banco */
  refreshProfile: () => Promise<void>;
  /** Deslogar */
  signOut: () => Promise<void>;
  /** Verificar se possui um role específico */
  hasRole: (role: string) => boolean;
  /** Verificar se possui pelo menos um dos roles */
  hasAnyRole: (roles: string[]) => boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useProfileManager(): ProfileAccessInfo & ProfileManagerActions {
  const {
    user,
    profile,
    profiles,
    loading,
    isAuthenticated,
    isApproved,
    isAdmin,
    hasMultipleProfiles,
    switchProfile,
    refreshProfile,
    signOut,
    hasRole,
    hasAnyRole,
  } = useAuth();

  // ── Detecção de roles duplicados ──────────────────────────────────────

  const { hasDuplicateRoles, duplicateRoles } = useMemo(() => {
    if (!profiles || profiles.length <= 1) {
      return { hasDuplicateRoles: false, duplicateRoles: [] as string[] };
    }

    const roleCount = new Map<string, number>();
    for (const p of profiles) {
      const role = p.role || p.active_mode || '';
      if (role) {
        roleCount.set(role, (roleCount.get(role) || 0) + 1);
      }
    }

    const dupes: string[] = [];
    roleCount.forEach((count, role) => {
      if (count > 1) dupes.push(role);
    });

    return { hasDuplicateRoles: dupes.length > 0, duplicateRoles: dupes };
  }, [profiles]);

  // ── Roles disponíveis para adição (sem duplicar) ──────────────────────

  const availableRoles = useMemo<ValidRole[]>(() => {
    const existingRoles = new Set(
      profiles.map(p => (p.role || p.active_mode || '') as string)
    );
    // ADMIN não pode ser auto-adicionado
    return VALID_ROLES.filter(
      r => r !== 'ADMIN' && !existingRoles.has(r)
    ) as ValidRole[];
  }, [profiles]);

  // ── Nível de acesso ao painel ─────────────────────────────────────────

  const panelAccess = useMemo<PanelAccess>(() => {
    if (!isAuthenticated || !profile) return 'none';
    if (profile.status === 'REJECTED') return 'rejected';
    if (profile.status === 'APPROVED' || isApproved) return 'full';
    return 'pending';
  }, [isAuthenticated, profile, isApproved]);

  // ── Rota do dashboard ─────────────────────────────────────────────────

  const dashboardRoute = useMemo(() => {
    if (!profile) return '/';
    const role = profile.role || profile.active_mode || '';
    return getDashboardByRole(role);
  }, [profile]);

  // ── Verificar se profileId pertence ao usuário logado ─────────────────

  const isOwnProfile = useCallback(
    (profileId: string): boolean => {
      if (!user || !profiles.length) return false;
      return profiles.some(p => p.id === profileId);
    },
    [user, profiles]
  );

  // ── Verificar acesso a painel por role ────────────────────────────────

  const canAccessPanel = useCallback(
    (role: string): boolean => {
      if (!isAuthenticated || !profile) return false;
      if (isAdmin) return true; // Admin acessa tudo

      // Verificar se possui o role necessário
      const currentRole = profile.role || profile.active_mode || '';
      if (currentRole === role) return panelAccess === 'full';

      // Verificar se tem perfil adicional com esse role
      const matchingProfile = profiles.find(
        p => (p.role || p.active_mode) === role
      );
      if (matchingProfile) {
        return matchingProfile.status === 'APPROVED';
      }

      return false;
    },
    [isAuthenticated, profile, profiles, isAdmin, panelAccess]
  );

  // ── getDashboardForRole (wrapper) ─────────────────────────────────────

  const getDashboardForRole = useCallback(
    (role: string): string => getDashboardByRole(role),
    []
  );

  return {
    // Info
    profile,
    profiles,
    isAuthenticated,
    loading,
    isApproved,
    isAdmin,
    hasMultipleProfiles,
    panelAccess,
    dashboardRoute,
    availableRoles,
    hasDuplicateRoles,
    duplicateRoles,
    // Actions
    switchProfile,
    isOwnProfile,
    canAccessPanel,
    getDashboardForRole,
    refreshProfile,
    signOut,
    hasRole,
    hasAnyRole,
  };
}
