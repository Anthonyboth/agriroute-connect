export interface AffiliationValidationResult {
  isValid: boolean;
  canApprove: boolean;
  missingFields: string[];
  optionalFields: string[];
  hasAllDocuments: boolean;
  completionPercentage: number;
}

export const useAffiliationValidation = (driver: any): AffiliationValidationResult => {
  const missingFields: string[] = [];
  const optionalFields: string[] = [];
  
  // ✅ ÚNICO CAMPO OBRIGATÓRIO (já pedido no cadastro)
  if (!driver?.cpf_cnpj && !driver?.document) {
    missingFields.push('CPF/CNPJ');
  }
  
  // 📋 Campos OPCIONAIS (informativos, não bloqueiam)
  if (!driver?.profile_photo_url && !driver?.selfie_url) {
    optionalFields.push('Foto de perfil');
  }
  
  if (!driver?.cnh_photo_url) {
    optionalFields.push('CNH');
  }
  
  if (!driver?.rntrc) {
    optionalFields.push('RNTRC');
  }
  
  // ✅ SEMPRE válido para afiliação (transportadora decide)
  return {
    isValid: true,  // SEMPRE TRUE
    canApprove: true,  // SEMPRE TRUE
    missingFields,  // Apenas CPF se faltar
    optionalFields,  // Lista de documentos opcionais
    hasAllDocuments: optionalFields.length === 0,
    completionPercentage: calculateCompletion(driver)
  };
};

// Cálculo de completude SEM bloquear aprovação
const calculateCompletion = (driver: any): number => {
  if (!driver) return 0;
  
  let total = 0;
  let completed = 0;
  
  // Dados básicos (sempre tem)
  if (driver?.full_name) { completed++; total++; }
  if (driver?.email) { completed++; total++; }
  if (driver?.contact_phone) { completed++; total++; }
  if (driver?.cpf_cnpj || driver?.document) { completed++; total++; }
  
  // Dados opcionais
  total += 3;  // Foto, CNH, RNTRC
  if (driver?.profile_photo_url || driver?.selfie_url) completed++;
  if (driver?.cnh_photo_url) completed++;
  if (driver?.rntrc) completed++;
  
  return Math.round((completed / total) * 100);
};
