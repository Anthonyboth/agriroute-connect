import React from 'react';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { SafeListWrapper } from '@/components/SafeListWrapper';

interface DriverChatTabProps {
  userProfileId: string;
  userRole?: string;
}

export const DriverChatTab: React.FC<DriverChatTabProps> = ({ userProfileId, userRole = 'MOTORISTA' }) => {
  return (
    <SafeListWrapper>
      <UnifiedChatHub
        userProfileId={userProfileId}
        userRole={userRole}
      />
    </SafeListWrapper>
  );
};
