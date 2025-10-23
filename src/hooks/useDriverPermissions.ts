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
  const { companyDriver, isCompanyDriver, canAcceptFreights, canManageVehicles } = useCompanyDriver();
  
  return {
    isAffiliated: isCompanyDriver,
    canAcceptFreights,
    canManageVehicles,
    companyId: companyDriver?.company_id || null,
    companyName: companyDriver?.company?.company_name || null,
    mustUseChat: isCompanyDriver && !canAcceptFreights,
  };
};
