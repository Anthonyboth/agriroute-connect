/**
 * Verificador de Aptidão Fiscal
 * 
 * Verifica se o usuário está apto a emitir documentos fiscais
 * ANTES de cobrar PIX e ANTES de chamar SEFAZ
 * 
 * Usa dados já existentes no banco (fiscal_issuers, fiscal_certificates, etc.)
 * SEM criar tabelas novas
 */

import { DocumentType } from './fiscal-requirements';
import { FiscalProfileType, canEmitDocument, EligibilityStatus } from './fiscal-eligibility-rules';

export interface AptidaoCheckResult {
  isApto: boolean;
  status: 'OK' | 'PENDENTE' | 'BLOQUEADO';
  blockers: AptidaoIssue[];
  warnings: AptidaoIssue[];
  canProceedWithWarnings: boolean;
}

export interface AptidaoIssue {
  id: string;
  title: string;
  description: string;
  severity: 'blocker' | 'warning' | 'info';
  action?: string;
  link?: { label: string; url: string };
}

export interface FiscalIssuerData {
  id?: string;
  cnpj_cpf?: string;
  razao_social?: string;
  uf?: string;
  inscricao_estadual?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  cep?: string;
  onboarding_completed?: boolean;
  sefaz_status?: string;
  fiscal_ambiente?: 'homologacao' | 'producao';
  blocked_at?: string;
  block_reason?: string;
}

export interface FiscalCertificateData {
  id?: string;
  issuer_id?: string;
  is_valid?: boolean;
  is_expired?: boolean;
  valid_until?: string;
  storage_path?: string;
  subject_cn?: string;
}

export interface CheckAptidaoParams {
  fiscalIssuer: FiscalIssuerData | null;
  fiscalCertificate: FiscalCertificateData | null;
  documentType: DocumentType;
  fiscalProfile?: FiscalProfileType;
  isMei?: boolean;
}

/**
 * Verifica aptidão fiscal completa
 */
export function checkAptidaoFiscal(params: CheckAptidaoParams): AptidaoCheckResult {
  const { fiscalIssuer, fiscalCertificate, documentType, fiscalProfile, isMei } = params;
  
  const blockers: AptidaoIssue[] = [];
  const warnings: AptidaoIssue[] = [];
  
  // ============= 1. VERIFICAR EMISSOR FISCAL =============
  if (!fiscalIssuer) {
    blockers.push({
      id: 'no_issuer',
      title: 'Emissor fiscal não configurado',
      description: 'Você precisa configurar seu emissor fiscal antes de emitir documentos.',
      severity: 'blocker',
      action: 'Acesse a aba "Emissor" e preencha seus dados.',
    });
  } else {
    // Verificar se está bloqueado
    if (fiscalIssuer.blocked_at) {
      blockers.push({
        id: 'issuer_blocked',
        title: 'Emissor fiscal bloqueado',
        description: fiscalIssuer.block_reason || 'Seu emissor está temporariamente bloqueado.',
        severity: 'blocker',
        action: 'Entre em contato com o suporte para desbloquear.',
      });
    }
    
    // Verificar CNPJ/CPF
    if (!fiscalIssuer.cnpj_cpf) {
      blockers.push({
        id: 'no_document',
        title: 'CNPJ/CPF não informado',
        description: 'O documento (CNPJ ou CPF) é obrigatório para emissão.',
        severity: 'blocker',
        action: 'Preencha o campo CNPJ ou CPF no emissor.',
      });
    }
    
    // Verificar UF
    if (!fiscalIssuer.uf) {
      blockers.push({
        id: 'no_uf',
        title: 'UF não informada',
        description: 'A unidade federativa é obrigatória.',
        severity: 'blocker',
        action: 'Selecione o estado (UF) no emissor.',
      });
    }
    
    // Verificar endereço
    if (!fiscalIssuer.logradouro || !fiscalIssuer.cep) {
      blockers.push({
        id: 'incomplete_address',
        title: 'Endereço incompleto',
        description: 'Logradouro e CEP são obrigatórios para emissão.',
        severity: 'blocker',
        action: 'Complete o endereço no emissor.',
      });
    }
    
    // Verificar IE (para documentos que exigem)
    const requiresIE = documentType !== 'NFSE' && documentType !== 'GTA';
    if (requiresIE && !fiscalIssuer.inscricao_estadual) {
      // Para MEI, é warning e não blocker
      if (isMei) {
        warnings.push({
          id: 'no_ie_mei',
          title: 'Inscrição Estadual não informada',
          description: 'MEI geralmente não precisa de IE para emitir NF-a. Para NF-e/CT-e, a IE é obrigatória.',
          severity: 'warning',
          action: 'Se pretende emitir NF-e, obtenha sua IE na SEFAZ.',
          link: { label: 'SINTEGRA', url: 'http://www.sintegra.gov.br/' },
        });
      } else {
        blockers.push({
          id: 'no_ie',
          title: 'Inscrição Estadual não informada',
          description: 'A IE é obrigatória para emissão de NF-e, CT-e e MDF-e.',
          severity: 'blocker',
          action: 'Obtenha sua IE na SEFAZ do seu estado.',
          link: { label: 'SINTEGRA', url: 'http://www.sintegra.gov.br/' },
        });
      }
    }
    
    // Verificar status SEFAZ
    if (fiscalIssuer.sefaz_status === 'rejected' || fiscalIssuer.sefaz_status === 'blocked') {
      blockers.push({
        id: 'sefaz_blocked',
        title: 'Emissor não habilitado na SEFAZ',
        description: 'Sua situação cadastral na SEFAZ está irregular.',
        severity: 'blocker',
        action: 'Verifique seu credenciamento no portal da SEFAZ.',
      });
    }
  }
  
  // ============= 2. VERIFICAR CERTIFICADO A1 =============
  // GTA e NF-a geralmente não precisam de certificado
  const requiresCertificate = documentType !== 'GTA';
  
  if (requiresCertificate) {
    if (!fiscalCertificate) {
      blockers.push({
        id: 'no_certificate',
        title: 'Certificado Digital A1 não enviado',
        description: 'O certificado A1 é obrigatório para emissão de documentos fiscais.',
        severity: 'blocker',
        action: 'Faça upload do arquivo .pfx ou .p12 na aba "Certificado".',
      });
    } else {
      // Verificar validade
      if (!fiscalCertificate.is_valid) {
        blockers.push({
          id: 'cert_invalid',
          title: 'Certificado inválido',
          description: 'O certificado enviado não passou na validação. Pode estar corrompido ou com senha incorreta.',
          severity: 'blocker',
          action: 'Reenvie o certificado com a senha correta.',
        });
      }
      
      if (fiscalCertificate.is_expired) {
        blockers.push({
          id: 'cert_expired',
          title: 'Certificado expirado',
          description: 'Seu certificado digital A1 está vencido.',
          severity: 'blocker',
          action: 'Adquira um novo certificado em uma certificadora credenciada.',
        });
      }
      
      // Verificar se vai expirar em breve
      if (fiscalCertificate.valid_until) {
        const expiryDate = new Date(fiscalCertificate.valid_until);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          warnings.push({
            id: 'cert_expiring_soon',
            title: `Certificado expira em ${daysUntilExpiry} dia(s)`,
            description: 'Providencie a renovação para evitar interrupções.',
            severity: 'warning',
            action: 'Renove seu certificado antes do vencimento.',
          });
        }
      }
      
      // Verificar se arquivo existe
      if (!fiscalCertificate.storage_path) {
        warnings.push({
          id: 'cert_no_file',
          title: 'Arquivo de certificado não encontrado',
          description: 'O registro existe mas o arquivo pode não ter sido salvo corretamente.',
          severity: 'warning',
          action: 'Tente reenviar o certificado.',
        });
      }
    }
  }
  
  // ============= 3. VERIFICAR ELEGIBILIDADE POR PERFIL =============
  if (fiscalProfile) {
    const eligibility = canEmitDocument(fiscalProfile, documentType);
    
    if (eligibility === 'NAO_APLICAVEL') {
      blockers.push({
        id: 'doc_not_applicable',
        title: 'Documento não aplicável ao seu perfil',
        description: `O documento ${documentType} não é utilizado para o perfil ${fiscalProfile}.`,
        severity: 'blocker',
        action: 'Verifique qual documento é adequado para sua atividade.',
      });
    }
    
    if (eligibility === 'DEPENDE' || eligibility === 'VOLUNTARIO') {
      if (isMei && (documentType === 'NFE' || documentType === 'CTE' || documentType === 'MDFE')) {
        warnings.push({
          id: 'mei_voluntary',
          title: 'Emissão voluntária para MEI',
          description: `MEI não é obrigado a emitir ${documentType}. Considere usar NF-a (Nota Fiscal Avulsa).`,
          severity: 'warning',
          action: 'Verifique se realmente precisa deste documento.',
        });
      }
    }
  }
  
  // ============= 4. VERIFICAR AMBIENTE =============
  if (fiscalIssuer?.fiscal_ambiente === 'producao') {
    // Em produção, avisar que é ambiente real
    warnings.push({
      id: 'producao_env',
      title: 'Ambiente de Produção',
      description: 'Os documentos emitidos terão validade fiscal real.',
      severity: 'info',
    });
  }
  
  // ============= CALCULAR RESULTADO =============
  const isApto = blockers.length === 0;
  const status: 'OK' | 'PENDENTE' | 'BLOQUEADO' = 
    blockers.length === 0 ? 'OK' :
    blockers.length <= 2 ? 'PENDENTE' : 'BLOQUEADO';
  
  return {
    isApto,
    status,
    blockers,
    warnings,
    canProceedWithWarnings: isApto,
  };
}

/**
 * Formata mensagem resumida do status
 */
export function getAptidaoStatusMessage(result: AptidaoCheckResult): string {
  if (result.isApto && result.warnings.length === 0) {
    return '✅ Você está apto a emitir documentos fiscais.';
  }
  if (result.isApto && result.warnings.length > 0) {
    return `⚠️ Você pode emitir, mas há ${result.warnings.length} aviso(s) a considerar.`;
  }
  if (result.blockers.length === 1) {
    return `❌ Há 1 pendência que impede a emissão.`;
  }
  return `❌ Há ${result.blockers.length} pendências que impedem a emissão.`;
}

/**
 * Diagnóstico de certificado "enviou mas não consta"
 */
export interface CertificateDiagnostic {
  issue: string;
  probableCause: string;
  solution: string;
}

export function diagnoseCertificateIssue(
  fiscalIssuer: FiscalIssuerData | null,
  fiscalCertificate: FiscalCertificateData | null,
  uploadAttempted: boolean
): CertificateDiagnostic | null {
  if (!uploadAttempted) return null;
  
  if (!fiscalCertificate) {
    return {
      issue: 'Certificado não encontrado após upload',
      probableCause: 'O arquivo foi enviado mas o registro não foi salvo no banco.',
      solution: 'Tente reenviar o certificado. Verifique se o arquivo é válido (.pfx ou .p12) e a senha está correta.',
    };
  }
  
  if (fiscalCertificate && !fiscalCertificate.is_valid) {
    return {
      issue: 'Certificado marcado como inválido',
      probableCause: 'A senha informada pode estar incorreta ou o arquivo está corrompido.',
      solution: 'Reenvie o certificado com a senha correta. Teste o certificado em outro software antes.',
    };
  }
  
  if (fiscalCertificate && fiscalIssuer && fiscalCertificate.issuer_id !== fiscalIssuer.id) {
    return {
      issue: 'Certificado não vinculado ao emissor atual',
      probableCause: 'O certificado foi enviado para outro emissor.',
      solution: 'Selecione o emissor correto ou reenvie o certificado.',
    };
  }
  
  if (fiscalCertificate && !fiscalCertificate.storage_path) {
    return {
      issue: 'Arquivo não encontrado no storage',
      probableCause: 'O upload pode ter falhado silenciosamente.',
      solution: 'Tente reenviar o certificado. Se o problema persistir, contate o suporte.',
    };
  }
  
  return null;
}
