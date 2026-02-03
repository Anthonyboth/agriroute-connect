/**
 * Hook para pré-validação fiscal ANTES de cobrança
 * 
 * Este hook DEVE ser usado antes de:
 * - Abrir modal de pagamento PIX
 * - Criar cobrança PIX
 * - Tentar emitir qualquer documento fiscal
 * 
 * Garante que o usuário está apto fiscalmente antes de pagar.
 */

import { useCallback, useMemo } from 'react';
import { 
  useFiscalEmissionReadiness, 
  EmissionBlocker,
  FiscalIssuerData,
} from './useFiscalEmissionReadiness';

export type FiscalDocumentType = 'NFE' | 'CTE' | 'MDFE' | 'GTA';

export interface FiscalValidationResult {
  // Status principal
  canEmit: boolean;
  
  // Motivos de bloqueio
  blockedReasons: Array<{
    code: string;
    title: string;
    message: string;
    action: string;
  }>;
  
  // Próximos passos sugeridos
  nextSteps: string[];
  
  // Lista original de bloqueadores e avisos
  blockers: EmissionBlocker[];
  warnings: EmissionBlocker[];
}

export interface FiscalPreValidationInput {
  fiscalIssuer: FiscalIssuerData | null;
  documentType: FiscalDocumentType;
  vehicles?: unknown[];
  userRole?: string;
}

/**
 * Hook principal de pré-validação fiscal
 * 
 * Uso:
 * ```tsx
 * const { validate, canEmit, blockers, warnings } = useFiscalPreValidation({
 *   fiscalIssuer,
 *   documentType: 'NFE',
 * });
 * 
 * const handleEmit = async () => {
 *   const result = validate();
 *   if (!result.canEmit) {
 *     // Mostrar modal de bloqueio - NÃO ABRIR PAGAMENTO
 *     setShowBlockersModal(true);
 *     return;
 *   }
 *   // Continuar para pagamento PIX
 *   setShowPixModal(true);
 * };
 * ```
 */
export function useFiscalPreValidation(input: FiscalPreValidationInput) {
  const { fiscalIssuer, documentType, vehicles, userRole } = input;

  // Verificar se tem certificado baseado no status do emissor
  const hasCertificate = useMemo(() => {
    const validStatuses = [
      'certificate_uploaded',
      'active',
      'production_enabled',
      'homologation_enabled',
    ];
    const validSefazStatuses = ['validated', 'production_enabled', 'homologation_enabled'];
    
    return (
      validStatuses.includes(fiscalIssuer?.status || '') ||
      validSefazStatuses.includes(fiscalIssuer?.sefaz_status || '')
    );
  }, [fiscalIssuer?.status, fiscalIssuer?.sefaz_status]);

  // Verificar se tem veículo cadastrado
  const hasVehicle = useMemo(() => {
    return Array.isArray(vehicles) && vehicles.length > 0;
  }, [vehicles]);

  // Para condutor, assumimos que motoristas têm condutor
  const hasCondutor = useMemo(() => {
    const driverRoles = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'];
    return driverRoles.includes(userRole || '');
  }, [userRole]);

  // Usar hook de readiness existente
  const readiness = useFiscalEmissionReadiness({
    issuer: fiscalIssuer,
    hasCertificate,
    hasVehicle,
    hasCondutor,
    userRole,
  });

  // Filtrar bloqueadores específicos para o tipo de documento
  const blockersForType = useMemo(() => {
    return readiness.blockers.filter(b => b.docTypes.includes(documentType));
  }, [readiness.blockers, documentType]);

  const warningsForType = useMemo(() => {
    return readiness.warnings.filter(w => w.docTypes.includes(documentType));
  }, [readiness.warnings, documentType]);

  // Verificar se pode emitir este tipo específico
  const canEmit = useMemo(() => {
    return blockersForType.length === 0;
  }, [blockersForType]);

  /**
   * Função de validação que retorna resultado estruturado
   * Usar esta função ANTES de abrir modal de pagamento
   */
  const validate = useCallback((): FiscalValidationResult => {
    const blockedReasons = blockersForType.map(blocker => ({
      code: blocker.id.toUpperCase().replace(/-/g, '_'),
      title: blocker.title,
      message: blocker.description,
      action: blocker.action,
    }));

    const nextSteps: string[] = [];
    
    if (blockedReasons.length > 0) {
      // Priorizar próximos passos baseado nos bloqueios
      if (blockedReasons.some(r => r.code.includes('CERTIFICATE'))) {
        nextSteps.push('Faça upload do seu Certificado Digital A1 na aba "Emissor"');
      }
      if (blockedReasons.some(r => r.code.includes('ISSUER') || r.code.includes('CNPJ') || r.code.includes('ADDRESS'))) {
        nextSteps.push('Complete o cadastro do seu emissor fiscal');
      }
      if (blockedReasons.some(r => r.code.includes('SEFAZ'))) {
        nextSteps.push('Verifique seu credenciamento na SEFAZ do seu estado');
      }
      if (blockedReasons.some(r => r.code.includes('RNTRC'))) {
        nextSteps.push('Obtenha seu RNTRC na ANTT e cadastre no sistema');
      }
      if (blockedReasons.some(r => r.code.includes('VEHICLE'))) {
        nextSteps.push('Cadastre pelo menos um veículo com placa e RENAVAM');
      }
      if (blockedReasons.some(r => r.code.includes('CONDUTOR'))) {
        nextSteps.push('Cadastre um condutor com CPF e CNH válidos');
      }
    }

    return {
      canEmit,
      blockedReasons,
      nextSteps,
      blockers: blockersForType,
      warnings: warningsForType,
    };
  }, [canEmit, blockersForType, warningsForType]);

  /**
   * Verificação rápida antes de ação
   * Retorna true se pode prosseguir, false se deve bloquear
   */
  const checkCanProceed = useCallback((): boolean => {
    return blockersForType.length === 0;
  }, [blockersForType]);

  return {
    // Resultado da validação
    validate,
    checkCanProceed,
    
    // Status direto
    canEmit,
    blockers: blockersForType,
    warnings: warningsForType,
    
    // Porcentagem de prontidão (útil para UI)
    readinessPercentage: readiness.readinessPercentage,
    
    // Status detalhado do readiness original
    fullReadiness: readiness,
  };
}

/**
 * Tipos de documento para validação de compatibilidade de regime
 */
export const DOCUMENT_REQUIREMENTS = {
  NFE: {
    label: 'NF-e (Nota Fiscal Eletrônica)',
    requiresIE: false, // Warning only
    requiresRNTRC: false,
    requiresVehicle: false,
    requiresCondutor: false,
    requiresCertificate: true,
  },
  CTE: {
    label: 'CT-e (Conhecimento de Transporte)',
    requiresIE: true,
    requiresRNTRC: true,
    requiresVehicle: false,
    requiresCondutor: false,
    requiresCertificate: true,
  },
  MDFE: {
    label: 'MDF-e (Manifesto de Documentos Fiscais)',
    requiresIE: true,
    requiresRNTRC: true,
    requiresVehicle: true,
    requiresCondutor: true,
    requiresCertificate: true,
  },
  GTA: {
    label: 'GT-A (Guia de Transporte Animal)',
    requiresIE: false,
    requiresRNTRC: false,
    requiresVehicle: false,
    requiresCondutor: false,
    requiresCertificate: false,
  },
} as const;
