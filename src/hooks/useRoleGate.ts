/**
 * useRoleGate — Hook de proteção ativa de rota por role
 *
 * Roda em cada troca de rota e redireciona imediatamente se o usuário
 * tentar acessar um painel que não pertence ao seu role.
 *
 * Camada 3 de segurança (após ProtectedRoute e RequirePanel).
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  isRouteAllowedForProfile,
  getDefaultRouteForProfile,
} from '@/security/panelAccessGuard';

export function useRoleGate() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Aguardar auth resolver antes de agir
    if (loading || !profile) return;

    const pathname = location.pathname;

    // Só age em rotas de painel
    const isDashboardPath =
      pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
    if (!isDashboardPath) return;

    if (!isRouteAllowedForProfile(pathname, profile)) {
      const correctRoute = getDefaultRouteForProfile(profile);

      if (import.meta.env.DEV) {
        console.warn(
          `[RoleGate] 🚫 Rota bloqueada: ${pathname} (role: ${profile.role}) → redirecionando para ${correctRoute}`
        );
      }

      navigate(correctRoute, { replace: true });
    }
  }, [location.pathname, profile, loading, navigate]);

  return {
    isAllowed: isRouteAllowedForProfile(location.pathname, profile),
    defaultRoute: getDefaultRouteForProfile(profile),
  };
}
