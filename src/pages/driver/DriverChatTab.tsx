import React from 'react';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { SafeListWrapper } from '@/components/SafeListWrapper';

interface DriverChatTabProps {
  userProfileId: string;
}

export const DriverChatTab: React.FC<DriverChatTabProps> = ({ userProfileId }) => {
  return (
    <SafeListWrapper>
      <UnifiedChatHub
        userProfileId={userProfileId}
        userRole="MOTORISTA"
      />
    </SafeListWrapper>
  );
};
