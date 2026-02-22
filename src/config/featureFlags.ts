// Feature flags para controle de funcionalidades do AgriRoute

export const FEATURE_FLAGS = {
  // CT-e - Emissão habilitada para produção
  enable_cte_emission: true,
  
  // GTA - Rastreamento
  enable_gta_tracking: true,
  
  // Alertas de compliance
  enable_compliance_alerts: true,
  
  // Motor de compliance fiscal
  enable_compliance_engine: true,
  
  // Manifestação assistida
  enable_assisted_manifestation: true,
  
  // Termo de responsabilidade fiscal
  enable_fiscal_responsibility_term: true,
  
  // Logs de auditoria fiscal
  enable_fiscal_audit_logs: true,

  // Emissão assistida de NFA-e para MEI
  enable_nfa_assisted_emission: true,

  // Cobrança por emissão de documento fiscal (NF-e, CT-e, MDF-e, NFS-e)
  // Desativado temporariamente - reativar quando Pagar.me estiver integrado
  enable_emission_billing: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}
