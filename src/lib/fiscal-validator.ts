/**
 * Validador de Pré-Emissão Fiscal
 * Verifica se o emissor atende aos requisitos mínimos para emitir documentos
 */

import { 
  DocumentType, 
  FiscalRequirement, 
  Severity,
  getDocumentRequirements 
} from './fiscal-requirements';

export interface ValidationResult {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: 'ok' | 'pending' | 'blocked';
  action?: string;
  links?: { label: string; url: string }[];
}

export interface IssuerData {
  id?: string;
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
  status?: string;
  sefaz_status?: string;
  fiscal_environment?: string;
  // Flags de verificação
  hasCertificate?: boolean;
  hasCredenciamento?: boolean;
  hasRntrc?: boolean;
  hasVehicle?: boolean;
  hasCondutor?: boolean;
}

export interface ValidationSummary {
  canEmit: boolean;
  blockers: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  oks: ValidationResult[];
  allResults: ValidationResult[];
}

/**
 * Valida se o emissor está pronto para emitir determinado documento
 */
export function validateIssuerReadiness(
  issuer: IssuerData | null,
  docType: DocumentType,
  uf: string
): ValidationSummary {
  const results: ValidationResult[] = [];
  const requirements = getDocumentRequirements(uf, docType);

  if (!issuer) {
    return {
      canEmit: false,
      blockers: [{
        id: 'no-issuer',
        title: 'Emissor não configurado',
        description: 'Você precisa configurar seu emissor fiscal antes de emitir documentos.',
        severity: 'blocker',
        status: 'blocked',
        action: 'Configure seu emissor na aba "Emissor".',
      }],
      warnings: [],
      infos: [],
      oks: [],
      allResults: [],
    };
  }

  for (const req of requirements) {
    const result = checkRequirement(issuer, req, docType);
    results.push(result);
  }

  const blockers = results.filter(r => r.status === 'blocked');
  const warnings = results.filter(r => r.severity === 'warning' && r.status === 'pending');
  const infos = results.filter(r => r.severity === 'info' && r.status !== 'ok');
  const oks = results.filter(r => r.status === 'ok');

  return {
    canEmit: blockers.length === 0,
    blockers,
    warnings,
    infos,
    oks,
    allResults: results,
  };
}

function checkRequirement(
  issuer: IssuerData,
  req: FiscalRequirement,
  docType: DocumentType
): ValidationResult {
  const baseResult: ValidationResult = {
    id: req.id,
    title: req.title,
    description: req.description,
    severity: req.severity,
    status: 'pending',
    links: req.officialLinks,
  };

  // Verificações específicas por tipo de evidência
  switch (req.evidenceType) {
    case 'A1':
      if (issuer.hasCertificate || 
          issuer.status === 'ACTIVE' || 
          issuer.status === 'active' ||
          issuer.status === 'certificate_uploaded' ||
          issuer.sefaz_status === 'validated') {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: req.severity === 'blocker' ? 'blocked' : 'pending',
        action: 'Faça upload do certificado A1 na aba "Emissor".',
      };

    case 'CNPJ':
      if (issuer.cnpj_cpf && issuer.cnpj_cpf.length >= 11) {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: 'blocked',
        action: 'Cadastre seu CNPJ ou CPF no emissor.',
      };

    case 'ENDERECO':
      const hasFullAddress = !!(
        issuer.logradouro &&
        issuer.numero &&
        issuer.bairro &&
        issuer.cidade &&
        issuer.uf &&
        issuer.cep
      );
      if (hasFullAddress) {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: req.severity === 'blocker' ? 'blocked' : 'pending',
        action: 'Complete o endereço do emissor com todos os campos.',
      };

    case 'IE':
      if (issuer.ie && issuer.ie.trim().length > 0 && issuer.ie !== 'ISENTO') {
        return { ...baseResult, status: 'ok' };
      }
      // IE pode ser opcional em alguns casos
      return { 
        ...baseResult, 
        status: req.severity === 'blocker' ? 'blocked' : 'pending',
        action: 'Verifique sua Inscrição Estadual no SINTEGRA.',
      };

    case 'CREDENCIAMENTO':
      if (issuer.hasCredenciamento) {
        return { ...baseResult, status: 'ok' };
      }
      // Assumimos pendente pois não temos como verificar automaticamente
      return { 
        ...baseResult, 
        status: 'pending',
        action: 'Verifique seu credenciamento no portal SEFAZ do seu estado.',
      };

    case 'RNTRC':
      if (issuer.hasRntrc) {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: req.severity === 'blocker' ? 'blocked' : 'pending',
        action: 'Obtenha seu RNTRC no portal da ANTT.',
      };

    case 'VEICULO':
      if (issuer.hasVehicle) {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: 'blocked',
        action: 'Cadastre pelo menos um veículo para emitir MDF-e.',
      };

    case 'CONDUTOR':
      if (issuer.hasCondutor) {
        return { ...baseResult, status: 'ok' };
      }
      return { 
        ...baseResult, 
        status: 'blocked',
        action: 'Cadastre o condutor (motorista) para emitir MDF-e.',
      };

    default:
      // Para requisitos sem evidência específica, marcamos como pendente/info
      return { 
        ...baseResult, 
        status: req.severity === 'info' ? 'ok' : 'pending',
      };
  }
}

/**
 * Retorna uma mensagem resumida do status de validação
 */
export function getValidationMessage(summary: ValidationSummary): {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error';
} {
  if (summary.canEmit && summary.warnings.length === 0) {
    return {
      title: 'Pronto para emitir',
      message: 'Todos os requisitos foram atendidos.',
      type: 'success',
    };
  }

  if (summary.canEmit) {
    return {
      title: 'Atenção',
      message: `Você pode emitir, mas há ${summary.warnings.length} pendência(s) que podem afetar a emissão.`,
      type: 'warning',
    };
  }

  return {
    title: 'Não é possível emitir',
    message: `Existem ${summary.blockers.length} requisito(s) obrigatório(s) não atendido(s).`,
    type: 'error',
  };
}
