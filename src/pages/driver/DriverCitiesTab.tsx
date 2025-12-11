import React from 'react';
import { UserCityManager } from '@/components/UserCityManager';

interface DriverCitiesTabProps {
  onCitiesUpdate: () => void;
}

export const DriverCitiesTab: React.FC<DriverCitiesTabProps> = ({ onCitiesUpdate }) => {
  return (
    <UserCityManager 
      userRole="MOTORISTA"
      onCitiesUpdate={onCitiesUpdate}
    />
  );
};
