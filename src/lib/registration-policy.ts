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
 * IMPORTANTE: Documentos de VEÍCULOS (placa do cavalo, fotos de veículo) foram REMOVIDOS do onboarding.
 * Veículos são cadastrados APÓS a aprovação do perfil, na área interna.
 * 
 * MOTORISTAS têm 3 etapas:
 * 1. dados_basicos - Informações pessoais
 * 2. documentos_basicos - Selfie e foto do documento
 * 3. documentos_motorista - CNH, comprovante de endereço, termos (SEM documentos de veículo)
 */
export function getRequiredSteps(mode: RegistrationMode): RegistrationStep[] {
  switch (mode) {
    // Motoristas precisam de 3 etapas (mas SEM documentos de veículo no step 3)
    case 'MOTORISTA_AUTONOMO':
    case 'MOTORISTA_AFILIADO':
      return ['dados_basicos', 'documentos_basicos', 'documentos_e_veiculos'];
    
    // Demais perfis: apenas 2 etapas
    case 'TRANSPORTADORA':
    case 'PRODUTOR':
    case 'PRESTADOR':
    default:
      return ['dados_basicos', 'documentos_basicos'];
  }
}

/**
 * Retorna os campos obrigatórios para cada passo/modo
 * IMPORTANTE: Requisitos de veículos (placa_cavalo, veiculo) foram REMOVIDOS
 * do onboarding. Motoristas cadastram veículos após aprovação do perfil.
 */
export function getStepRequirements(
  mode: RegistrationMode,
  step: RegistrationStep
): string[] {
  if (step === 'dados_basicos') {
    const base = ['full_name', 'phone', 'cpf_cnpj', 'fixed_address'];
    
    // RNTRC opcional durante onboarding - pode ser adicionado depois
    // (muitos motoristas não possuem RNTRC inicialmente)
    return base;
  }
  
  if (step === 'documentos_basicos') {
    // Documentos pessoais básicos para todos (selfie e documento)
    // Para motoristas, CNH e comprovante vão no step 3
    return ['selfie', 'document_photo'];
  }
  
  // O passo 'documentos_e_veiculos' agora é para DOCUMENTOS DE MOTORISTA (CNH, endereço)
  // SEM documentos de veículo - veículos são cadastrados após aprovação do perfil
  if (step === 'documentos_e_veiculos') {
    // Para motoristas: CNH, comprovante de endereço, localização
    if (mode === 'MOTORISTA_AUTONOMO' || mode === 'MOTORISTA_AFILIADO') {
      return ['cnh', 'address_proof', 'localizacao'];
    }
    return [];
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
      // Localização é obrigatória para motoristas no step 3
      case 'localizacao':
        if (!state.locationEnabled) missing.push('Permissão de localização');
        break;
      // Os casos abaixo foram REMOVIDOS do onboarding - veículos são cadastrados
      // APÓS a aprovação do perfil, na aba de Veículos do painel interno.
      case 'placa_cavalo':
        // REMOVIDO DO ONBOARDING - Veículos cadastrados após aprovação
        break;
      case 'veiculo':
        // REMOVIDO DO ONBOARDING - Veículos cadastrados após aprovação
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
