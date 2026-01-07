import { useMemo } from 'react';
import type { 
  ComplianceResult, 
  ComplianceIssue, 
  FreightComplianceData,
  ComplianceChecklist,
  ComplianceStatus 
} from '@/types/compliance';
import { CARGO_COMPLIANCE_RULES } from '@/types/compliance';

export function useFreightCompliance(data: FreightComplianceData): ComplianceResult {
  return useMemo(() => {
    const issues: ComplianceIssue[] = [];
    const legalBasis: string[] = [];

    const cargoRules = CARGO_COMPLIANCE_RULES[data.cargoType || 'outros'];

    // ========== NF-e Validation ==========
    if (!data.hasNfe) {
      issues.push({
        id: 'nfe_missing',
        type: 'nfe',
        severity: 'error',
        message: 'NF-e obrigatória ausente',
        legalBasis: 'Ajuste SINIEF 07/05',
        action: 'scan_nfe',
        actionLabel: 'Adicionar NF-e',
      });
      legalBasis.push('Ajuste SINIEF 07/05');
    }

    if (data.hasNfe && !data.nfeManifested) {
      issues.push({
        id: 'nfe_not_manifested',
        type: 'nfe',
        severity: 'warning',
        message: 'NF-e ainda não manifestada',
        legalBasis: 'Evento 210210 - Ciência da Operação',
        action: 'manifest_nfe',
        actionLabel: 'Manifestar NF-e',
      });
      legalBasis.push('Evento 210210');
    }

    // ========== CT-e Validation ==========
    const cteRequired = cargoRules.cte === 'required' || 
      (cargoRules.cte === 'conditional' && data.freightCharged && data.isThirdPartyTransporter);

    if (cteRequired && !data.cteIssued) {
      issues.push({
        id: 'cte_missing',
        type: 'cte',
        severity: 'error',
        message: 'CT-e obrigatório não emitido',
        legalBasis: 'Ajuste SINIEF 09/07',
        action: 'info_cte',
        actionLabel: 'Saiba mais sobre CT-e',
      });
      legalBasis.push('Ajuste SINIEF 09/07');
    }

    // ========== GTA Validation ==========
    if (data.hasLiveAnimals || cargoRules.gta) {
      if (!data.gtaIssued) {
        issues.push({
          id: 'gta_missing',
          type: 'gta',
          severity: 'error',
          message: 'GTA obrigatória ausente para transporte de animais vivos',
          legalBasis: 'MAPA / Defesa Sanitária Animal',
          action: 'info_gta',
          actionLabel: 'Saiba mais sobre GTA',
        });
        legalBasis.push('MAPA / Defesa Sanitária Animal');
      }
    }

    // ========== Determine Status ==========
    let status: ComplianceStatus = 'OK';
    
    const hasBlockingIssue = issues.some(
      i => i.severity === 'error' && 
      (i.id === 'cte_missing' || i.id === 'gta_missing')
    );
    
    const hasNfeMissing = issues.some(i => i.id === 'nfe_missing');
    
    if (hasBlockingIssue || hasNfeMissing) {
      status = 'BLOCKED';
    } else if (issues.length > 0) {
      status = 'WARNING';
    }

    // ========== Build Checklist ==========
    const checklist: ComplianceChecklist = {
      nfe: {
        required: true,
        present: data.hasNfe,
        status: data.hasNfe ? 'ok' : 'error',
        label: 'NF-e da Mercadoria',
        description: data.nfeAccessKey ? `Chave: ${data.nfeAccessKey.slice(0, 10)}...` : undefined,
      },
      nfeManifestation: {
        required: data.hasNfe,
        present: data.nfeManifested,
        status: !data.hasNfe ? 'not_required' : data.nfeManifested ? 'ok' : 'warning',
        label: 'Manifestação da NF-e',
        description: data.nfeManifested ? 'Manifestação declarada' : 'Pendente de manifestação',
      },
      cte: {
        required: cteRequired,
        present: data.cteIssued,
        status: !cteRequired ? 'not_required' : data.cteIssued ? 'ok' : 'error',
        label: 'CT-e do Frete',
        description: cteRequired 
          ? (data.cteIssued ? 'CT-e emitido' : 'CT-e obrigatório')
          : 'Não aplicável',
      },
      gta: {
        required: data.hasLiveAnimals || cargoRules.gta,
        present: data.gtaIssued,
        status: !(data.hasLiveAnimals || cargoRules.gta) ? 'not_required' : data.gtaIssued ? 'ok' : 'error',
        label: 'GTA - Guia de Trânsito Animal',
        description: (data.hasLiveAnimals || cargoRules.gta)
          ? (data.gtaIssued ? 'GTA emitida' : 'GTA obrigatória')
          : 'Não aplicável',
      },
    };

    return {
      status,
      issues,
      legalBasis: [...new Set(legalBasis)],
      checklist,
    };
  }, [data]);
}
