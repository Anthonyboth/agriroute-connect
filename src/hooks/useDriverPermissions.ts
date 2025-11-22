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
  
  // 🐛 DEBUG: Log completo do contexto
  console.log('[useDriverPermissions] Context:', {
    profileId: profile?.id,
    profileRole: profile?.role,
    hasCompanyDriver: !!companyDriver,
    companyCanAccept,
    companyDriverData: companyDriver
  });
  
  // ✅ CRÍTICO: Verificar se é AFILIADO (não apenas motorista de empresa)
  const isAffiliatedDriver = companyDriver?.affiliation_type === 'AFFILIATED';
  
  // ✅ Motorista autônomo (sem vínculo) SEMPRE pode aceitar fretes
  // ADICIONADO: Verificação explícita de profile?.id
  const isIndependentDriver = !!profile?.id && !companyDriver && (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO');
  
  // ✅ Para motorista de empresa, respeitar flag can_accept_freights
  const canAccept = isIndependentDriver ? true : !!companyCanAccept;
  
  // 🐛 DEBUG: Log da decisão final
  console.log('[useDriverPermissions] Decision:', {
    isIndependentDriver,
    canAccept,
    reason: isIndependentDriver ? 'independent driver' : `company driver with canAccept=${companyCanAccept}`
  });
  
  return {
    isAffiliated: isAffiliatedDriver,
    canAcceptFreights: canAccept,
    canManageVehicles,
    companyId: companyDriver?.company_id || null,
    companyName: companyDriver?.company?.company_name || null,
    mustUseChat: isAffiliatedDriver && !canAccept,
  };
};
