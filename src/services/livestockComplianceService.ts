// Serviço de Compliance Pecuário - Motor de Regras e Validações

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type {
  GTAStateRule,
  LivestockFreightCompliance,
  LivestockComplianceStatus,
  AnimalSpecies,
  TransportPurpose,
  RiskAssessment,
  RiskLevel,
  FraudIndicator,
  GTAOCRExtractedData,
  ComplianceChecklist,
  BlockingReason,
  InspectionQRData,
} from '@/types/livestock-compliance';

// =====================================================
// CACHE DE REGRAS POR ESTADO
// =====================================================

let stateRulesCache: Map<string, GTAStateRule> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getStateRulesCache(): Promise<Map<string, GTAStateRule>> {
  const now = Date.now();
  
  if (stateRulesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return stateRulesCache;
  }

  const { data, error } = await supabase
    .from('gta_state_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Erro ao carregar regras de estado:', error);
    throw new Error('Não foi possível carregar as regras sanitárias');
  }

  stateRulesCache = new Map();
  for (const rule of data || []) {
    stateRulesCache.set(rule.uf, rule as unknown as GTAStateRule);
  }
  cacheTimestamp = now;

  return stateRulesCache;
}

// =====================================================
// FUNÇÕES PÚBLICAS - REGRAS POR ESTADO
// =====================================================

/**
 * Obtém as regras sanitárias de um estado específico
 */
export async function getStateRules(uf: string): Promise<GTAStateRule | null> {
  const cache = await getStateRulesCache();
  return cache.get(uf.toUpperCase()) || null;
}

/**
 * Obtém todas as regras sanitárias ativas
 */
export async function getAllStateRules(): Promise<GTAStateRule[]> {
  const cache = await getStateRulesCache();
  return Array.from(cache.values());
}

/**
 * Obtém a URL do portal estadual para emissão de GTA
 */
export async function getGTAPortalUrl(uf: string): Promise<string | null> {
  const rules = await getStateRules(uf);
  return rules?.portal_url || null;
}

/**
 * Obtém informações da agência emissora do estado
 */
export async function getIssuingAgency(uf: string): Promise<{
  code: string;
  name: string;
  url: string | null;
} | null> {
  const rules = await getStateRules(uf);
  if (!rules) return null;
  
  return {
    code: rules.issuing_agency_code,
    name: rules.issuing_agency_name,
    url: rules.issuing_agency_url,
  };
}

// =====================================================
// FUNÇÕES PÚBLICAS - COMPLIANCE DE FRETE
// =====================================================

/**
 * Verifica se um tipo de carga requer compliance pecuário
 */
export function requiresLivestockCompliance(cargoType: string): boolean {
  const livestockTypes = [
    'carga_viva',
    'bovinos',
    'suinos',
    'equinos',
    'caprinos',
    'ovinos',
    'aves',
    'animais_vivos',
  ];
  return livestockTypes.includes(cargoType.toLowerCase());
}

/**
 * Cria um registro de compliance para um frete de carga viva
 */
export async function createLivestockCompliance(data: {
  freight_id: string;
  animal_species: AnimalSpecies;
  animal_count: number;
  animal_category?: string;
  animal_breed?: string;
  origin_property_code?: string;
  origin_property_name?: string;
  destination_property_code?: string;
  destination_property_name?: string;
  transport_purpose: TransportPurpose;
}): Promise<LivestockFreightCompliance> {
  const { data: compliance, error } = await supabase
    .from('livestock_freight_compliance')
    .insert({
      ...data,
      compliance_status: 'documents_required',
      risk_score: 0,
      compliance_checklist: {} as Json,
      blocking_reasons: [] as Json,
      fraud_indicators: [] as Json,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar compliance:', error);
    throw new Error('Não foi possível criar o registro de compliance');
  }

  // Registrar evento de auditoria
  await logComplianceEvent(
    data.freight_id,
    compliance.id,
    'compliance_created',
    'status_change',
    { species: data.animal_species, count: data.animal_count }
  );

  return compliance as unknown as LivestockFreightCompliance;
}

/**
 * Obtém o compliance de um frete
 */
export async function getFreightCompliance(
  freightId: string
): Promise<LivestockFreightCompliance | null> {
  const { data, error } = await supabase
    .from('livestock_freight_compliance')
    .select('*')
    .eq('freight_id', freightId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar compliance:', error);
    throw new Error('Não foi possível buscar o compliance');
  }

  return data as unknown as LivestockFreightCompliance | null;
}

/**
 * Atualiza o status do compliance
 */
export async function updateComplianceStatus(
  complianceId: string,
  status: LivestockComplianceStatus,
  additionalData?: Partial<LivestockFreightCompliance>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    compliance_status: status,
    updated_at: new Date().toISOString(),
  };
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      if ((key === 'blocking_reasons' || key === 'fraud_indicators') && Array.isArray(value)) {
        updateData[key] = value as unknown as Json;
      } else {
        updateData[key] = value;
      }
    });
  }

  const { error } = await supabase
    .from('livestock_freight_compliance')
    .update(updateData as Record<string, Json | string | number | boolean | null>)
    .eq('id', complianceId);

  if (error) {
    console.error('Erro ao atualizar status:', error);
    throw new Error('Não foi possível atualizar o status');
  }
}

/**
 * Vincula documento GTA ao compliance
 */
export async function linkGTADocument(
  complianceId: string,
  documentId: string
): Promise<void> {
  const { error } = await supabase
    .from('livestock_freight_compliance')
    .update({
      gta_document_id: documentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', complianceId);

  if (error) {
    console.error('Erro ao vincular GTA:', error);
    throw new Error('Não foi possível vincular o documento');
  }
}

// =====================================================
// FUNÇÕES PÚBLICAS - VALIDAÇÃO E RISCO
// =====================================================

/**
 * Executa validação completa do compliance
 */
export async function validateCompliance(
  freightId: string
): Promise<{
  status: LivestockComplianceStatus;
  risk: RiskAssessment;
  checklist: ComplianceChecklist;
  blocking_reasons: BlockingReason[];
}> {
  const compliance = await getFreightCompliance(freightId);
  
  if (!compliance) {
    throw new Error('Compliance não encontrado');
  }

  const checklist: ComplianceChecklist = {};
  const blockingReasons: BlockingReason[] = [];
  const fraudIndicators: FraudIndicator[] = [];
  let riskScore = 0;

  // 1. Verificar GTA
  if (!compliance.gta_document_id) {
    checklist.gta_uploaded = false;
    blockingReasons.push({
      type: 'missing_gta',
      severity: 'blocking',
      message: 'GTA não anexada ao frete',
      legal_basis: 'Instrução Normativa MAPA nº 18/2006',
    });
    riskScore += 50;
  } else {
    checklist.gta_uploaded = true;
    
    // Verificar validade do documento
    const { data: gtaDoc } = await supabase
      .from('freight_sanitary_documents')
      .select('*')
      .eq('id', compliance.gta_document_id)
      .single();

    if (gtaDoc) {
      const isValid = gtaDoc.validation_status === 'valid';
      checklist.gta_valid = isValid;
      
      if (!isValid) {
        blockingReasons.push({
          type: 'invalid_gta',
          severity: 'blocking',
          message: 'GTA marcada como inválida',
        });
        riskScore += 40;
      }

      if (gtaDoc.expiry_date) {
        const expiresAt = new Date(gtaDoc.expiry_date);
        const now = new Date();
        
        checklist.gta_not_expired = expiresAt > now;
        
        if (expiresAt <= now) {
          blockingReasons.push({
            type: 'expired_gta',
            severity: 'blocking',
            message: 'GTA vencida',
          });
          fraudIndicators.push({
            type: 'expired_gta',
            severity: 'critical',
            message: 'Documento GTA com validade expirada',
            risk_points: 50,
            detected_at: new Date().toISOString(),
          });
          riskScore += 50;
        } else {
          // Alerta se vence em menos de 24h
          const hoursToExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursToExpiry < 24) {
            fraudIndicators.push({
              type: 'expired_gta',
              severity: 'medium',
              message: `GTA vence em ${Math.round(hoursToExpiry)} horas`,
              risk_points: 15,
              detected_at: new Date().toISOString(),
            });
            riskScore += 15;
          }
        }
      }
    }
  }

  // 2. Verificar NF-e (warning, não blocking)
  if (!compliance.nfe_document_id) {
    checklist.nfe_uploaded = false;
    blockingReasons.push({
      type: 'missing_nfe',
      severity: 'warning',
      message: 'NF-e não anexada',
    });
    riskScore += 10;
  } else {
    checklist.nfe_uploaded = true;
  }

  // Determinar status final
  const hasBlocking = blockingReasons.some(r => r.severity === 'blocking');
  let status: LivestockComplianceStatus = 'approved';
  
  if (hasBlocking) {
    status = 'blocked';
  } else if (blockingReasons.length > 0) {
    status = 'pending';
  }

  // Calcular nível de risco
  const riskLevel: RiskLevel = 
    riskScore >= 61 ? 'blocked' :
    riskScore >= 31 ? 'alert' : 'ok';

  const risk: RiskAssessment = {
    score: Math.min(riskScore, 100),
    level: riskLevel,
    indicators: fraudIndicators,
    recommendation: getRiskRecommendation(riskLevel),
  };

  // Atualizar compliance no banco
  await supabase
    .from('livestock_freight_compliance')
    .update({
      compliance_status: status,
      risk_score: risk.score,
      compliance_checklist: checklist as unknown as Json,
      blocking_reasons: blockingReasons as unknown as Json,
      fraud_indicators: fraudIndicators as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', compliance.id);

  return {
    status,
    risk,
    checklist,
    blocking_reasons: blockingReasons,
  };
}

/**
 * Verifica se o frete pode prosseguir para transporte
 */
export async function canProceedToTransport(freightId: string): Promise<{
  allowed: boolean;
  reasons: string[];
}> {
  const compliance = await getFreightCompliance(freightId);
  
  if (!compliance) {
    return {
      allowed: false,
      reasons: ['Registro de compliance não encontrado'],
    };
  }

  const blockingReasons = (compliance.blocking_reasons || [])
    .filter((r: BlockingReason) => r.severity === 'blocking')
    .map((r: BlockingReason) => r.message);

  return {
    allowed: compliance.compliance_status === 'approved',
    reasons: blockingReasons,
  };
}

/**
 * Calcula score de risco com base em dados extraídos por OCR
 */
export function calculateOCRRiskScore(
  extractedData: GTAOCRExtractedData,
  expectedData: Partial<{
    origin_uf: string;
    destination_uf: string;
    animal_count: number;
  }>,
  confidence: number
): RiskAssessment {
  const indicators: FraudIndicator[] = [];
  let score = 0;

  // 1. Confiança do OCR
  if (confidence < 60) {
    indicators.push({
      type: 'low_ocr_confidence',
      severity: 'medium',
      message: `Baixa confiança na leitura (${confidence.toFixed(0)}%)`,
      risk_points: 20,
      detected_at: new Date().toISOString(),
    });
    score += 20;
  }

  // 2. UF de origem
  if (expectedData.origin_uf && extractedData.origin_uf) {
    if (extractedData.origin_uf.toUpperCase() !== expectedData.origin_uf.toUpperCase()) {
      indicators.push({
        type: 'uf_mismatch',
        severity: 'high',
        message: `UF origem divergente: esperado ${expectedData.origin_uf}, encontrado ${extractedData.origin_uf}`,
        risk_points: 30,
        detected_at: new Date().toISOString(),
      });
      score += 30;
    }
  }

  // 3. UF de destino
  if (expectedData.destination_uf && extractedData.destination_uf) {
    if (extractedData.destination_uf.toUpperCase() !== expectedData.destination_uf.toUpperCase()) {
      indicators.push({
        type: 'uf_mismatch',
        severity: 'high',
        message: `UF destino divergente: esperado ${expectedData.destination_uf}, encontrado ${extractedData.destination_uf}`,
        risk_points: 30,
        detected_at: new Date().toISOString(),
      });
      score += 30;
    }
  }

  // 4. Quantidade de animais
  if (expectedData.animal_count && extractedData.animal_count) {
    const diff = Math.abs(expectedData.animal_count - extractedData.animal_count);
    if (diff > 0) {
      const severity: FraudIndicator['severity'] = diff > 5 ? 'high' : 'medium';
      indicators.push({
        type: 'quantity_mismatch',
        severity,
        message: `Quantidade divergente: esperado ${expectedData.animal_count}, encontrado ${extractedData.animal_count}`,
        risk_points: diff > 5 ? 25 : 15,
        detected_at: new Date().toISOString(),
      });
      score += diff > 5 ? 25 : 15;
    }
  }

  // 5. Data de emissão futura
  if (extractedData.emission_date) {
    const emissionDate = new Date(extractedData.emission_date);
    if (emissionDate > new Date()) {
      indicators.push({
        type: 'future_emission_date',
        severity: 'critical',
        message: 'Data de emissão no futuro',
        risk_points: 40,
        detected_at: new Date().toISOString(),
      });
      score += 40;
    }
  }

  // 6. Validade expirada
  if (extractedData.expiry_date) {
    const expiryDate = new Date(extractedData.expiry_date);
    if (expiryDate < new Date()) {
      indicators.push({
        type: 'expired_gta',
        severity: 'critical',
        message: 'GTA com validade expirada',
        risk_points: 50,
        detected_at: new Date().toISOString(),
      });
      score += 50;
    }
  }

  const level: RiskLevel = 
    score >= 61 ? 'blocked' :
    score >= 31 ? 'alert' : 'ok';

  return {
    score: Math.min(score, 100),
    level,
    indicators,
    recommendation: getRiskRecommendation(level),
  };
}

// =====================================================
// FUNÇÕES PÚBLICAS - QR CODE DE FISCALIZAÇÃO
// =====================================================

/**
 * Gera QR Code para fiscalização
 */
export async function generateInspectionQR(
  freightId: string,
  complianceId?: string
): Promise<{ hash: string; expiresAt: string }> {
  // Gerar hash único
  const hash = generateSecureHash();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // Buscar dados do frete
  const { data: freight } = await supabase
    .from('freights')
    .select(`
      id,
      origin_city,
      origin_state,
      destination_city,
      destination_state,
      driver:profiles!freights_driver_id_fkey(full_name),
      vehicle:vehicles(plate)
    `)
    .eq('id', freightId)
    .single();

  // Buscar compliance
  const compliance = await getFreightCompliance(freightId);

  const qrData: InspectionQRData = {
    freight_id: freightId,
    origin: {
      city: freight?.origin_city || '',
      state: freight?.origin_state || '',
    },
    destination: {
      city: freight?.destination_city || '',
      state: freight?.destination_state || '',
    },
    animal_species: compliance?.animal_species || '',
    animal_count: compliance?.animal_count || 0,
    transport_purpose: compliance?.transport_purpose || '',
    gta_status: compliance?.gta_document_id ? 
      (compliance.compliance_status === 'approved' ? 'valid' : 'invalid') : 'missing',
    compliance_status: compliance?.compliance_status || 'pending',
    risk_score: compliance?.risk_score || 0,
    driver_name: (freight?.driver as any)?.full_name,
    vehicle_plate: (freight?.vehicle as any)?.plate,
    generated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('inspection_qr_codes')
    .insert({
      freight_id: freightId,
      livestock_compliance_id: complianceId,
      qr_code_hash: hash,
      qr_code_data: qrData as unknown as Json,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Erro ao gerar QR:', error);
    throw new Error('Não foi possível gerar o QR Code');
  }

  return {
    hash,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Obtém dados do QR Code para fiscalização (público)
 */
export async function getInspectionData(
  hash: string
): Promise<InspectionQRData | null> {
  const { data, error } = await supabase
    .from('inspection_qr_codes')
    .select('*')
    .eq('qr_code_hash', hash)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Verificar expiração
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Incrementar contador de acessos
  await supabase
    .from('inspection_qr_codes')
    .update({
      access_count: (data.access_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', data.id);

  return data.qr_code_data as unknown as InspectionQRData;
}

// =====================================================
// FUNÇÕES PÚBLICAS - AUDITORIA
// =====================================================

/**
 * Registra evento de auditoria
 */
export async function logComplianceEvent(
  freightId: string | null,
  complianceId: string | null,
  eventType: string,
  category: string,
  eventData: Record<string, unknown> = {},
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.rpc('log_compliance_event', {
      p_freight_id: freightId,
      p_livestock_compliance_id: complianceId,
      p_event_type: eventType,
      p_event_category: category,
      p_event_data: eventData as Json,
      p_previous_state: (previousState || null) as Json,
      p_new_state: (newState || null) as Json,
    });
  } catch (error) {
    console.error('Erro ao registrar evento de auditoria:', error);
    // Não lançar erro para não interromper fluxo principal
  }
}

/**
 * Obtém histórico de auditoria de um frete
 */
export async function getComplianceAuditHistory(
  freightId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('compliance_audit_events')
    .select('*')
    .eq('freight_id', freightId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function getRiskRecommendation(level: RiskLevel): string {
  switch (level) {
    case 'ok':
      return 'Documentação em conformidade. Frete liberado para transporte.';
    case 'alert':
      return 'Atenção: Verificar pendências antes de prosseguir.';
    case 'blocked':
      return 'BLOQUEADO: Regularize a documentação para continuar.';
  }
}

function generateSecureHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  for (let i = 0; i < 32; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
