import { useEffect, useState } from 'react';
import { useTransportCompany } from './useTransportCompany';
import { devLog } from '@/lib/devLogger';

/**
 * Hook centralizado para obter o companyId ativo
 * Garante consistência entre componentes usando transport_companies.id
 * com fallback para localStorage
 */
export const useActiveCompanyId = () => {
  const { company } = useTransportCompany();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (company?.id) {
      setCompanyId(company.id);
      localStorage.setItem('current_company_id', company.id);
      devLog('🔑 [useActiveCompanyId] Company ID ativo:', company.id);
    } else {
      const storedId = localStorage.getItem('current_company_id');
      if (storedId) {
        setCompanyId(storedId);
        devLog('🔑 [useActiveCompanyId] Usando company ID do localStorage:', storedId);
      } else {
        setCompanyId(null);
        console.warn('⚠️ [useActiveCompanyId] Nenhum company ID disponível');
      }
    }
  }, [company?.id]);

  return { companyId, company };
};
