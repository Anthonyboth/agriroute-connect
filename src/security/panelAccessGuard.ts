/**
 * panelAccessGuard — Fonte única de verdade para role → painel → rotas permitidas
 *
 * REGRA CENTRAL:
 * - `profile.role` é o campo canônico que define o painel do usuário
 * - `active_mode` NÃO define o painel de entrada; só é usado em funcionalidades internas
 *   (ex.: motorista que também gerencia transportadora no mesmo perfil)
 */

// Tipo de profile mínimo necessário para resolver acesso
export interface ProfileForGate {
  role: string;
  id?: string;
}

export type CanonicalPanel = 'PRODUCER' | 'DRIVER' | 'CARRIER' | 'SERVICE_PROVIDER' | 'ADMIN';

export interface PanelAccess {
  panel: CanonicalPanel;
  /** Prefixos de rota permitidos para este painel */
  allowedPaths: string[];
  /** Rota de entrada padrão */
  defaultRoute: string;
}

/**
 * Mapa role → acesso de painel
 * ÚNICA fonte de verdade — não duplicar em App.tsx, useResilientLogin, auth-utils, etc.
 */
const ROLE_PANEL_MAP: Record<string, PanelAccess> = {
  PRODUTOR: {
    panel: 'PRODUCER',
    allowedPaths: ['/dashboard/producer'],
    defaultRoute: '/dashboard/producer',
  },
  MOTORISTA: {
    panel: 'DRIVER',
    allowedPaths: ['/dashboard/driver'],
    defaultRoute: '/dashboard/driver',
  },
  MOTORISTA_AFILIADO: {
    panel: 'DRIVER',
    allowedPaths: ['/dashboard/driver'],
    defaultRoute: '/dashboard/driver',
  },
  TRANSPORTADORA: {
    panel: 'CARRIER',
    allowedPaths: ['/dashboard/company'],
    defaultRoute: '/dashboard/company',
  },
  PRESTADOR_SERVICOS: {
    panel: 'SERVICE_PROVIDER',
    allowedPaths: ['/dashboard/service-provider'],
    defaultRoute: '/dashboard/service-provider',
  },
  ADMIN: {
    panel: 'ADMIN',
    allowedPaths: ['/admin', '/dashboard'],
    defaultRoute: '/admin',
  },
};

/**
 * Rotas acessíveis por qualquer usuário autenticado (independente do role)
 */
export const SHARED_AUTHENTICATED_PATHS = [
  '/complete-profile',
  '/plans',
  '/nfe-dashboard',
  '/cadastro-transportadora',
  '/company-invite',
  '/cadastro-afiliado',
  '/payment',
  '/service-payment',
];

/**
 * Resolve o acesso canônico de painel para um perfil.
 * Retorna null se o role não for reconhecido.
 *
 * ⚠️ SEMPRE usa profile.role — nunca active_mode.
 */
export function resolveCanonicalAccess(profile: ProfileForGate | null | undefined): PanelAccess | null {
  if (!profile?.role) return null;
  return ROLE_PANEL_MAP[profile.role] ?? null;
}

/**
 * Verifica se uma rota é permitida para o perfil.
 */
export function isRouteAllowedForProfile(
  pathname: string,
  profile: ProfileForGate | null | undefined
): boolean {
  if (!profile) return false;

  // Rotas compartilhadas: qualquer autenticado pode acessar
  if (SHARED_AUTHENTICATED_PATHS.some((p) => pathname.startsWith(p))) return true;

  const access = resolveCanonicalAccess(profile);
  if (!access) return false;

  return access.allowedPaths.some((p) => pathname.startsWith(p));
}

/**
 * Retorna a rota padrão (home do painel) para um perfil.
 * Fallback para '/' se o role não for reconhecido.
 */
export function getDefaultRouteForProfile(
  profile: ProfileForGate | null | undefined
): string {
  const access = resolveCanonicalAccess(profile);
  return access?.defaultRoute ?? '/';
}

/**
 * Retorna o painel canônico para um perfil.
 */
export function getPanelForProfile(
  profile: ProfileForGate | null | undefined
): CanonicalPanel | null {
  return resolveCanonicalAccess(profile)?.panel ?? null;
}
