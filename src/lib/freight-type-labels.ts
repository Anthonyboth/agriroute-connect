/**
 * Mapeamento completo de tipos de carga para labels legíveis
 */
const CARGO_TYPE_LABELS: Record<string, string> = {
  // Grãos
  'graos_soja': 'Grãos - Soja',
  'graos_milho': 'Grãos - Milho',
  'graos_trigo': 'Grãos - Trigo',
  'graos_arroz': 'Grãos - Arroz',
  
  // Outros tipos rurais
  'adubo_fertilizante': 'Adubo/Fertilizante',
  'sementes_bags': 'Sementes em Bags',
  'defensivos_agricolas': 'Defensivos Agrícolas',
  'combustivel': 'Combustível',
  'calcario': 'Calcário',
  'farelo_soja': 'Farelo de Soja',
  'racao_animal': 'Ração Animal',
  'fardos_algodao': 'Fardos de Algodão',
  
  // Carga viva
  'gado_bovino': 'Gado Bovino',
  'gado_leiteiro': 'Gado Leiteiro',
  'suinos_porcos': 'Suínos/Porcos',
  'aves_frangos': 'Aves/Frangos',
  'aves_galinhas': 'Galinhas Poedeiras',
  'cavalos': 'Cavalos',
  'caprinos_ovinos': 'Caprinos/Ovinos',
  
  // Outros
  'maquinas_agricolas': 'Máquinas Agrícolas',
  'equipamentos': 'Equipamentos',
  'frete_moto': 'Frete Moto (Carretinha 500kg)',
  'outros': 'Outros',
  
  // Mapeamento em MAIÚSCULAS (compatibilidade)
  'FRETE_MOTO': 'Frete Moto (Carretinha 500kg)',
  'GRAOS_SOJA': 'Grãos - Soja',
  'GRAOS_MILHO': 'Grãos - Milho',
  'GRAOS_TRIGO': 'Grãos - Trigo',
  'GRAOS_ARROZ': 'Grãos - Arroz',
  'ADUBO_FERTILIZANTE': 'Adubo/Fertilizante',
  'SEMENTES_BAGS': 'Sementes em Bags',
  'DEFENSIVOS_AGRICOLAS': 'Defensivos Agrícolas',
  'COMBUSTIVEL': 'Combustível',
  'CALCARIO': 'Calcário',
  'FARELO_SOJA': 'Farelo de Soja',
  'RACAO_ANIMAL': 'Ração Animal',
  'FARDOS_ALGODAO': 'Fardos de Algodão',
  'GADO_BOVINO': 'Gado Bovino',
  'GADO_LEITEIRO': 'Gado Leiteiro',
  'SUINOS_PORCOS': 'Suínos/Porcos',
  'AVES_FRANGOS': 'Aves/Frangos',
  'AVES_GALINHAS': 'Galinhas Poedeiras',
  'CAVALOS': 'Cavalos',
  'CAPRINOS_OVINOS': 'Caprinos/Ovinos',
  'MAQUINAS_AGRICOLAS': 'Máquinas Agrícolas',
  'EQUIPAMENTOS': 'Equipamentos',
  'OUTROS': 'Outros',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  'CARGA': 'Transporte de Carga',
  'FRETE_MOTO': 'Frete Moto (Carretinha 500kg)',
  'GUINCHO': 'Guincho',
  'MUDANCA': 'Mudança',
  'CARGA_GERAL': 'Carga Geral',
  'CARGA_AGRICOLA': 'Carga Agrícola',
  'TRANSPORTE_ANIMAIS': 'Transporte de Animais',
  'TRANSPORTE_MAQUINARIO': 'Transporte de Maquinário',
};

/**
 * Retorna label legível para qualquer tipo de frete
 * Busca em cargo_type E service_type, case-insensitive
 */
export function getFreightTypeLabel(cargoType: string, serviceType?: string): string {
  if (!cargoType) {
    return serviceType && SERVICE_TYPE_LABELS[serviceType] 
      ? SERVICE_TYPE_LABELS[serviceType] 
      : 'Carga não especificada';
  }

  // Tentar cargo_type (exato)
  if (CARGO_TYPE_LABELS[cargoType]) {
    return CARGO_TYPE_LABELS[cargoType];
  }
  
  // Tentar cargo_type (lowercase)
  const normalizedCargo = cargoType.toLowerCase();
  if (CARGO_TYPE_LABELS[normalizedCargo]) {
    return CARGO_TYPE_LABELS[normalizedCargo];
  }
  
  // Tentar cargo_type (uppercase)
  const upperCargo = cargoType.toUpperCase();
  if (CARGO_TYPE_LABELS[upperCargo]) {
    return CARGO_TYPE_LABELS[upperCargo];
  }
  
  // Tentar service_type
  if (serviceType && SERVICE_TYPE_LABELS[serviceType]) {
    return SERVICE_TYPE_LABELS[serviceType];
  }
  
  // Fallback: formatar o valor original
  return cargoType
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Verifica se o frete deve exibir valor ANTT
 * Apenas fretes tipo CARGA com carga rural têm ANTT
 */
export function shouldShowAntt(serviceType?: string, cargoType?: string): boolean {
  // Apenas fretes tipo CARGA têm ANTT
  if (serviceType !== 'CARGA') return false;
  
  // Tipos que não têm ANTT (mesmo sendo CARGA)
  const noAnttTypes = [
    'frete_moto', 'FRETE_MOTO',
    'gado_bovino', 'GADO_BOVINO',
    'gado_leiteiro', 'GADO_LEITEIRO',
    'suinos_porcos', 'SUINOS_PORCOS',
    'aves_frangos', 'AVES_FRANGOS',
    'aves_galinhas', 'AVES_GALINHAS',
    'cavalos', 'CAVALOS',
    'caprinos_ovinos', 'CAPRINOS_OVINOS',
    'maquinas_agricolas', 'MAQUINAS_AGRICOLAS',
    'equipamentos', 'EQUIPAMENTOS',
    'outros', 'OUTROS'
  ];
  
  const normalizedCargoType = cargoType?.toLowerCase() || '';
  const upperCargoType = cargoType?.toUpperCase() || '';
  
  return !noAnttTypes.includes(normalizedCargoType) && 
         !noAnttTypes.includes(upperCargoType) &&
         !noAnttTypes.includes(cargoType || '');
}
