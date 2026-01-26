/**
 * ✅ P0 FIX: FUNÇÃO ÚNICA DE CLASSIFICAÇÃO (FRETE vs SERVIÇO)
 * 
 * REGRA INEGOCIÁVEL:
 * - FRETE: Tudo que envolve TRANSPORTE (rural ou urbano)
 * - SERVIÇO: Apenas solicitações não-transporte (manutenção, assistência técnica, etc.)
 * 
 * Esta função é a ÚNICA fonte de verdade para classificar itens em todo o app.
 * Usar em: renderização, contadores, abas, histórico, queries.
 */

// ✅ Lista DEFINITIVA de tipos que são FRETE (não SERVIÇO)
// Inclui fretes rurais E urbanos (moto, guincho, mudança, etc.)
export const FREIGHT_TYPE_IDS: string[] = [
  // Fretes urbanos (via service_requests)
  'FRETE_MOTO',
  'FRETE_URBANO',
  'GUINCHO',
  'GUINCHO_FREIGHT',
  'MUDANCA',
  'MUDANCA_RESIDENCIAL',
  'MUDANCA_COMERCIAL',
  'CARGA_FREIGHT',
  // Aliases e variações
  'FRETE_GUINCHO',
  'FRETE_MUDANCA',
];

// Tipos que são SERVIÇO (não FRETE) - para referência
export const SERVICE_TYPE_IDS: string[] = [
  'SERVICO_AGRICOLA',
  'SERVICO_TECNICO',
  'AGRONOMO',
  'ANALISE_SOLO',
  'ARMAZENAGEM',
  'ASSISTENCIA_TECNICA',
  'MANUTENCAO_BALANCAS',
  'SERVICOS_VETERINARIOS',
  'TOPOGRAFIA_RURAL',
  'PIVO_IRRIGACAO',
  'PULVERIZACAO_DRONE',
  'INSTALACAO_ELETRICA_RURAL',
  // ... qualquer tipo que NÃO seja transporte
];

export type ItemKind = 'FRETE' | 'SERVICO';
export type ItemCategory = 'RURAL' | 'URBANO' | 'OUTRO';

export interface ClassificationResult {
  kind: ItemKind;
  category: ItemCategory;
  serviceType: string;
}

/**
 * ✅ FUNÇÃO PRINCIPAL: Classifica um item como FRETE ou SERVIÇO
 * 
 * @param serviceType - O tipo de serviço (ex: 'FRETE_MOTO', 'SERVICO_AGRICOLA')
 * @param source - A tabela de origem ('freights' ou 'service_requests')
 * @returns Classificação com kind (FRETE/SERVICO) e category (RURAL/URBANO/OUTRO)
 */
export function classifyItem(
  serviceType: string | null | undefined,
  source: 'freights' | 'service_requests' | 'unknown' = 'unknown'
): ClassificationResult {
  const normalizedType = (serviceType || '').toUpperCase().trim();
  
  // ✅ REGRA 1: Se veio da tabela 'freights', é SEMPRE frete rural
  if (source === 'freights') {
    return {
      kind: 'FRETE',
      category: 'RURAL',
      serviceType: normalizedType || 'CARGA'
    };
  }
  
  // ✅ REGRA 2: Se o tipo está na lista de FRETE, é FRETE urbano
  if (isFreightType(normalizedType)) {
    return {
      kind: 'FRETE',
      category: 'URBANO',
      serviceType: normalizedType
    };
  }
  
  // ✅ REGRA 3: Caso contrário, é SERVIÇO
  return {
    kind: 'SERVICO',
    category: 'OUTRO',
    serviceType: normalizedType || 'SERVICO'
  };
}

/**
 * ✅ Verifica se um tipo é considerado FRETE (urbano)
 */
export function isFreightType(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  
  const normalizedType = serviceType.toUpperCase().trim();
  
  // Verificação direta na lista
  if (FREIGHT_TYPE_IDS.includes(normalizedType)) {
    return true;
  }
  
  // Verificação por prefixo (para pegar variações como FRETE_*)
  if (normalizedType.startsWith('FRETE_')) {
    return true;
  }
  
  // Verificação por sufixo (para pegar variações como *_FREIGHT)
  if (normalizedType.endsWith('_FREIGHT')) {
    return true;
  }
  
  return false;
}

/**
 * ✅ Verifica se um tipo é considerado SERVIÇO (não-transporte)
 */
export function isServiceType(serviceType: string | null | undefined): boolean {
  return !isFreightType(serviceType);
}

/**
 * ✅ Retorna a lista de tipos de frete para uso em queries SQL/Supabase
 * Usar em: .in('service_type', getFreightTypesForQuery())
 */
export function getFreightTypesForQuery(): string[] {
  return [...FREIGHT_TYPE_IDS];
}

/**
 * ✅ Filtra itens classificados como FRETE
 */
export function filterFreightItems<T extends { service_type?: string | null }>(
  items: T[],
  source: 'freights' | 'service_requests' = 'service_requests'
): T[] {
  return items.filter(item => {
    const classification = classifyItem(item.service_type, source);
    return classification.kind === 'FRETE';
  });
}

/**
 * ✅ Filtra itens classificados como SERVIÇO
 */
export function filterServiceItems<T extends { service_type?: string | null }>(
  items: T[]
): T[] {
  return items.filter(item => {
    const classification = classifyItem(item.service_type, 'service_requests');
    return classification.kind === 'SERVICO';
  });
}

/**
 * ✅ Conta itens por classificação
 */
export function countByClassification<T extends { service_type?: string | null }>(
  items: T[],
  source: 'freights' | 'service_requests' = 'service_requests'
): { freights: number; services: number } {
  let freights = 0;
  let services = 0;
  
  for (const item of items) {
    const classification = classifyItem(item.service_type, source);
    if (classification.kind === 'FRETE') {
      freights++;
    } else {
      services++;
    }
  }
  
  return { freights, services };
}

// Log para debug em desenvolvimento
if (import.meta.env.DEV) {
  console.log('[item-classification] ✅ Tipos de FRETE urbano:', FREIGHT_TYPE_IDS);
}
