import React from 'react';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';

interface ProducerChatTabProps {
  userProfileId: string;
}

export const ProducerChatTab: React.FC<ProducerChatTabProps> = ({
  userProfileId,
}) => {
  return (
    <UnifiedChatHub 
      userProfileId={userProfileId}
      userRole="PRODUTOR"
    />
  );
};
