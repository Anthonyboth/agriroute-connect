/**
 * Motor de Compliance por Tipo de Carga
 * Regras de documentação obrigatória baseadas no tipo de carga
 */

export type CargoType = 
  | 'GADO_VIVO' 
  | 'BOVINOS' 
  | 'SUINOS' 
  | 'AVES' 
  | 'EQUINOS'
  | 'CAPRINOS_OVINOS'
  | 'ANIMAIS_SILVESTRES'
  | 'GRAOS' 
  | 'FRUTAS_VERDURAS' 
  | 'CARGA_FRIGORIFICADA'
  | 'CARGA_GERAL'
  | 'MUDANCA'
  | 'VEICULOS'
  | 'MAQUINAS_AGRICOLAS'
  | 'PRODUTOS_PERIGOSOS'
  | 'OUTROS';

export type DocumentType = 
  | 'GTA' 
  | 'GTA_A' 
  | 'GTA_B' 
  | 'CERTIFICADO_SANITARIO'
  | 'NOTA_FISCAL'
  | 'CRLV'
  | 'IBAMA'
  | 'ANVISA'
  | 'CERTIFICADO_FITOSSANITARIO'
  | 'MOPP' // Movimentação de Produtos Perigosos
  | 'OUTROS';

export interface ComplianceRule {
  cargoType: CargoType;
  label: string;
  description: string;
  requiredDocuments: {
    type: DocumentType;
    label: string;
    mandatory: boolean;
    description: string;
  }[];
  gtaModel?: 'A' | 'B' | 'BOTH';
  specialInstructions?: string[];
}

/**
 * Regras de compliance por tipo de carga
 */
export const CARGO_COMPLIANCE_RULES: Record<CargoType, ComplianceRule> = {
  GADO_VIVO: {
    cargoType: 'GADO_VIVO',
    label: 'Gado Vivo (Genérico)',
    description: 'Transporte de animais vivos para abate ou reprodução',
    requiredDocuments: [
      { type: 'GTA', label: 'GTA (Guia de Trânsito Animal)', mandatory: true, description: 'Obrigatória para qualquer movimentação de animais vivos' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
    ],
    gtaModel: 'BOTH',
    specialInstructions: [
      'Veículo deve ter autorização para transporte de animais vivos',
      'Verificar condições de bem-estar animal',
      'GTA Modelo A para bovinos/bubalinos; Modelo B para demais espécies',
    ],
  },
  BOVINOS: {
    cargoType: 'BOVINOS',
    label: 'Bovinos e Bubalinos',
    description: 'Gado bovino e búfalos',
    requiredDocuments: [
      { type: 'GTA_A', label: 'GTA Modelo A', mandatory: true, description: 'Exclusiva para bovinos e bubalinos' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
      { type: 'CERTIFICADO_SANITARIO', label: 'Atestado de Vacinação', mandatory: false, description: 'Vacinação contra febre aftosa' },
    ],
    gtaModel: 'A',
    specialInstructions: [
      'GTA Modelo A é obrigatória',
      'Verificar vacinação contra febre aftosa',
      'Densidade máxima conforme MAPA',
    ],
  },
  SUINOS: {
    cargoType: 'SUINOS',
    label: 'Suínos',
    description: 'Transporte de porcos',
    requiredDocuments: [
      { type: 'GTA_B', label: 'GTA Modelo B', mandatory: true, description: 'Para suínos' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
    ],
    gtaModel: 'B',
    specialInstructions: [
      'GTA Modelo B obrigatória',
      'Verificar procedência (granjas certificadas)',
    ],
  },
  AVES: {
    cargoType: 'AVES',
    label: 'Aves',
    description: 'Transporte de aves de corte ou postura',
    requiredDocuments: [
      { type: 'GTA_B', label: 'GTA Modelo B', mandatory: true, description: 'Para aves' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
      { type: 'CERTIFICADO_SANITARIO', label: 'Certificado Sanitário', mandatory: false, description: 'Para aves de postura ou reprodução' },
    ],
    gtaModel: 'B',
    specialInstructions: [
      'Caixas de transporte adequadas',
      'Ventilação obrigatória no veículo',
    ],
  },
  EQUINOS: {
    cargoType: 'EQUINOS',
    label: 'Equinos, Asininos e Muares',
    description: 'Cavalos, jumentos e mulas',
    requiredDocuments: [
      { type: 'GTA_B', label: 'GTA Modelo B', mandatory: true, description: 'Para equídeos' },
      { type: 'CERTIFICADO_SANITARIO', label: 'Exame de AIE/Mormo', mandatory: true, description: 'Anemia Infecciosa Equina e Mormo' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: false, description: 'Se houver venda' },
    ],
    gtaModel: 'B',
    specialInstructions: [
      'Exame de AIE e Mormo obrigatórios',
      'Validade do exame: 60 dias',
    ],
  },
  CAPRINOS_OVINOS: {
    cargoType: 'CAPRINOS_OVINOS',
    label: 'Caprinos e Ovinos',
    description: 'Cabras e ovelhas',
    requiredDocuments: [
      { type: 'GTA_B', label: 'GTA Modelo B', mandatory: true, description: 'Para caprinos/ovinos' },
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
    ],
    gtaModel: 'B',
  },
  ANIMAIS_SILVESTRES: {
    cargoType: 'ANIMAIS_SILVESTRES',
    label: 'Animais Silvestres',
    description: 'Fauna silvestre (criadouros autorizados)',
    requiredDocuments: [
      { type: 'GTA_B', label: 'GTA Modelo B', mandatory: true, description: 'Para animais silvestres' },
      { type: 'IBAMA', label: 'Autorização IBAMA', mandatory: true, description: 'Licença de transporte de fauna' },
    ],
    gtaModel: 'B',
    specialInstructions: [
      'Criadouro deve ser registrado no IBAMA',
      'Autorização específica para cada transporte',
    ],
  },
  GRAOS: {
    cargoType: 'GRAOS',
    label: 'Grãos e Cereais',
    description: 'Soja, milho, trigo, etc.',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e da carga' },
      { type: 'CERTIFICADO_FITOSSANITARIO', label: 'Certificado Fitossanitário', mandatory: false, description: 'Para trânsito interestadual de certas culturas' },
    ],
  },
  FRUTAS_VERDURAS: {
    cargoType: 'FRUTAS_VERDURAS',
    label: 'Frutas, Verduras e Legumes',
    description: 'Produtos hortifruti',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e da carga' },
      { type: 'CERTIFICADO_FITOSSANITARIO', label: 'Permissão de Trânsito', mandatory: false, description: 'Para algumas culturas específicas' },
    ],
    specialInstructions: [
      'Manter refrigeração adequada quando aplicável',
    ],
  },
  CARGA_FRIGORIFICADA: {
    cargoType: 'CARGA_FRIGORIFICADA',
    label: 'Carga Frigorificada',
    description: 'Carnes, laticínios, produtos congelados',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e da carga' },
      { type: 'CERTIFICADO_SANITARIO', label: 'SIF/SIE/SIM', mandatory: true, description: 'Selo de Inspeção Federal/Estadual/Municipal' },
    ],
    specialInstructions: [
      'Manter cadeia de frio',
      'Registrar temperatura durante transporte',
    ],
  },
  CARGA_GERAL: {
    cargoType: 'CARGA_GERAL',
    label: 'Carga Geral',
    description: 'Mercadorias diversas',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e da carga' },
    ],
  },
  MUDANCA: {
    cargoType: 'MUDANCA',
    label: 'Mudança Residencial',
    description: 'Móveis e pertences pessoais',
    requiredDocuments: [
      { type: 'OUTROS', label: 'Declaração de Bens', mandatory: false, description: 'Lista de itens transportados' },
    ],
  },
  VEICULOS: {
    cargoType: 'VEICULOS',
    label: 'Veículos',
    description: 'Transporte de veículos novos ou usados',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e de venda ou transferência' },
      { type: 'CRLV', label: 'CRLV', mandatory: true, description: 'Documento do veículo transportado' },
    ],
  },
  MAQUINAS_AGRICOLAS: {
    cargoType: 'MAQUINAS_AGRICOLAS',
    label: 'Máquinas Agrícolas',
    description: 'Tratores, colheitadeiras, implementos',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e da máquina' },
    ],
    specialInstructions: [
      'Verificar necessidade de AET (Autorização Especial de Trânsito)',
      'Carga com dimensões especiais pode exigir escolta',
    ],
  },
  PRODUTOS_PERIGOSOS: {
    cargoType: 'PRODUTOS_PERIGOSOS',
    label: 'Produtos Perigosos',
    description: 'Químicos, inflamáveis, corrosivos',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e com classificação de risco' },
      { type: 'MOPP', label: 'MOPP', mandatory: true, description: 'Movimentação de Produtos Perigosos - motorista' },
      { type: 'ANVISA', label: 'Autorização ANVISA', mandatory: false, description: 'Para produtos controlados' },
    ],
    specialInstructions: [
      'Motorista com curso MOPP válido',
      'Veículo com sinalização de risco',
      'Ficha de Emergência obrigatória',
    ],
  },
  OUTROS: {
    cargoType: 'OUTROS',
    label: 'Outros',
    description: 'Outros tipos de carga',
    requiredDocuments: [
      { type: 'NOTA_FISCAL', label: 'Nota Fiscal', mandatory: true, description: 'NF-e quando aplicável' },
    ],
  },
};

/**
 * Lista de tipos de carga para select
 */
export const CARGO_TYPES_SELECT = Object.entries(CARGO_COMPLIANCE_RULES).map(([value, rule]) => ({
  value: value as CargoType,
  label: rule.label,
  requiresGTA: rule.gtaModel !== undefined,
}));

/**
 * Tipos de carga que requerem GTA
 */
export const LIVE_CARGO_TYPES: CargoType[] = [
  'GADO_VIVO',
  'BOVINOS',
  'SUINOS',
  'AVES',
  'EQUINOS',
  'CAPRINOS_OVINOS',
  'ANIMAIS_SILVESTRES',
];

/**
 * Verifica se o tipo de carga requer GTA
 */
export function requiresGTA(cargoType: CargoType): boolean {
  return LIVE_CARGO_TYPES.includes(cargoType);
}

/**
 * Obtém o modelo de GTA exigido para o tipo de carga
 */
export function getRequiredGTAModel(cargoType: CargoType): 'A' | 'B' | 'BOTH' | null {
  const rule = CARGO_COMPLIANCE_RULES[cargoType];
  return rule?.gtaModel || null;
}

/**
 * Verifica compliance de documentação para um frete
 */
export function checkFreightCompliance(
  cargoType: CargoType,
  uploadedDocuments: { type: DocumentType; isValid: boolean }[]
): {
  isCompliant: boolean;
  missingDocuments: string[];
  uploadedCount: number;
  requiredCount: number;
} {
  const rule = CARGO_COMPLIANCE_RULES[cargoType];
  if (!rule) {
    return {
      isCompliant: true,
      missingDocuments: [],
      uploadedCount: 0,
      requiredCount: 0,
    };
  }

  const mandatoryDocs = rule.requiredDocuments.filter(d => d.mandatory);
  const missingDocuments: string[] = [];

  for (const required of mandatoryDocs) {
    const found = uploadedDocuments.find(
      u => u.type === required.type && u.isValid
    );
    if (!found) {
      missingDocuments.push(required.label);
    }
  }

  return {
    isCompliant: missingDocuments.length === 0,
    missingDocuments,
    uploadedCount: uploadedDocuments.filter(d => d.isValid).length,
    requiredCount: mandatoryDocs.length,
  };
}
