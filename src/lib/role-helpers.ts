/**
 * Helper functions para verificação consistente de roles
 * Centraliza a lógica para evitar inconsistências no código
 */

export type UserRole = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRODUTOR' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS';

/**
 * Verifica se o usuário é motorista (independente ou afiliado)
 */
export const isDriverRole = (role?: string | null): boolean => {
  return ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(role || '');
};

/**
 * Verifica se o usuário é produtor
 */
export const isProducerRole = (role?: string | null): boolean => {
  return role === 'PRODUTOR';
};

/**
 * Verifica se o usuário é transportadora
 */
export const isTransportCompanyRole = (role?: string | null): boolean => {
  return role === 'TRANSPORTADORA';
};

/**
 * Verifica se o usuário é prestador de serviços
 */
export const isServiceProviderRole = (role?: string | null): boolean => {
  return role === 'PRESTADOR_SERVICOS';
};

/**
 * Retorna o nome legível da role
 */
export const getRoleDisplayName = (role?: string | null, activeMode?: string): string => {
  if (!role) return 'Usuário';
  if (activeMode === 'TRANSPORTADORA') return 'Transportadora';
  
  switch (role) {
    case 'PRODUTOR':
      return 'Produtor';
    case 'MOTORISTA':
      return 'Motorista';
    case 'MOTORISTA_AFILIADO':
      return 'Motorista Afiliado';
    case 'TRANSPORTADORA':
      return 'Transportadora';
    case 'PRESTADOR_SERVICOS':
      return 'Prestador de Serviço';
    default:
      return 'Usuário';
  }
};
