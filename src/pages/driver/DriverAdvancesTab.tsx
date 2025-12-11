import React from 'react';
import { DriverPayouts } from '@/components/DriverPayouts';

interface DriverAdvancesTabProps {
  driverId: string;
}

export const DriverAdvancesTab: React.FC<DriverAdvancesTabProps> = ({ driverId }) => {
  return <DriverPayouts driverId={driverId} />;
};
