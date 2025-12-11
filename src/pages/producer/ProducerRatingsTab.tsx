import React from 'react';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';

interface ProducerRatingsTabProps {
  userProfileId: string;
}

export const ProducerRatingsTab: React.FC<ProducerRatingsTabProps> = ({
  userProfileId,
}) => {
  return (
    <PendingRatingsPanel
      userRole="PRODUTOR"
      userProfileId={userProfileId}
    />
  );
};
