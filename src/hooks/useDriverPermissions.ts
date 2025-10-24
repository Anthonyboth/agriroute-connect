import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';

export interface DriverPermissions {
  isAffiliated: boolean;
  canAcceptFreights: boolean;
  canManageVehicles: boolean;
  companyId: string | null;
  companyName: string | null;
  mustUseChat: boolean; // true se afiliado MAS sem can_accept_freights
}

export const useDriverPermissions = (): DriverPermissions => {
  const { profile } = useAuth();
  const { companyDriver, canAcceptFreights: companyCanAccept, canManageVehicles } = useCompanyDriver();
  
  // ✅ CRÍTICO: Verificar se é AFILIADO (não apenas motorista de empresa)
  const isAffiliatedDriver = companyDriver?.affiliation_type === 'AFFILIATED';
  
  // ✅ Motorista autônomo (sem vínculo) SEMPRE pode aceitar fretes
  const isIndependentDriver = !companyDriver && (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO');
  
  // ✅ Para motorista de empresa, respeitar flag can_accept_freights
  const canAccept = isIndependentDriver ? true : !!companyCanAccept;
  
  return {
    isAffiliated: isAffiliatedDriver,
    canAcceptFreights: canAccept,
    canManageVehicles,
    companyId: companyDriver?.company_id || null,
    companyName: companyDriver?.company?.company_name || null,
    mustUseChat: isAffiliatedDriver && !canAccept,
  };
};
