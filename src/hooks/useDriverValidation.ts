/**
 * Hook para validação de perfil de motorista
 * IMPORTANTE: Esta validação é para o PERFIL PESSOAL do motorista.
 * Validações de VEÍCULOS são feitas separadamente, APÓS a aprovação do cadastro.
 */
export interface DriverValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
  score: number;
}

export const useDriverValidation = (driver: any): DriverValidationResult => {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // ========== DOCUMENTOS PESSOAIS OBRIGATÓRIOS ==========
  // Estes são validados durante o onboarding
  
  // Foto de perfil/selfie
  if (!driver?.profile_photo_url && !driver?.selfie_url) {
    missingFields.push('Foto de perfil');
  }
  
  // CPF/CNPJ
  if (!driver?.cpf_cnpj && !driver?.document) {
    missingFields.push('CPF/CNPJ');
  }
  
  // CNH (obrigatória para motoristas)
  if (!driver?.cnh_photo_url) {
    missingFields.push('Foto da CNH');
  }
  
  // ========== AVISOS (não bloqueantes) ==========
  
  // RNTRC é opcional - muitos motoristas não possuem inicialmente
  if (!driver?.rntrc) {
    warnings.push('RNTRC não informado (opcional)');
  }
  
  // Status de validação são informativos, não bloqueantes
  if (driver?.cnh_validation_status !== 'APPROVED') {
    warnings.push('CNH ainda não validada pelo sistema');
  }
  
  if (driver?.document_validation_status !== 'APPROVED') {
    warnings.push('Documentos ainda não validados');
  }
  
  // Verificar vencimento da CNH (bloqueante apenas se já vencida)
  if (driver?.cnh_expiry_date) {
    const expiryDate = new Date(driver.cnh_expiry_date);
    const today = new Date();
    if (expiryDate < today) {
      missingFields.push('CNH vencida');
    }
  }
  
  // ========== VEÍCULOS NÃO SÃO VALIDADOS AQUI ==========
  // Veículos são cadastrados e validados APÓS a aprovação do perfil,
  // na aba de Veículos do painel interno do motorista.
  // NÃO adicionar validações de placa_cavalo, veiculo, etc. neste hook.
  
  const score = calculateProfileScore(driver);
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
    score,
  };
};

/**
 * Calcula pontuação do perfil para gamificação
 * Nota: Veículos contribuem para a pontuação mas não são obrigatórios
 */
const calculateProfileScore = (driver: any): number => {
  if (!driver) return 0;
  
  let score = 0;
  
  // Foto de perfil (20 pontos)
  if (driver.profile_photo_url || driver.selfie_url) score += 20;
  
  // CNH (20 pontos)
  if (driver.cnh_photo_url) score += 20;
  
  // Documento (20 pontos)
  if (driver.cpf_cnpj || driver.document) score += 20;
  
  // RNTRC (10 pontos - reduzido pois é opcional)
  if (driver.rntrc) score += 10;
  
  // CNH validada (15 pontos)
  if (driver.cnh_validation_status === 'APPROVED') score += 15;
  
  // Documentos validados (15 pontos)
  if (driver.document_validation_status === 'APPROVED') score += 15;
  
  // Bônus: Veículo cadastrado (não obrigatório, mas dá pontos extras)
  // Isso incentiva o motorista a cadastrar veículos após aprovação
  // sem bloquear o onboarding
  
  return score;
};
