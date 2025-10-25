/**
 * Hook reutilizável para obter capacidades do painel atual
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';
import { useDriverPermissions } from './useDriverPermissions';
import {
  resolvePanelFromRoute,
  computePanelCapabilities,
  hasCapability as _hasCapability,
  getRestrictionReason as _getRestrictionReason,
  type PanelKey,
  type ActionKey,
  type PanelCapabilities,
  type CapabilityContext,
} from '@/lib/panel-capabilities';

interface UsePanelCapabilitiesParams {
  context?: CapabilityContext;
}

export const usePanelCapabilities = (params?: UsePanelCapabilitiesParams) => {
  const { profile } = useAuth();
  const location = useLocation();
  const companyDriver = useCompanyDriver();
  const driverPermissions = useDriverPermissions();

  const panel = useMemo<PanelKey>(
    () => resolvePanelFromRoute(location.pathname, profile),
    [location.pathname, profile]
  );

  const capabilities = useMemo<PanelCapabilities>(
    () => computePanelCapabilities({
      panel,
      profile,
      companyDriver: {
        isCompanyDriver: companyDriver.isCompanyDriver,
        canAcceptFreights: companyDriver.canAcceptFreights,
        canManageVehicles: companyDriver.canManageVehicles,
        isAffiliated: companyDriver.isAffiliated,
      },
      driverPermissions,
      context: params?.context,
    }),
    [panel, profile, companyDriver, driverPermissions, params?.context]
  );

  const can = (action: ActionKey): boolean => {
    return _hasCapability(capabilities, action);
  };

  const reason = (action: ActionKey): string | undefined => {
    return _getRestrictionReason(capabilities, action);
  };

  return {
    panel,
    capabilities,
    can,
    reason,
  };
};
