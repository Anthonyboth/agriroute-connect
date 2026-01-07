// Tipos para o Motor de Compliance Fiscal do AgriRoute

export type ComplianceStatus = 'OK' | 'WARNING' | 'BLOCKED';

export interface ComplianceIssue {
  id: string;
  type: 'nfe' | 'cte' | 'gta';
  severity: 'info' | 'warning' | 'error';
  message: string;
  legalBasis?: string;
  action?: string;
  actionLabel?: string;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  issues: ComplianceIssue[];
  legalBasis: string[];
  checklist: ComplianceChecklist;
}

export interface ComplianceChecklist {
  nfe: ChecklistItem;
  nfeManifestation: ChecklistItem;
  cte: ChecklistItem;
  gta: ChecklistItem;
}

export interface ChecklistItem {
  required: boolean;
  present: boolean;
  status: 'ok' | 'warning' | 'error' | 'not_required';
  label: string;
  description?: string;
}

export interface FreightComplianceData {
  // NF-e
  hasNfe: boolean;
  nfeManifested: boolean;
  nfeAccessKey?: string;
  
  // CT-e
  freightCharged: boolean;
  isThirdPartyTransporter: boolean;
  cteIssued: boolean;
  cteNumber?: string;
  
  // GTA
  hasLiveAnimals: boolean;
  gtaIssued: boolean;
  gtaNumber?: string;
  
  // Cargo info
  cargoType?: 'graos' | 'insumos' | 'gado' | 'leite' | 'madeira' | 'outros';
  originState?: string;
  destinationState?: string;
}

// Regras por tipo de carga
export const CARGO_COMPLIANCE_RULES: Record<string, { nfe: boolean; cte: 'required' | 'conditional'; gta: boolean }> = {
  'graos': { nfe: true, cte: 'conditional', gta: false },
  'insumos': { nfe: true, cte: 'conditional', gta: false },
  'gado': { nfe: true, cte: 'conditional', gta: true },
  'leite': { nfe: true, cte: 'required', gta: false },
  'madeira': { nfe: true, cte: 'required', gta: false },
  'outros': { nfe: true, cte: 'conditional', gta: false },
};

// Links oficiais
export const SEFAZ_LINKS = {
  portalNfe: 'https://www.nfe.fazenda.gov.br/portal/principal.aspx',
  manifestacao: 'https://www.nfe.fazenda.gov.br/portal/manifestacaoDestinatario.aspx',
  consultaNfe: 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx',
} as const;

// Tipos de manifestação assistida
export type AssistedManifestationType = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada';

export interface AssistedManifestationData {
  accessKey: string;
  manifestationType: AssistedManifestationType;
  portalRedirectAt?: string;
  userDeclarationAt?: string;
  manifestationMode: 'assisted';
}
