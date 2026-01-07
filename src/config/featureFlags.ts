// Feature flags para controle de funcionalidades do AgriRoute

export const FEATURE_FLAGS = {
  // CT-e - Emissão futura (desligado por padrão)
  enable_cte_emission: false,
  
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
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}
