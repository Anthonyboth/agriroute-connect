/**
 * Política centralizada de requisitos de cadastro por tipo de conta
 * Define o que é obrigatório para cada tipo de usuário
 */

export type RegistrationMode = 
  | 'TRANSPORTADORA' 
  | 'MOTORISTA_AUTONOMO' 
  | 'MOTORISTA_AFILIADO' 
  | 'PRODUTOR' 
  | 'PRESTADOR';

export type RegistrationStep = 
  | 'dados_basicos' 
  | 'documentos_basicos' 
  | 'documentos_e_veiculos';

export interface RegistrationState {
  profileData: {
    full_name?: string;
    phone?: string;
    cpf_cnpj?: string;
    fixed_address?: string;
    rntrc?: string;
    cnh_expiry_date?: string;
  };
  documentUrls: {
    selfie?: string;
    document_photo?: string;
    cnh?: string;
    address_proof?: string;
  };
  platePhotos?: Array<{ type: string; url: string }>;
  vehicles?: any[];
  skipVehicleRegistration?: boolean;
  locationEnabled?: boolean;
}

/**
 * Determina o modo de cadastro baseado no perfil e contexto
 */
export function getRegistrationMode(
  profile: any,
  authUser: any,
  company: any,
  isCompanyDriver: boolean
): RegistrationMode {
  // Transportadora: tem registro em transport_companies ou role TRANSPORTADORA
  if (profile?.role === 'TRANSPORTADORA' || company) {
    return 'TRANSPORTADORA';
  }
  
  // Motorista afiliado: role MOTORISTA_AFILIADO ou é driver de empresa
  if (profile?.role === 'MOTORISTA_AFILIADO' || (profile?.role === 'MOTORISTA' && isCompanyDriver)) {
    return 'MOTORISTA_AFILIADO';
  }
  
  // Motorista autônomo: role MOTORISTA e não afiliado
  if (profile?.role === 'MOTORISTA' && !isCompanyDriver) {
    return 'MOTORISTA_AUTONOMO';
  }
  
  // Produtor
  if (profile?.role === 'PRODUTOR') {
    return 'PRODUTOR';
  }
  
  // Prestador de serviços
  if (profile?.role === 'PRESTADOR_SERVICOS') {
    return 'PRESTADOR';
  }
  
  // Fallback: verificar metadata do auth user
  if (authUser?.user_metadata?.is_transport_company === true) {
    return 'TRANSPORTADORA';
  }
  
  // Default
  return 'PRODUTOR';
}

/**
 * Retorna os passos necessários para cada modo
 */
export function getRequiredSteps(mode: RegistrationMode): RegistrationStep[] {
  switch (mode) {
    case 'TRANSPORTADORA':
      return ['dados_basicos', 'documentos_basicos'];
    
    case 'MOTORISTA_AUTONOMO':
      return ['dados_basicos', 'documentos_basicos', 'documentos_e_veiculos'];
    
    case 'MOTORISTA_AFILIADO':
      return ['dados_basicos', 'documentos_basicos'];
    
    case 'PRODUTOR':
    case 'PRESTADOR':
      return ['dados_basicos', 'documentos_basicos'];
    
    default:
      return ['dados_basicos', 'documentos_basicos'];
  }
}

/**
 * Retorna os campos obrigatórios para cada passo/modo
 */
export function getStepRequirements(
  mode: RegistrationMode,
  step: RegistrationStep
): string[] {
  if (step === 'dados_basicos') {
    const base = ['full_name', 'phone', 'cpf_cnpj', 'fixed_address'];
    
    if (mode === 'MOTORISTA_AUTONOMO' || mode === 'MOTORISTA_AFILIADO') {
      return [...base, 'rntrc'];
    }
    
    return base;
  }
  
  if (step === 'documentos_basicos') {
    // Todos precisam de selfie e documento com foto
    return ['selfie', 'document_photo'];
  }
  
  if (step === 'documentos_e_veiculos') {
    if (mode === 'MOTORISTA_AUTONOMO') {
      return ['cnh', 'address_proof', 'placa_cavalo', 'veiculo', 'localizacao'];
    }
  }
  
  return [];
}

/**
 * Verifica pendências para um passo específico
 */
export function getMissingForStep(
  mode: RegistrationMode,
  step: RegistrationStep,
  state: RegistrationState
): string[] {
  const requirements = getStepRequirements(mode, step);
  const missing: string[] = [];
  
  for (const req of requirements) {
    switch (req) {
      case 'full_name':
        if (!state.profileData.full_name?.trim()) missing.push('Nome completo');
        break;
      case 'phone':
        if (!state.profileData.phone?.trim()) missing.push('Telefone');
        break;
      case 'cpf_cnpj':
        if (!state.profileData.cpf_cnpj?.trim()) missing.push('CPF/CNPJ');
        break;
      case 'fixed_address':
        if (!state.profileData.fixed_address?.trim()) missing.push('Endereço');
        break;
      case 'rntrc':
        if (!state.profileData.rntrc?.trim()) missing.push('RNTRC');
        break;
      case 'selfie':
        if (!state.documentUrls.selfie) missing.push('Selfie');
        break;
      case 'document_photo':
        if (!state.documentUrls.document_photo) missing.push('Foto do documento');
        break;
      case 'cnh':
        if (!state.documentUrls.cnh) missing.push('CNH');
        break;
      case 'address_proof':
        if (!state.documentUrls.address_proof) missing.push('Comprovante de endereço');
        break;
      case 'placa_cavalo':
        const tractorPlate = state.platePhotos?.find(p => p.type === 'TRACTOR');
        if (!tractorPlate?.url) missing.push('Foto da placa do cavalo');
        break;
      case 'veiculo':
        if (!state.skipVehicleRegistration && (!state.vehicles || state.vehicles.length === 0)) {
          missing.push('Cadastro de pelo menos um veículo');
        }
        break;
      case 'localizacao':
        if (!state.locationEnabled) missing.push('Localização habilitada');
        break;
    }
  }
  
  return missing;
}

/**
 * Retorna mensagem de erro formatada para documentos faltando
 */
export function getDocumentsMissingMessage(mode: RegistrationMode, missing: string[]): string {
  const modeLabels: Record<RegistrationMode, string> = {
    'TRANSPORTADORA': 'para transportadora',
    'MOTORISTA_AUTONOMO': 'para motorista',
    'MOTORISTA_AFILIADO': 'para motorista afiliado',
    'PRODUTOR': 'para produtor',
    'PRESTADOR': 'para prestador de serviços'
  };
  
  return `Documentos faltando ${modeLabels[mode]}: ${missing.join(', ')}`;
}

/**
 * Valida vencimento de CNH (apenas para motoristas)
 */
export function validateCNHExpiry(mode: RegistrationMode, cnhExpiryDate: string | undefined): {
  valid: boolean;
  message?: string;
} {
  // CNH só é obrigatória para motoristas autônomos
  if (mode !== 'MOTORISTA_AUTONOMO') {
    return { valid: true };
  }
  
  if (!cnhExpiryDate) {
    return { valid: false, message: 'Data de vencimento da CNH é obrigatória' };
  }
  
  const expiryDate = new Date(cnhExpiryDate);
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return { valid: false, message: '❌ Sua CNH está vencida. Atualize antes de continuar.' };
  }
  
  if (daysUntilExpiry < 30) {
    return { valid: true, message: `⚠️ Sua CNH vence em ${daysUntilExpiry} dias. Renove em breve.` };
  }
  
  return { valid: true };
}
