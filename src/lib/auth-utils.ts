/**
 * Utilitários centralizados de autenticação
 * Contém lógica de redirecionamento por role e parse de query params
 */

// Valid roles for signup/login
export const VALID_ROLES = [
  'ADMIN',
  'PRODUTOR',
  'MOTORISTA',
  'MOTORISTA_AFILIADO',
  'PRESTADOR_SERVICOS',
  'TRANSPORTADORA',
] as const;

export type ValidRole = typeof VALID_ROLES[number];

// Mapeamento único de role -> dashboard
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  'ADMIN': '/admin',
  'PRODUTOR': '/dashboard/producer',
  'MOTORISTA': '/dashboard/driver',
  'MOTORISTA_AFILIADO': '/dashboard/driver',
  'PRESTADOR_SERVICOS': '/dashboard/service-provider',
  'TRANSPORTADORA': '/dashboard/company',
};

/**
 * Retorna a rota do dashboard correta para o role especificado
 */
export function getDashboardByRole(role: string): string {
  return ROLE_DASHBOARD_MAP[role] || '/';
}

/**
 * Verifica se um role é válido
 */
export function isValidRole(role: string): role is ValidRole {
  return VALID_ROLES.includes(role as ValidRole);
}

/**
 * Retorna todos os roles válidos
 */
export function getValidRoles(): readonly string[] {
  return VALID_ROLES;
}

/**
 * Parse and normalize role from URL query param
 */
export function parseRoleFromUrl(roleParam: string | null): ValidRole | null {
  if (!roleParam) return null;
  const normalizedRole = roleParam.toUpperCase();
  if (isValidRole(normalizedRole)) {
    return normalizedRole;
  }
  return null;
}

/**
 * Parse mode (login/signup) from URL query params
 * Supports both 'mode' and legacy 'tab' parameter for backward compatibility
 */
export function parseModeFromUrl(searchParams: URLSearchParams): 'login' | 'signup' {
  const mode = searchParams.get('mode');
  const tab = searchParams.get('tab');
  
  // 'mode' takes priority, then 'tab'
  if (mode === 'signup' || tab === 'signup' || tab === 'register') {
    return 'signup';
  }
  return 'login';
}

/**
 * Store pending signup role in sessionStorage
 */
export function setPendingSignupRole(role: ValidRole): void {
  sessionStorage.setItem('pending_signup_role', role);
}

/**
 * Get pending signup role from sessionStorage
 */
export function getPendingSignupRole(): ValidRole | null {
  const role = sessionStorage.getItem('pending_signup_role');
  if (role && isValidRole(role)) {
    return role;
  }
  return null;
}

/**
 * Clear pending signup role from sessionStorage
 */
export function clearPendingSignupRole(): void {
  sessionStorage.removeItem('pending_signup_role');
}

/**
 * Build auth URL with proper query params
 */
export function buildAuthUrl(mode: 'login' | 'signup', role?: ValidRole): string {
  const params = new URLSearchParams();
  params.set('mode', mode);
  if (role && mode === 'signup') {
    params.set('role', role);
  }
  return `/auth?${params.toString()}`;
}
