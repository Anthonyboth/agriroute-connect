import { useEffect, useState } from 'react';
import { useTransportCompany } from './useTransportCompany';

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
      // Fonte da verdade: transport_companies.id
      setCompanyId(company.id);
      
      // Persistir no localStorage para consistência
      localStorage.setItem('current_company_id', company.id);
      
      console.log('🔑 [useActiveCompanyId] Company ID ativo:', company.id);
    } else {
      // Fallback: tentar recuperar do localStorage
      const storedId = localStorage.getItem('current_company_id');
      if (storedId) {
        setCompanyId(storedId);
        console.log('🔑 [useActiveCompanyId] Usando company ID do localStorage:', storedId);
      } else {
        setCompanyId(null);
        console.warn('⚠️ [useActiveCompanyId] Nenhum company ID disponível');
      }
    }
  }, [company?.id]);

  return { companyId, company };
};
