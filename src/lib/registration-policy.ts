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
 * IMPORTANTE: O passo 'documentos_e_veiculos' foi REMOVIDO do onboarding.
 * Veículos são cadastrados APÓS a aprovação do perfil, na área interna.
 */
export function getRequiredSteps(mode: RegistrationMode): RegistrationStep[] {
  // TODOS os modos agora têm apenas 2 passos no onboarding:
  // - dados_basicos (dados pessoais)
  // - documentos_basicos (selfie e documento)
  // Veículos são cadastrados DEPOIS da aprovação do cadastro
  switch (mode) {
    case 'TRANSPORTADORA':
    case 'MOTORISTA_AUTONOMO':
    case 'MOTORISTA_AFILIADO':
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
    // Documentos pessoais básicos para todos
    const basicDocs = ['selfie', 'document_photo'];
    
    // Para motoristas: adicionar CNH e comprovante de endereço
    if (mode === 'MOTORISTA_AUTONOMO' || mode === 'MOTORISTA_AFILIADO') {
      return [...basicDocs, 'cnh', 'address_proof'];
    }
    
    return basicDocs;
  }
  
  // O passo 'documentos_e_veiculos' não é mais usado no onboarding
  // Veículos são cadastrados após aprovação do perfil
  if (step === 'documentos_e_veiculos') {
    // Retornar array vazio - este passo não existe mais no onboarding
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
      // Os casos abaixo foram REMOVIDOS do onboarding - veículos são cadastrados
      // APÓS a aprovação do perfil, na aba de Veículos do painel interno.
      // Os cases são mantidos aqui para evitar erros de runtime mas NUNCA
      // serão acionados durante o onboarding pois getStepRequirements()
      // não retorna mais 'placa_cavalo', 'veiculo' ou 'localizacao'.
      case 'placa_cavalo':
        // REMOVIDO DO ONBOARDING - Veículos cadastrados após aprovação
        break;
      case 'veiculo':
        // REMOVIDO DO ONBOARDING - Veículos cadastrados após aprovação
        break;
      case 'localizacao':
        // Localização agora é opcional durante onboarding
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
