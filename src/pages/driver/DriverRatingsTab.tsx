import React from 'react';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import { SafeListWrapper } from '@/components/SafeListWrapper';

interface DriverRatingsTabProps {
  userProfileId: string;
}

export const DriverRatingsTab: React.FC<DriverRatingsTabProps> = ({ userProfileId }) => {
  return (
    <SafeListWrapper>
      <PendingRatingsPanel
        userRole="MOTORISTA"
        userProfileId={userProfileId}
      />
    </SafeListWrapper>
  );
};
