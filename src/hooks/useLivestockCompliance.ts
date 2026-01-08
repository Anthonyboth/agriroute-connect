import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFreightCompliance,
  createLivestockCompliance,
  validateCompliance,
  canProceedToTransport,
  getStateRules,
  getAllStateRules,
  requiresLivestockCompliance,
  generateInspectionQR,
  linkGTADocument,
  updateComplianceStatus,
} from '@/services/livestockComplianceService';
import type {
  LivestockFreightCompliance,
  LivestockComplianceStatus,
  AnimalSpecies,
  TransportPurpose,
  GTAStateRule,
  RiskAssessment,
  ComplianceChecklist,
  BlockingReason,
} from '@/types/livestock-compliance';
import { toast } from 'sonner';

// =====================================================
// HOOK: useFreightLivestockCompliance
// =====================================================

interface UseFreightLivestockComplianceOptions {
  freightId: string;
  enabled?: boolean;
}

export function useFreightLivestockCompliance({
  freightId,
  enabled = true,
}: UseFreightLivestockComplianceOptions) {
  const queryClient = useQueryClient();

  // Query para buscar compliance
  const {
    data: compliance,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['livestock-compliance', freightId],
    queryFn: () => getFreightCompliance(freightId),
    enabled: enabled && !!freightId,
    staleTime: 30000, // 30 segundos
  });

  // Mutation para criar compliance
  const createMutation = useMutation({
    mutationFn: createLivestockCompliance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock-compliance', freightId] });
      toast.success('Registro de compliance criado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar compliance: ${error.message}`);
    },
  });

  // Mutation para validar compliance
  const validateMutation = useMutation({
    mutationFn: () => validateCompliance(freightId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['livestock-compliance', freightId] });
      if (result.status === 'approved') {
        toast.success('Documentação aprovada!');
      } else if (result.status === 'blocked') {
        toast.error('Documentação bloqueada. Verifique as pendências.');
      } else {
        toast.warning('Existem pendências a resolver.');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro na validação: ${error.message}`);
    },
  });

  // Mutation para vincular documento GTA
  const linkGTAMutation = useMutation({
    mutationFn: (documentId: string) => {
      if (!compliance?.id) throw new Error('Compliance não encontrado');
      return linkGTADocument(compliance.id, documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock-compliance', freightId] });
      toast.success('Documento GTA vinculado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao vincular documento: ${error.message}`);
    },
  });

  // Mutation para gerar QR Code
  const generateQRMutation = useMutation({
    mutationFn: () => generateInspectionQR(freightId, compliance?.id),
    onSuccess: (result) => {
      toast.success('QR Code gerado com sucesso');
      return result;
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar QR Code: ${error.message}`);
    },
  });

  // Verificar se pode prosseguir
  const checkCanProceed = useCallback(async () => {
    return canProceedToTransport(freightId);
  }, [freightId]);

  return {
    compliance,
    isLoading,
    error,
    refetch,
    
    // Mutations
    createCompliance: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    
    validateCompliance: validateMutation.mutateAsync,
    isValidating: validateMutation.isPending,
    validationResult: validateMutation.data,
    
    linkGTA: linkGTAMutation.mutateAsync,
    isLinkingGTA: linkGTAMutation.isPending,
    
    generateQR: generateQRMutation.mutateAsync,
    isGeneratingQR: generateQRMutation.isPending,
    qrResult: generateQRMutation.data,
    
    checkCanProceed,
    
    // Status helpers
    isApproved: compliance?.compliance_status === 'approved',
    isBlocked: compliance?.compliance_status === 'blocked',
    isPending: compliance?.compliance_status === 'pending',
    hasCompliance: !!compliance,
  };
}

// =====================================================
// HOOK: useGTAStateRules
// =====================================================

interface UseGTAStateRulesOptions {
  uf?: string;
}

export function useGTAStateRules(options: UseGTAStateRulesOptions = {}) {
  const { uf } = options;

  // Query para regra específica de um estado
  const {
    data: stateRule,
    isLoading: isLoadingState,
    error: stateError,
  } = useQuery({
    queryKey: ['gta-state-rules', uf],
    queryFn: () => getStateRules(uf!),
    enabled: !!uf,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Query para todas as regras
  const {
    data: allRules,
    isLoading: isLoadingAll,
    error: allError,
  } = useQuery({
    queryKey: ['gta-state-rules', 'all'],
    queryFn: getAllStateRules,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return {
    stateRule,
    allRules,
    isLoading: isLoadingState || isLoadingAll,
    error: stateError || allError,
    
    // Helpers
    getPortalUrl: (stateUf: string) => allRules?.find(r => r.uf === stateUf)?.portal_url,
    getAgencyName: (stateUf: string) => allRules?.find(r => r.uf === stateUf)?.issuing_agency_name,
    getMaxValidity: (stateUf: string) => allRules?.find(r => r.uf === stateUf)?.max_validity_hours || 48,
  };
}

// =====================================================
// HOOK: useLivestockComplianceCheck
// =====================================================

/**
 * Hook simplificado para verificar se cargo type requer compliance
 */
export function useLivestockComplianceCheck(cargoType: string | undefined) {
  const [requiresCompliance, setRequiresCompliance] = useState(false);

  useEffect(() => {
    if (cargoType) {
      setRequiresCompliance(requiresLivestockCompliance(cargoType));
    } else {
      setRequiresCompliance(false);
    }
  }, [cargoType]);

  return {
    requiresCompliance,
    isLivestock: requiresCompliance,
  };
}

// =====================================================
// HOOK: useComplianceValidation
// =====================================================

interface ValidationState {
  isValid: boolean;
  status: LivestockComplianceStatus;
  risk: RiskAssessment | null;
  checklist: ComplianceChecklist;
  blockingReasons: BlockingReason[];
  canProceed: boolean;
}

export function useComplianceValidation(freightId: string | undefined) {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: false,
    status: 'pending',
    risk: null,
    checklist: {},
    blockingReasons: [],
    canProceed: false,
  });
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = useCallback(async () => {
    if (!freightId) return;

    setIsValidating(true);
    try {
      const result = await validateCompliance(freightId);
      const canProceedResult = await canProceedToTransport(freightId);

      setValidationState({
        isValid: result.status === 'approved',
        status: result.status,
        risk: result.risk,
        checklist: result.checklist,
        blockingReasons: result.blocking_reasons,
        canProceed: canProceedResult.allowed,
      });
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro ao validar compliance');
    } finally {
      setIsValidating(false);
    }
  }, [freightId]);

  return {
    ...validationState,
    isValidating,
    runValidation,
  };
}

export default useFreightLivestockCompliance;
