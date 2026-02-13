/**
 * Utilitário para normalização consistente de tipos de serviço
 * 
 * TIPOS CANÔNICOS (únicos aceitos no sistema):
 * - CARGA: Transporte de carga geral
 * - GUINCHO: Serviço de reboque/guincho
 * - MUDANCA: Mudanças residenciais/comerciais
 * - FRETE_MOTO: Frete por moto
 */

export const CANONICAL_SERVICE_TYPES = ['CARGA', 'GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'ENTREGA_PACOTES', 'TRANSPORTE_PET'] as const;
export type CanonicalServiceType = typeof CANONICAL_SERVICE_TYPES[number];

/**
 * Normaliza um tipo de serviço para seu formato canônico
 * 
 * @param type - Tipo de serviço a ser normalizado
 * @returns Tipo normalizado ou o tipo original se já estiver no formato correto
 */
export const normalizeServiceType = (type: string | null | undefined): CanonicalServiceType => {
  if (!type) return 'CARGA'; // Default fallback
  
  const normalized = String(type).toUpperCase().trim();
  
  // Mapeamento de variações para tipos canônicos
  const mappings: Record<string, CanonicalServiceType> = {
    'CARGA': 'CARGA',
    'CARGA_FREIGHT': 'CARGA',
    'FRETE': 'CARGA',
    'TRANSPORTE_CARGA': 'CARGA',
    
    'GUINCHO': 'GUINCHO',
    'GUINCHO_FREIGHT': 'GUINCHO',
    'REBOQUE': 'GUINCHO',
    
    'MUDANCA': 'MUDANCA',
    'MUDANCA_FREIGHT': 'MUDANCA',
    'MUDANCAS': 'MUDANCA',
    
    'FRETE_MOTO': 'FRETE_MOTO',
    'MOTO': 'FRETE_MOTO',
    'MOTOBOY': 'FRETE_MOTO',
    
    'ENTREGA_PACOTES': 'ENTREGA_PACOTES',
    'PACOTES': 'ENTREGA_PACOTES',
    'ENTREGA': 'ENTREGA_PACOTES',
    
    'TRANSPORTE_PET': 'TRANSPORTE_PET',
    'PET': 'TRANSPORTE_PET',
    'TRANSPORTE_ANIMAL': 'TRANSPORTE_PET',
  };
  
  return mappings[normalized] || 'CARGA'; // Fallback para CARGA se não reconhecer
};

/**
 * Verifica se um tipo de serviço é válido (está na lista canônica)
 * 
 * @param type - Tipo de serviço a ser validado
 * @returns true se o tipo for válido, false caso contrário
 */
export const isValidServiceType = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const normalized = normalizeServiceType(type);
  return CANONICAL_SERVICE_TYPES.includes(normalized as CanonicalServiceType);
};

/**
 * Normaliza um array de tipos de serviço, removendo duplicatas
 * 
 * @param types - Array de tipos de serviço
 * @returns Array de tipos normalizados e únicos
 */
export const normalizeServiceTypes = (types: (string | null | undefined)[]): CanonicalServiceType[] => {
  if (!Array.isArray(types) || types.length === 0) {
    return ['CARGA']; // Default fallback
  }
  
  const normalized = types
    .filter(Boolean)
    .map(normalizeServiceType)
    .filter(isValidServiceType);
  
  // Remover duplicatas
  const unique = Array.from(new Set(normalized)) as CanonicalServiceType[];
  
  return unique.length > 0 ? unique : ['CARGA'];
};

/**
 * Obtém os tipos de serviço permitidos do perfil do usuário
 * 
 * @param profile - Perfil do usuário
 * @param role - Role do usuário (opcional, usa profile.role se não fornecido)
 * @returns Array de tipos de serviço normalizados
 */
export const getAllowedServiceTypesFromProfile = (
  profile: any,
  role?: string
): CanonicalServiceType[] => {
  const userRole = role || profile?.role;
  
  // TRANSPORTADORA sem config → todos os tipos
  if (userRole === 'TRANSPORTADORA') {
    if (!profile?.service_types || profile.service_types.length === 0) {
      if (import.meta.env.DEV) console.log('🔎 TRANSPORTADORA sem config → permitindo todos os tipos');
      return [...CANONICAL_SERVICE_TYPES];
    }
  }
  
  // Normalizar tipos do perfil
  const types = normalizeServiceTypes(profile?.service_types || []);
  
  // Fallback baseado no role
  if (types.length === 0) {
    const defaultTypes = userRole === 'MOTORISTA' 
      ? ['CARGA'] // Motorista sem config → apenas CARGA
      : [...CANONICAL_SERVICE_TYPES]; // Outros → todos
    
    if (import.meta.env.DEV) console.log(`🔎 Tipos vazios → usando fallback (${userRole || 'sem role'}):`, defaultTypes);
    return defaultTypes as CanonicalServiceType[];
  }
  
  if (import.meta.env.DEV) console.log('🔎 Tipos permitidos do perfil:', types);
  return types;
};
