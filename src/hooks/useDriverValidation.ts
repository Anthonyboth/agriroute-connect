export interface DriverValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
  score: number;
}

export const useDriverValidation = (driver: any): DriverValidationResult => {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Campos obrigatórios
  if (!driver?.profile_photo_url && !driver?.selfie_url) {
    missingFields.push('Foto de perfil');
  }
  
  if (!driver?.cnh_photo_url) {
    missingFields.push('Foto da CNH');
  }
  
  if (!driver?.cpf_cnpj && !driver?.document) {
    missingFields.push('CPF/CNPJ');
  }
  
  // Avisos (não bloqueantes)
  if (!driver?.rntrc) {
    warnings.push('RNTRC não informado (opcional para autônomos)');
  }
  
  // Validações de status
  if (driver?.cnh_validation_status !== 'APPROVED') {
    warnings.push('CNH ainda não validada pelo sistema');
  }
  
  if (driver?.document_validation_status !== 'APPROVED') {
    warnings.push('Documentos ainda não validados');
  }
  
  // Verificar vencimento da CNH
  if (driver?.cnh_expiry_date) {
    const expiryDate = new Date(driver.cnh_expiry_date);
    const today = new Date();
    if (expiryDate < today) {
      missingFields.push('CNH vencida');
    }
  }
  
  const score = calculateProfileScore(driver);
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
    score,
  };
};

const calculateProfileScore = (driver: any): number => {
  if (!driver) return 0;
  
  let score = 0;
  
  // Foto de perfil (20 pontos)
  if (driver.profile_photo_url || driver.selfie_url) score += 20;
  
  // CNH (20 pontos)
  if (driver.cnh_photo_url) score += 20;
  
  // Documento (20 pontos)
  if (driver.cpf_cnpj || driver.document) score += 20;
  
  // RNTRC (15 pontos)
  if (driver.rntrc) score += 15;
  
  // CNH validada (15 pontos)
  if (driver.cnh_validation_status === 'APPROVED') score += 15;
  
  // Documentos validados (10 pontos)
  if (driver.document_validation_status === 'APPROVED') score += 10;
  
  return score;
};
