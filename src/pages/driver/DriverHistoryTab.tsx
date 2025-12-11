import React from 'react';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import { SafeListWrapper } from '@/components/SafeListWrapper';

export const DriverHistoryTab: React.FC = () => {
  return (
    <SafeListWrapper>
      <UnifiedHistory userRole="MOTORISTA" />
    </SafeListWrapper>
  );
};
