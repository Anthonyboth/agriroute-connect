/**
 * RequirePanel — Wrapper declarativo de proteção de painel
 *
 * Envolve páginas de dashboard e garante que:
 * 1. Auth esteja resolvido antes de renderizar
 * 2. O usuário pertença ao painel correto
 *
 * Camada 2 de segurança (após ProtectedRoute).
 *
 * Uso:
 *   <RequirePanel panel="DRIVER">
 *     <DriverDashboard />
 *   </RequirePanel>
 */

import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLoader } from '@/components/AppLoader';
import { useAuth } from '@/hooks/useAuth';
import {
  CanonicalPanel,
  resolveCanonicalAccess,
  getDefaultRouteForProfile,
} from '@/security/panelAccessGuard';

interface RequirePanelProps {
  panel: CanonicalPanel;
  children: React.ReactNode;
}

export function RequirePanel({ panel, children }: RequirePanelProps) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  // Aguardar auth resolver
  if (loading) {
    return <DashboardLoader message="Verificando acesso..." />;
  }

  // Sem sessão → login
  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  const access = resolveCanonicalAccess(profile);

  // Role não reconhecido ou painel errado
  if (!access || access.panel !== panel) {
    const correctRoute = getDefaultRouteForProfile(profile);

    if (import.meta.env.DEV) {
      console.warn(
        `[RequirePanel] 🚫 Painel "${panel}" bloqueado para role "${profile.role}" → redirecionando para ${correctRoute}`
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-bold text-foreground">Acesso não permitido</h2>
          <p className="text-muted-foreground text-sm">
            Você não tem permissão para acessar este painel.
          </p>
          <Button
            onClick={() => navigate(correctRoute, { replace: true })}
            className="w-full"
          >
            Ir para meu painel
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
