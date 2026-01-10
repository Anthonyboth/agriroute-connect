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
  gtaValidUntil?: string;
  
  // Cargo info
  cargoType?: 'graos' | 'insumos' | 'gado' | 'leite' | 'madeira' | 'outros';
  originState?: string;
  destinationState?: string;
  
  // Freight info
  freightId?: string;
  freightStatus?: string;
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
  portalCte: 'https://www.cte.fazenda.gov.br/portal/principal.aspx',
  consultaCte: 'https://www.cte.fazenda.gov.br/portal/consultaRecaptcha.aspx',
} as const;

// Tipos de manifestação assistida
export type AssistedManifestationType = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada';

export interface AssistedManifestationData {
  accessKey: string;
  manifestationType: AssistedManifestationType;
  portalRedirectAt?: string;
  userDeclarationAt?: string;
  manifestationMode: 'assisted';
  justification?: string;
}

// ========== GTA Types ==========
export interface GTADocument {
  id: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  originState: string;
  destinationState: string;
  originProperty?: string;
  destinationProperty?: string;
  animalCount: number;
  animalSpecies: string;
  issuingAgency: string;
  model: string;
  status: 'valid' | 'expired' | 'cancelled';
  freightId?: string;
  createdBy: string;
  createdAt: string;
}

export interface GTAStateRule {
  id: string;
  stateCode: string;
  stateName: string;
  gtaPortalUrl: string;
  validityDays: number;
  requiresVeterinaryInspection: boolean;
  requiresTransitVisa: boolean;
  allowsDigitalGta: boolean;
  notes?: string;
}

// ========== Audit Types ==========
export interface ComplianceAuditEvent {
  id: string;
  eventType: string;
  eventCategory: 'nfe' | 'cte' | 'gta' | 'fiscal' | 'system';
  actorId: string;
  actorName?: string;
  actorRole?: string;
  freightId?: string;
  eventData: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
  };
  createdAt: string;
}

// ========== Fiscal Term Types ==========
export interface FiscalResponsibilityAcceptance {
  id: string;
  userId: string;
  acceptedAt: string;
  termVersion: string;
  ipAddress?: string;
  userAgent?: string;
}

// ========== Compliance Summary ==========
export interface FreightComplianceSummary {
  freightId: string;
  overallStatus: ComplianceStatus;
  nfeStatus: 'complete' | 'pending' | 'missing';
  cteStatus: 'complete' | 'pending' | 'not_required' | 'missing';
  gtaStatus: 'valid' | 'expired' | 'not_required' | 'missing';
  issues: ComplianceIssue[];
  lastCheckedAt: string;
}
