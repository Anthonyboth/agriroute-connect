/**
 * Lista centralizada de tipos de veículos - FONTE ÚNICA DE VERDADE
 * Usada por: AdvancedVehicleManager, VehicleManager, CompanyVehiclesList
 * Ordenada alfabeticamente por label
 */

export interface VehicleTypeInfo {
  value: string;
  label: string;
  weight: string;
  weightTons: number;
  axles: number;
  specs: string;
}

// Lista completa de tipos de veículos ordenada alfabeticamente por label
export const VEHICLE_TYPES: VehicleTypeInfo[] = [
  {
    value: 'BITREM',
    label: 'Bitrem (Genérico)',
    weight: '57t',
    weightTons: 57,
    axles: 7,
    specs: 'Bitrem padrão para transporte de grãos'
  },
  {
    value: 'BITREM_7_EIXOS',
    label: 'Bitrem 7 Eixos',
    weight: '74t',
    weightTons: 74,
    axles: 7,
    specs: 'Caminhão + 2 reboques para alta capacidade'
  },
  {
    value: 'BITREM_9_EIXOS',
    label: 'Bitrem 9 Eixos',
    weight: '91t',
    weightTons: 91,
    axles: 9,
    specs: 'Caminhão + 2 reboques longos para máxima capacidade'
  },
  {
    value: 'CAMINHAO_3_4',
    label: 'Caminhão 3/4',
    weight: '6t',
    weightTons: 6,
    axles: 2,
    specs: 'Transporte urbano e regional de cargas médias'
  },
  {
    value: 'CAMINHAO_TRUCK',
    label: 'Caminhão Truck',
    weight: '14t',
    weightTons: 14,
    axles: 3,
    specs: 'Caminhão para transporte regional'
  },
  {
    value: 'CAMINHONETE',
    label: 'Caminhonete',
    weight: '3,5t',
    weightTons: 3.5,
    axles: 2,
    specs: 'Cargas leves e pequenos volumes'
  },
  {
    value: 'CARRETA',
    label: 'Carreta (Genérica)',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Carreta padrão para transporte geral'
  },
  {
    value: 'CARRETA_2_EIXOS',
    label: 'Carreta 2 Eixos',
    weight: '30t',
    weightTons: 30,
    axles: 4,
    specs: 'Carreta leve para cargas médias'
  },
  {
    value: 'CARRETA_3_EIXOS',
    label: 'Carreta 3 Eixos',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Carreta básica para transporte de grãos e cargas secas'
  },
  {
    value: 'CARRETA_FRIGORIFICA',
    label: 'Carreta Frigorífica',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Transporte refrigerado/congelado de alimentos e medicamentos'
  },
  {
    value: 'CARRETA_GRANELEIRA',
    label: 'Carreta Graneleira',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Para grãos, rações e produtos a granel'
  },
  {
    value: 'CARRETA_PRANCHA',
    label: 'Carreta Prancha',
    weight: '50t',
    weightTons: 50,
    axles: 5,
    specs: 'Plataforma aberta para máquinas e equipamentos'
  },
  {
    value: 'CARRETA_SIDER',
    label: 'Carreta Sider',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Lona lateral para carga/descarga rápida'
  },
  {
    value: 'CARRETA_TANQUE',
    label: 'Carreta Tanque',
    weight: '45t',
    weightTons: 45,
    axles: 5,
    specs: 'Para transporte de líquidos: combustíveis, óleos, produtos químicos'
  },
  {
    value: 'CAVALO_MECANICO_TOCO',
    label: 'Cavalo Mecânico Toco',
    weight: '23t',
    weightTons: 23,
    axles: 3,
    specs: 'Para puxar semi-reboques - configuração toco'
  },
  {
    value: 'CAVALO_MECANICO_TRUCK',
    label: 'Cavalo Mecânico Truck',
    weight: '30t',
    weightTons: 30,
    axles: 3,
    specs: 'Para puxar semi-reboques - configuração truck'
  },
  {
    value: 'MOTO',
    label: 'Moto',
    weight: '500kg',
    weightTons: 0.5,
    axles: 2,
    specs: 'Entregas rápidas urbanas e documentos'
  },
  {
    value: 'PICKUP',
    label: 'Pickup',
    weight: '1,5t',
    weightTons: 1.5,
    axles: 2,
    specs: 'Veículo leve para cargas pequenas e entregas rápidas'
  },
  {
    value: 'RODOTREM',
    label: 'Rodotrem (Genérico)',
    weight: '74t',
    weightTons: 74,
    axles: 7,
    specs: 'Rodotrem padrão para longas distâncias'
  },
  {
    value: 'RODOTREM_7_EIXOS',
    label: 'Rodotrem 7 Eixos',
    weight: '74t',
    weightTons: 74,
    axles: 7,
    specs: 'Cavalo + 2 semi-reboques para longas distâncias'
  },
  {
    value: 'RODOTREM_9_EIXOS',
    label: 'Rodotrem 9 Eixos',
    weight: '91t',
    weightTons: 91,
    axles: 9,
    specs: 'Maior capacidade de carga, ideal para longas distâncias'
  },
  {
    value: 'TOCO',
    label: 'Toco',
    weight: '16t',
    weightTons: 16,
    axles: 3,
    specs: 'Caminhão toco para cargas gerais, ideal para distâncias médias e urbano'
  },
  {
    value: 'TRITREM_9_EIXOS',
    label: 'Tritrem 9 Eixos',
    weight: '91t',
    weightTons: 91,
    axles: 9,
    specs: 'Cavalo + 3 semi-reboques para grandes volumes'
  },
  {
    value: 'TRITREM_11_EIXOS',
    label: 'Tritrem 11 Eixos',
    weight: '110t',
    weightTons: 110,
    axles: 11,
    specs: 'Cavalo + 3 semi-reboques longos - máxima capacidade'
  },
  {
    value: 'TRUCK',
    label: 'Truck',
    weight: '23t',
    weightTons: 23,
    axles: 3,
    specs: 'Caminhão truck para cargas gerais, ideal para distâncias médias'
  },
  {
    value: 'VLC_URBANO',
    label: 'VLC Urbano',
    weight: '2,5t',
    weightTons: 2.5,
    axles: 2,
    specs: 'Veículo leve de carga para entregas urbanas'
  },
  {
    value: 'VUC',
    label: 'VUC (Veículo Urbano de Carga)',
    weight: '3,5t',
    weightTons: 3.5,
    axles: 2,
    specs: 'Veículo urbano de carga para entregas na cidade'
  },
  {
    value: 'OUTROS',
    label: 'Outros',
    weight: 'Variável',
    weightTons: 0,
    axles: 0,
    specs: 'Tipo de veículo não especificado na lista - descreva nas especificações'
  }
];

// Mapa para lookup rápido por value
export const VEHICLE_TYPES_MAP: Record<string, VehicleTypeInfo> = VEHICLE_TYPES.reduce(
  (acc, type) => {
    acc[type.value] = type;
    return acc;
  },
  {} as Record<string, VehicleTypeInfo>
);

/**
 * Retorna o label do tipo de veículo pelo value
 */
export function getVehicleTypeLabel(value: string): string {
  return VEHICLE_TYPES_MAP[value]?.label || value;
}

/**
 * Retorna informações completas do tipo de veículo
 */
export function getVehicleTypeInfo(value: string): VehicleTypeInfo | undefined {
  return VEHICLE_TYPES_MAP[value];
}

/**
 * Lista simplificada para selects (value + label)
 */
export const VEHICLE_TYPES_SELECT = VEHICLE_TYPES.map(t => ({
  value: t.value,
  label: t.label
}));
