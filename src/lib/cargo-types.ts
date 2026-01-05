export interface CargoType {
  value: string;
  label: string;
  category: 'rural' | 'carga_viva' | 'outros';
  anttCategory: string; // Categoria oficial ANTT
  requiresAxles: boolean; // Se true, usa seleção por eixos ao invés de tipo de veículo
}

export const CARGO_TYPES: CargoType[] = [
  // === CARGA RURAL (COM ANTT - USA EIXOS) ===
  { value: 'graos_soja', label: 'Grãos - Soja', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'graos_milho', label: 'Grãos - Milho', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'graos_trigo', label: 'Grãos - Trigo', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'graos_arroz', label: 'Grãos - Arroz', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'adubo_fertilizante', label: 'Adubo/Fertilizante', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'sementes_bags', label: 'Sementes em Bags', category: 'rural', anttCategory: 'Neogranel', requiresAxles: true },
  { value: 'defensivos_agricolas', label: 'Defensivos Agrícolas', category: 'rural', anttCategory: 'Perigosa (carga geral)', requiresAxles: true },
  { value: 'combustivel', label: 'Combustível', category: 'outros', anttCategory: 'Granel líquido', requiresAxles: true },
  { value: 'calcario', label: 'Calcário', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'farelo_soja', label: 'Farelo de Soja', category: 'rural', anttCategory: 'Granel sólido', requiresAxles: true },
  { value: 'racao_animal', label: 'Ração Animal', category: 'rural', anttCategory: 'Carga Geral', requiresAxles: true },
  { value: 'fardos_algodao', label: 'Fardos de Algodão', category: 'rural', anttCategory: 'Carga Geral', requiresAxles: true },
  
  // === CARGA VIVA (SEM ANTT - USA TIPOS DE VEÍCULOS) ===
  { value: 'gado_bovino', label: 'Gado Bovino', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'gado_leiteiro', label: 'Gado Leiteiro', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'suinos_porcos', label: 'Suínos/Porcos', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'aves_frangos', label: 'Aves/Frangos', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'aves_galinhas', label: 'Galinhas Poedeiras', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'cavalos', label: 'Cavalos', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'caprinos_ovinos', label: 'Caprinos/Ovinos', category: 'carga_viva', anttCategory: 'Carga Geral', requiresAxles: false },
  
  // === OUTROS (SEM ANTT - USA TIPOS DE VEÍCULOS) ===
  { value: 'maquinas_agricolas', label: 'Máquinas Agrícolas', category: 'outros', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'equipamentos', label: 'Equipamentos', category: 'outros', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'frete_moto', label: 'Frete por Moto', category: 'outros', anttCategory: 'Carga Geral', requiresAxles: false },
  { value: 'outros', label: 'Outros', category: 'outros', anttCategory: 'Carga Geral', requiresAxles: false }
];

export const CARGO_CATEGORIES = [
  { value: 'rural', label: 'Carga Rural' },
  { value: 'carga_viva', label: 'Carga Viva' },
  { value: 'outros', label: 'Outros' }
];

export const getCargoTypesByCategory = (category: string) => {
  return CARGO_TYPES.filter(cargo => cargo.category === category);
};

export const getCargoTypeLabel = (value: string) => {
  const cargoType = CARGO_TYPES.find(cargo => cargo.value === value);
  return cargoType?.label || value;
};

// Opções de eixos oficiais ANTT (2, 3, 4, 5, 6, 7, 9)
export const AXLE_OPTIONS = [
  { value: 2, label: '2 eixos', capacity: '8-10t', description: 'Truck pequeno, 3/4' },
  { value: 3, label: '3 eixos', capacity: '12-14t', description: 'Truck, Toco' },
  { value: 4, label: '4 eixos', capacity: '16-18t', description: 'Truck alongado' },
  { value: 5, label: '5 eixos', capacity: '25-27t', description: 'Carreta simples (padrão)' },
  { value: 6, label: '6 eixos', capacity: '32-35t', description: 'Carreta estendida' },
  { value: 7, label: '7 eixos', capacity: '40-45t', description: 'Bitrem' },
  { value: 9, label: '9 eixos', capacity: '57-60t', description: 'Rodotrem' }
];

// Tipos de veículos para fretes não-rurais (sem ANTT)
export const VEHICLE_TYPES_URBAN = [
  { value: 'VUC', label: 'VUC - Veículo Urbano de Carga' },
  { value: 'CAMINHAO_3_4', label: 'Caminhão 3/4' },
  { value: 'CAMINHAO_CACAMBA', label: 'Caminhão Caçamba' },
  { value: 'BICACAMBA', label: 'Bicaçamba' },
  { value: 'CARRETA_BAU', label: 'Carreta Baú' },
  { value: 'CARRETA_GADO', label: 'Carreta Boiadeira' },
  { value: 'CARRETA_REFRIGERADA', label: 'Carreta Refrigerada' },
  { value: 'PRANCHA', label: 'Prancha (máquinas)' },
  { value: 'BITREM', label: 'Bitrem' },
  { value: 'RODOTREM', label: 'Rodotrem' }
];

// Funções helper
export const cargoRequiresAxles = (cargoValue: string): boolean => {
  const cargo = CARGO_TYPES.find(c => c.value === cargoValue);
  return cargo?.requiresAxles || false;
};

export const getAnttCategory = (cargoValue: string): string => {
  const cargo = CARGO_TYPES.find(c => c.value === cargoValue);
  return cargo?.anttCategory || 'Carga Geral';
};