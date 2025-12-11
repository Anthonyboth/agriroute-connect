import React from 'react';
import { DriverAffiliationsManager } from '@/components/DriverAffiliationsManager';
import { SafeListWrapper } from '@/components/SafeListWrapper';

export const DriverAffiliationsTab: React.FC = () => {
  return (
    <SafeListWrapper>
      <DriverAffiliationsManager />
    </SafeListWrapper>
  );
};
