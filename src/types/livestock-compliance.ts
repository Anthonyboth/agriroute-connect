// Tipos para o Módulo de Compliance Pecuário do AgriRoute

// =====================================================
// REGRAS POR ESTADO (UF)
// =====================================================

export type GTAFormat = 'eletronica' | 'mista' | 'fisica';

export interface GTAStateRule {
  id: string;
  uf: string;
  state_name: string;
  requires_gta: boolean;
  gta_format: GTAFormat;
  max_validity_hours: number;
  issuing_agency_code: string;
  issuing_agency_name: string;
  issuing_agency_url: string | null;
  portal_url: string | null;
  additional_requirements: AdditionalRequirement[];
  special_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdditionalRequirement {
  type: string;
  description: string;
  mandatory: boolean;
}

// =====================================================
// COMPLIANCE DE CARGA VIVA
// =====================================================

// Status com semântica jurídica (MAPA-grade)
export type LivestockComplianceStatus = 
  | 'pending' 
  | 'documents_required' 
  | 'validating' 
  | 'approved'        // mantido para compatibilidade -> internamente = COMPLIANT
  | 'blocked'         // mantido para compatibilidade -> internamente = NON_COMPLIANT
  | 'expired'
  | 'COMPLIANT'       // Em conformidade (semântica jurídica)
  | 'NON_COMPLIANT';  // Não conforme (semântica jurídica)

// Mapeamento de status para UI com semântica jurídica correta
export const COMPLIANCE_STATUS_LABELS: Record<LivestockComplianceStatus, string> = {
  pending: 'Pendente',
  documents_required: 'Documentação necessária',
  validating: 'Em validação',
  approved: 'Em conformidade (assistido)',
  blocked: 'Não conforme (documentação irregular)',
  expired: 'Expirado',
  COMPLIANT: 'Em conformidade (assistido)',
  NON_COMPLIANT: 'Não conforme (documentação irregular)',
};

// Cores para badges de status
export const COMPLIANCE_STATUS_COLORS: Record<LivestockComplianceStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  documents_required: 'bg-orange-100 text-orange-800 border-orange-300',
  validating: 'bg-blue-100 text-blue-800 border-blue-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  blocked: 'bg-red-100 text-red-800 border-red-300',
  expired: 'bg-gray-100 text-gray-800 border-gray-300',
  COMPLIANT: 'bg-green-100 text-green-800 border-green-300',
  NON_COMPLIANT: 'bg-red-100 text-red-800 border-red-300',
};

// Verificar se status permite transporte
export function isComplianceApproved(status: LivestockComplianceStatus): boolean {
  return status === 'approved' || status === 'COMPLIANT';
}

// Verificar se status é bloqueante
export function isComplianceBlocking(status: LivestockComplianceStatus): boolean {
  return status === 'blocked' || status === 'NON_COMPLIANT' || status === 'expired';
}

export type AnimalSpecies = 
  | 'bovinos' 
  | 'suinos' 
  | 'equinos' 
  | 'caprinos' 
  | 'ovinos' 
  | 'aves' 
  | 'outros';

export type TransportPurpose = 
  | 'abate' 
  | 'reproducao' 
  | 'engorda' 
  | 'exposicao' 
  | 'leilao' 
  | 'transferencia' 
  | 'outro';

export interface LivestockFreightCompliance {
  id: string;
  freight_id: string;
  animal_species: AnimalSpecies;
  animal_count: number;
  animal_category: string | null;
  animal_breed: string | null;
  origin_property_code: string | null;
  origin_property_name: string | null;
  destination_property_code: string | null;
  destination_property_name: string | null;
  transport_purpose: TransportPurpose;
  compliance_status: LivestockComplianceStatus;
  risk_score: number;
  gta_document_id: string | null;
  nfe_document_id: string | null;
  compliance_checklist: ComplianceChecklist;
  blocking_reasons: BlockingReason[];
  fraud_indicators: FraudIndicator[];
  approved_at: string | null;
  approved_by: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceChecklist {
  gta_uploaded?: boolean;
  gta_valid?: boolean;
  gta_not_expired?: boolean;
  nfe_uploaded?: boolean;
  nfe_valid?: boolean;
  origin_uf_match?: boolean;
  destination_uf_match?: boolean;
  animal_count_match?: boolean;
  purpose_match?: boolean;
}

export interface BlockingReason {
  type: string;
  severity: 'warning' | 'blocking';
  message: string;
  code?: string;
  legal_basis?: string;
}

// =====================================================
// FRAUDE E RISCO
// =====================================================

export type FraudIndicatorType = 
  | 'expired_gta'
  | 'invalid_gta'
  | 'quantity_mismatch'
  | 'uf_mismatch'
  | 'document_reused'
  | 'visual_alteration'
  | 'future_emission_date'
  | 'excessive_validity'
  | 'low_ocr_confidence'
  | 'suspicious_pattern';

export interface FraudIndicator {
  type: FraudIndicatorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  risk_points: number;
  detected_at: string;
}

export type RiskLevel = 'ok' | 'alert' | 'blocked';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  indicators: FraudIndicator[];
  recommendation: string;
}

// =====================================================
// VALIDAÇÃO OCR
// =====================================================

export interface GTAOCRExtractedData {
  document_number?: string;
  origin_uf?: string;
  destination_uf?: string;
  origin_property?: string;
  destination_property?: string;
  animal_count?: number;
  animal_species?: string;
  animal_category?: string;
  purpose?: string;
  emission_date?: string;
  expiry_date?: string;
  issuing_agency?: string;
  qr_code_data?: string;
  veterinarian_name?: string;
  veterinarian_crmv?: string;
}

export interface GTAOCRValidation {
  id: string;
  sanitary_document_id: string | null;
  livestock_compliance_id: string | null;
  ocr_raw_text: string | null;
  extracted_data: GTAOCRExtractedData;
  validation_result: GTAValidationResult;
  confidence_score: number;
  fraud_indicators: FraudIndicator[];
  risk_score: number;
  extraction_errors: OCRExtractionError[];
  validated_at: string;
  validated_by: string | null;
  created_at: string;
}

export interface GTAValidationResult {
  is_valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  matched_fields: string[];
  unmatched_fields: string[];
}

export interface ValidationIssue {
  field: string;
  expected?: string;
  found?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface OCRExtractionError {
  field: string;
  error: string;
  raw_value?: string;
}

// =====================================================
// AUDITORIA
// =====================================================

export type AuditEventCategory = 
  | 'document'
  | 'validation'
  | 'status_change'
  | 'blocking'
  | 'approval'
  | 'inspection'
  | 'fraud_detection'
  | 'system';

export interface ComplianceAuditEvent {
  id: string;
  freight_id: string | null;
  livestock_compliance_id: string | null;
  event_type: string;
  event_category: AuditEventCategory;
  event_data: Record<string, unknown>;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;
  gps_location: GPSLocation | null;
  created_at: string;
}

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

// =====================================================
// QR CODE DE FISCALIZAÇÃO
// =====================================================

export interface InspectionQRCode {
  id: string;
  freight_id: string;
  livestock_compliance_id: string | null;
  qr_code_hash: string;
  qr_code_data: InspectionQRData;
  generated_at: string;
  expires_at: string;
  access_count: number;
  last_accessed_at: string | null;
  last_accessed_by_ip: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InspectionQRData {
  freight_id: string;
  origin: {
    city: string;
    state: string;
  };
  destination: {
    city: string;
    state: string;
  };
  animal_species: string;
  animal_count: number;
  transport_purpose: string;
  gta_status: 'valid' | 'expired' | 'missing' | 'invalid';
  gta_number?: string;
  gta_expiry?: string;
  compliance_status: LivestockComplianceStatus;
  risk_score: number;
  driver_name?: string;
  vehicle_plate?: string;
  generated_at: string;
}

// =====================================================
// GTA ASSISTIDO (RASCUNHO)
// =====================================================

export type GTADraftStatus = 'draft' | 'redirected' | 'uploaded' | 'cancelled';

export interface GTAAssistedDraft {
  id: string;
  freight_id: string | null;
  user_id: string;
  origin_uf: string;
  destination_uf: string;
  animal_species: AnimalSpecies;
  animal_count: number;
  animal_category: string | null;
  transport_purpose: TransportPurpose;
  origin_property_data: PropertyData;
  destination_property_data: PropertyData;
  additional_data: Record<string, unknown>;
  redirected_to_portal_at: string | null;
  portal_url_used: string | null;
  gta_uploaded_at: string | null;
  status: GTADraftStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyData {
  code?: string;
  name?: string;
  owner_name?: string;
  owner_cpf_cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

// =====================================================
// OPÇÕES PARA SELECT
// =====================================================

export const ANIMAL_SPECIES_OPTIONS = [
  { value: 'bovinos', label: 'Bovinos', icon: '🐄' },
  { value: 'suinos', label: 'Suínos', icon: '🐷' },
  { value: 'equinos', label: 'Equinos', icon: '🐴' },
  { value: 'caprinos', label: 'Caprinos', icon: '🐐' },
  { value: 'ovinos', label: 'Ovinos', icon: '🐑' },
  { value: 'aves', label: 'Aves', icon: '🐔' },
  { value: 'outros', label: 'Outros', icon: '🐾' },
] as const;

export const TRANSPORT_PURPOSE_OPTIONS = [
  { value: 'abate', label: 'Abate' },
  { value: 'reproducao', label: 'Reprodução' },
  { value: 'engorda', label: 'Engorda' },
  { value: 'exposicao', label: 'Exposição/Feira' },
  { value: 'leilao', label: 'Leilão' },
  { value: 'transferencia', label: 'Transferência entre propriedades' },
  { value: 'outro', label: 'Outro' },
] as const;

export const BOVINE_CATEGORIES = [
  { value: 'bezerro', label: 'Bezerro(a)' },
  { value: 'novilho', label: 'Novilho(a)' },
  { value: 'garrote', label: 'Garrote' },
  { value: 'boi_gordo', label: 'Boi Gordo' },
  { value: 'vaca', label: 'Vaca' },
  { value: 'touro', label: 'Touro' },
  { value: 'reprodutor', label: 'Reprodutor(a)' },
] as const;

// =====================================================
// DISCLAIMERS LEGAIS (MAPA-GRADE)
// =====================================================

export const LEGAL_DISCLAIMERS = {
  GTA_NOT_ISSUER: 'O AgriRoute não emite Guia de Trânsito Animal (GTA). A emissão é de responsabilidade exclusiva do produtor junto ao órgão estadual competente.',
  
  ASSISTED_ONLY: 'Este é um assistente de preenchimento. Os dados aqui informados não têm valor legal e servem apenas para orientar o produtor.',
  
  FISCAL_SUPPORT: 'Ferramenta privada de apoio à fiscalização. A decisão administrativa cabe exclusivamente à autoridade fiscal competente.',
  
  USER_RESPONSIBILITY: 'O usuário declara que todas as informações e documentos anexados são verdadeiros, válidos e atuais, assumindo integral responsabilidade civil, administrativa e penal.',
  
  AI_PREVENTIVE: 'As validações realizadas por inteligência artificial têm caráter preventivo e não substituem a verificação oficial.',
  
  NO_OFFICIAL_VALIDATION: 'Este sistema NÃO realiza validação oficial de documentos sanitários. O status apresentado é apenas indicativo para fins de organização operacional.',
  
  COMPLIANCE_DISCLAIMER: 'A conformidade indicada refere-se à verificação interna de documentação anexada. Não substitui fiscalização oficial nem tem valor administrativo.',
} as const;

// =====================================================
// REGRAS INTERESTADUAIS
// =====================================================

export interface InterstateRule {
  id: string;
  origin_uf: string;
  destination_uf: string;
  animal_species: string | null;
  allowed: boolean;
  requires_additional_docs: boolean;
  additional_docs_list: string[] | null;
  notes: string | null;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
}

export interface InterstateRuleCheck {
  allowed: boolean;
  requiresAdditionalDocs: boolean;
  additionalDocs?: string[];
  notes?: string;
  ruleFound: boolean;
}

// =====================================================
// ALERTAS DE VENCIMENTO
// =====================================================

export interface ExpiryAlert {
  hasAlert: boolean;
  hoursRemaining: number | null;
  message: string | null;
  severity: 'warning' | 'critical' | null;
}
