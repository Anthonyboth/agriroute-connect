/**
 * Hook para verificar se o usuário está pronto para emitir documentos fiscais
 * 
 * Valida todos os requisitos necessários antes de permitir a emissão:
 * - Certificado Digital A1 válido
 * - CNPJ/CPF ativo
 * - Endereço completo
 * - Inscrição Estadual (quando obrigatória)
 * - Credenciamento SEFAZ
 * - RNTRC (para CT-e e MDF-e)
 * - Veículo cadastrado (para MDF-e)
 * - Condutor cadastrado (para MDF-e)
 */

import { useMemo } from 'react';
import { 
  DocumentType, 
  Severity,
  getDocumentRequirements 
} from '@/lib/fiscal-requirements';

export interface EmissionBlocker {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  action: string;
  docTypes: DocumentType[];
}

export interface FiscalIssuerData {
  id?: string;
  // Campos legados (pt-BR)
  cnpj_cpf?: string;
  razao_social?: string;
  ie?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  codigo_ibge?: string;

  // Campos do schema atual (fiscal_issuers)
  document_number?: string;
  legal_name?: string;
  state_registration?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_zip_code?: string;
  city?: string;
  city_ibge_code?: string;
  status?: string;
  sefaz_status?: string;
  fiscal_environment?: string;
  rntrc?: string;
}

function onlyDigits(v: string | null | undefined) {
  return (v || '').replace(/\D/g, '');
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const v of values) {
    const s = (v || '').trim();
    if (s) return s;
  }
  return '';
}

export interface FiscalReadinessInput {
  issuer: FiscalIssuerData | null;
  hasCertificate: boolean;
  certificateExpiresAt?: string | null;
  hasVehicle: boolean;
  hasCondutor: boolean;
  userRole?: string;
}

export interface EmissionReadiness {
  // Status por tipo de documento
  canEmitNFe: boolean;
  canEmitCTe: boolean;
  canEmitMDFe: boolean;
  canUploadGTA: boolean;
  
  // Lista de bloqueadores
  blockers: EmissionBlocker[];
  warnings: EmissionBlocker[];
  
  // Resumo
  isFullyReady: boolean;
  readinessPercentage: number;
  missingRequirements: string[];
  
  // Helper para verificar documento específico
  canEmit: (docType: DocumentType) => boolean;
  getBlockersFor: (docType: DocumentType) => EmissionBlocker[];
}

/**
 * Hook principal para verificar prontidão de emissão fiscal
 */
export function useFiscalEmissionReadiness(input: FiscalReadinessInput): EmissionReadiness {
  return useMemo(() => {
    const { issuer, hasCertificate, certificateExpiresAt, hasVehicle, hasCondutor, userRole } = input;
    
    const blockers: EmissionBlocker[] = [];
    const warnings: EmissionBlocker[] = [];
    const missingRequirements: string[] = [];
    
    // ============= VERIFICAÇÕES BASE =============
    
    // 1. Emissor configurado
    const hasIssuer = !!issuer?.id;
    if (!hasIssuer) {
      blockers.push({
        id: 'no-issuer',
        title: 'Emissor não configurado',
        description: 'Configure seu emissor fiscal antes de emitir documentos.',
        severity: 'blocker',
        action: 'Acesse a aba "Emissor" e preencha seus dados fiscais.',
        docTypes: ['NFE', 'CTE', 'MDFE'],
      });
      missingRequirements.push('Emissor fiscal');
    }
    
    // 2. CNPJ/CPF válido
    const issuerDocDigits = onlyDigits(
      pickFirst(
        issuer?.cnpj_cpf,
        issuer?.document_number,
        // tolerância para eventuais formatos usados em outras telas
        (issuer as any)?.cpf_cnpj,
        (issuer as any)?.document
      )
    );
    const hasCnpjCpf = issuerDocDigits.length === 11 || issuerDocDigits.length === 14 || issuerDocDigits.length >= 11;
    if (hasIssuer && !hasCnpjCpf) {
      blockers.push({
        id: 'no-cnpj',
        title: 'CNPJ/CPF não informado',
        description: 'É obrigatório ter CNPJ ou CPF cadastrado para emissão fiscal.',
        severity: 'blocker',
        action: 'Edite os dados do emissor e informe seu CNPJ ou CPF.',
        docTypes: ['NFE', 'CTE', 'MDFE'],
      });
      missingRequirements.push('CNPJ/CPF');
    }
    
    // 3. Endereço completo
    const street = pickFirst(issuer?.logradouro, issuer?.address_street);
    const number = pickFirst(issuer?.numero, issuer?.address_number);
    const neighborhood = pickFirst(issuer?.bairro, issuer?.address_neighborhood);
    const city = pickFirst(issuer?.cidade, issuer?.city);
    const uf = pickFirst(issuer?.uf);
    const cepDigits = onlyDigits(pickFirst(issuer?.cep, issuer?.address_zip_code));

    const hasFullAddress = !!(street && number && neighborhood && city && uf && cepDigits);
    if (hasIssuer && !hasFullAddress) {
      blockers.push({
        id: 'incomplete-address',
        title: 'Endereço incompleto',
        description: 'Todos os campos de endereço são obrigatórios para emissão.',
        severity: 'blocker',
        action: 'Complete o endereço: logradouro, número, bairro, cidade, UF e CEP.',
        docTypes: ['NFE', 'CTE', 'MDFE'],
      });
      missingRequirements.push('Endereço completo');
    }
    
    // 4. Certificado Digital A1
    const certificateValid = checkCertificateValidity(hasCertificate, certificateExpiresAt, issuer);
    if (!certificateValid.isValid) {
      if (certificateValid.isExpired) {
        blockers.push({
          id: 'certificate-expired',
          title: 'Certificado Digital expirado',
          description: 'Seu certificado A1 expirou. Faça upload de um novo certificado válido.',
          severity: 'blocker',
          action: 'Atualize seu certificado na aba "Emissor".',
          docTypes: ['NFE', 'CTE', 'MDFE'],
        });
        missingRequirements.push('Certificado A1 válido');
      } else if (certificateValid.expiresSoon) {
        warnings.push({
          id: 'certificate-expiring',
          title: 'Certificado próximo do vencimento',
          description: `Seu certificado expira em ${certificateValid.daysUntilExpiry} dias.`,
          severity: 'warning',
          action: 'Providencie a renovação do certificado A1.',
          docTypes: ['NFE', 'CTE', 'MDFE'],
        });
      } else {
        blockers.push({
          id: 'no-certificate',
          title: 'Certificado Digital não enviado',
          description: 'O Certificado Digital A1 é obrigatório para emissão de documentos fiscais.',
          severity: 'blocker',
          action: 'Faça upload do seu certificado A1 (.pfx/.p12) na aba "Emissor".',
          docTypes: ['NFE', 'CTE', 'MDFE'],
        });
        missingRequirements.push('Certificado Digital A1');
      }
    }
    
    // 5. Inscrição Estadual (warning para NF-e, blocker para CT-e)
    const ieValue = pickFirst(issuer?.ie, issuer?.state_registration);
    const hasIE = !!ieValue && ieValue.trim().length > 0 && ieValue !== 'ISENTO';
    if (hasIssuer && !hasIE) {
      warnings.push({
        id: 'no-ie-nfe',
        title: 'Inscrição Estadual não informada',
        description: 'A IE pode ser necessária dependendo da sua atividade.',
        severity: 'warning',
        action: 'Verifique sua IE no SINTEGRA e cadastre no emissor.',
        docTypes: ['NFE'],
      });
      
      // Para CT-e, IE é obrigatória
      blockers.push({
        id: 'no-ie-cte',
        title: 'Inscrição Estadual obrigatória para CT-e',
        description: 'CT-e exige Inscrição Estadual de transportador.',
        severity: 'blocker',
        action: 'Cadastre sua IE de transportador no emissor.',
        docTypes: ['CTE'],
      });
      missingRequirements.push('Inscrição Estadual (CT-e)');
    }
    
    // ============= VERIFICAÇÕES ESPECÍFICAS CT-e/MDF-e =============
    
    // 6. RNTRC (obrigatório para CT-e e MDF-e)
    const hasRntrc = !!issuer?.rntrc && issuer.rntrc.trim().length > 0;
    if (!hasRntrc) {
      blockers.push({
        id: 'no-rntrc',
        title: 'RNTRC não cadastrado',
        description: 'O Registro Nacional de Transportadores é obrigatório para CT-e e MDF-e.',
        severity: 'blocker',
        action: 'Obtenha seu RNTRC na ANTT e cadastre no emissor.',
        docTypes: ['CTE', 'MDFE'],
      });
      missingRequirements.push('RNTRC');
    }
    
    // 7. Veículo cadastrado (obrigatório para MDF-e)
    if (!hasVehicle) {
      blockers.push({
        id: 'no-vehicle',
        title: 'Veículo não cadastrado',
        description: 'MDF-e exige pelo menos um veículo cadastrado com placa e RENAVAM.',
        severity: 'blocker',
        action: 'Cadastre seu veículo na seção de veículos.',
        docTypes: ['MDFE'],
      });
      missingRequirements.push('Veículo cadastrado');
    }
    
    // 8. Condutor cadastrado (obrigatório para MDF-e)
    if (!hasCondutor) {
      blockers.push({
        id: 'no-condutor',
        title: 'Condutor não cadastrado',
        description: 'MDF-e exige um condutor (motorista) com CPF e CNH válida.',
        severity: 'blocker',
        action: 'Cadastre o condutor com CPF e CNH.',
        docTypes: ['MDFE'],
      });
      missingRequirements.push('Condutor cadastrado');
    }
    
    // ============= STATUS SEFAZ =============
    
    // 9. Verificar status SEFAZ
    const validSefazStatuses = ['validated', 'production_enabled', 'homologation_enabled'];
    const validIssuerStatuses = ['active', 'certificate_uploaded', 'production_enabled', 'homologation_enabled'];
    
    const hasSefazValidation = 
      validSefazStatuses.includes(issuer?.sefaz_status || '') ||
      validIssuerStatuses.includes(issuer?.status || '');
    
    if (hasIssuer && hasCertificate && !hasSefazValidation) {
      warnings.push({
        id: 'pending-sefaz-validation',
        title: 'Validação SEFAZ pendente',
        description: 'Seu emissor ainda não foi validado pela SEFAZ.',
        severity: 'warning',
        action: 'Aguarde a validação ou verifique se há erros no certificado.',
        docTypes: ['NFE', 'CTE', 'MDFE'],
      });
    }
    
    // ============= CALCULAR PRONTIDÃO =============
    
    const nfeBlockers = blockers.filter(b => b.docTypes.includes('NFE'));
    const cteBlockers = blockers.filter(b => b.docTypes.includes('CTE'));
    const mdfeBlockers = blockers.filter(b => b.docTypes.includes('MDFE'));
    
    const canEmitNFe = nfeBlockers.length === 0;
    const canEmitCTe = cteBlockers.length === 0;
    const canEmitMDFe = mdfeBlockers.length === 0;
    const canUploadGTA = true; // GTA é upload externo, sempre permitido
    
    // Calcular porcentagem de prontidão
    const totalChecks = 8; // Total de verificações
    const passedChecks = totalChecks - missingRequirements.length;
    const readinessPercentage = Math.round((passedChecks / totalChecks) * 100);
    
    const isFullyReady = blockers.length === 0;
    
    // Helper functions
    const canEmit = (docType: DocumentType): boolean => {
      switch (docType) {
        case 'NFE': return canEmitNFe;
        case 'CTE': return canEmitCTe;
        case 'MDFE': return canEmitMDFe;
        case 'GTA': return canUploadGTA;
        default: return false;
      }
    };
    
    const getBlockersFor = (docType: DocumentType): EmissionBlocker[] => {
      return blockers.filter(b => b.docTypes.includes(docType));
    };
    
    return {
      canEmitNFe,
      canEmitCTe,
      canEmitMDFe,
      canUploadGTA,
      blockers,
      warnings,
      isFullyReady,
      readinessPercentage,
      missingRequirements,
      canEmit,
      getBlockersFor,
    };
  }, [input]);
}

/**
 * Verifica validade do certificado digital
 */
function checkCertificateValidity(
  hasCertificate: boolean,
  expiresAt: string | null | undefined,
  issuer: FiscalIssuerData | null
): {
  isValid: boolean;
  isExpired: boolean;
  expiresSoon: boolean;
  daysUntilExpiry: number;
} {
  // Verificar se tem certificado via status do emissor
  const validStatuses = [
    'certificate_uploaded',
    'active',
    'production_enabled',
    'homologation_enabled',
  ];
  const validSefazStatuses = ['validated', 'production_enabled', 'homologation_enabled'];
  
  const hasCertByStatus = 
    validStatuses.includes(issuer?.status || '') ||
    validSefazStatuses.includes(issuer?.sefaz_status || '');
  
  const hasAnyCertificate = hasCertificate || hasCertByStatus;
  
  if (!hasAnyCertificate) {
    return {
      isValid: false,
      isExpired: false,
      expiresSoon: false,
      daysUntilExpiry: 0,
    };
  }
  
  // Se não temos data de expiração, assumimos válido (pela presença do certificado)
  if (!expiresAt) {
    return {
      isValid: true,
      isExpired: false,
      expiresSoon: false,
      daysUntilExpiry: 365, // Assume 1 ano
    };
  }
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    isValid: daysUntilExpiry > 0,
    isExpired: daysUntilExpiry <= 0,
    expiresSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 30,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
  };
}

/**
 * Helper hook para uso simplificado com dados do contexto
 */
export function useSimpleFiscalReadiness(
  fiscalIssuer: FiscalIssuerData | null,
  vehicles: unknown[] | null,
  userRole?: string
): EmissionReadiness {
  const hasCertificate = !!(
    fiscalIssuer?.status === 'certificate_uploaded' ||
    fiscalIssuer?.status === 'active' ||
    fiscalIssuer?.status === 'production_enabled' ||
    fiscalIssuer?.sefaz_status === 'validated' ||
    fiscalIssuer?.sefaz_status === 'production_enabled' ||
    fiscalIssuer?.sefaz_status === 'homologation_enabled'
  );
  
  const hasVehicle = Array.isArray(vehicles) && vehicles.length > 0;
  
  // Para condutor, assumimos que o motorista logado é o condutor
  const hasCondutor = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(userRole || '');
  
  return useFiscalEmissionReadiness({
    issuer: fiscalIssuer,
    hasCertificate,
    hasVehicle,
    hasCondutor,
    userRole,
  });
}
