import React from 'react';
import { DriverAvailabilityAreasManager } from '@/components/DriverAvailabilityAreasManager';
import { SafeListWrapper } from '@/components/SafeListWrapper';

interface DriverAreasTabProps {
  driverId: string | undefined;
  onFreightAction: (freightId: string, action: 'propose' | 'accept' | 'complete' | 'cancel') => void;
  canAcceptFreights: boolean;
  isAffiliated: boolean;
  companyId: string | undefined;
}

export const DriverAreasTab: React.FC<DriverAreasTabProps> = ({
  driverId,
  onFreightAction,
  canAcceptFreights,
  isAffiliated,
  companyId,
}) => {
  return (
    <SafeListWrapper>
      <DriverAvailabilityAreasManager
        driverId={driverId}
        onFreightAction={onFreightAction}
        canAcceptFreights={canAcceptFreights}
        isAffiliated={isAffiliated}
        companyId={companyId}
      />
    </SafeListWrapper>
  );
};
