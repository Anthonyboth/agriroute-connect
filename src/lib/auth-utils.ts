/**
 * Utilitários centralizados de autenticação
 * Contém lógica de redirecionamento por role
 */

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
export function isValidRole(role: string): boolean {
  return role in ROLE_DASHBOARD_MAP;
}

/**
 * Retorna todos os roles válidos
 */
export function getValidRoles(): string[] {
  return Object.keys(ROLE_DASHBOARD_MAP);
}
