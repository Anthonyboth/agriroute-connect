export interface CargoType {
  value: string;
  label: string;
  category: 'rural' | 'carga_viva' | 'outros';
}

export const CARGO_TYPES: CargoType[] = [
  // Carga Rural
  { value: 'graos_soja', label: 'Grãos - Soja', category: 'rural' },
  { value: 'graos_milho', label: 'Grãos - Milho', category: 'rural' },
  { value: 'graos_trigo', label: 'Grãos - Trigo', category: 'rural' },
  { value: 'graos_arroz', label: 'Grãos - Arroz', category: 'rural' },
  { value: 'sementes_bags', label: 'Sementes em Bags', category: 'rural' },
  { value: 'adubo_fertilizante', label: 'Adubo/Fertilizante', category: 'rural' },
  { value: 'fardos_algodao', label: 'Fardos de Algodão', category: 'rural' },
  { value: 'defensivos_agricolas', label: 'Defensivos Agrícolas', category: 'rural' },
  { value: 'calcario', label: 'Calcário', category: 'rural' },
  { value: 'farelo_soja', label: 'Farelo de Soja', category: 'rural' },
  { value: 'racao_animal', label: 'Ração Animal', category: 'rural' },
  
  // Carga Viva
  { value: 'gado_bovino', label: 'Gado Bovino', category: 'carga_viva' },
  { value: 'gado_leiteiro', label: 'Gado Leiteiro', category: 'carga_viva' },
  { value: 'suinos_porcos', label: 'Suínos/Porcos', category: 'carga_viva' },
  { value: 'aves_frangos', label: 'Aves/Frangos', category: 'carga_viva' },
  { value: 'aves_galinhas', label: 'Galinhas Poedeiras', category: 'carga_viva' },
  { value: 'cavalos', label: 'Cavalos', category: 'carga_viva' },
  { value: 'caprinos_ovinos', label: 'Caprinos/Ovinos', category: 'carga_viva' },
  
  // Outros
  { value: 'maquinas_agricolas', label: 'Máquinas Agrícolas', category: 'outros' },
  { value: 'equipamentos', label: 'Equipamentos', category: 'outros' },
  { value: 'combustivel', label: 'Combustível', category: 'outros' },
  { value: 'outros', label: 'Outros', category: 'outros' }
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