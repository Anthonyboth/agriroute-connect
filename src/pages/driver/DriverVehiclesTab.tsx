import React from 'react';
import { VehicleManager } from '@/components/VehicleManager';

interface DriverVehiclesTabProps {
  driverProfile: any;
}

export const DriverVehiclesTab: React.FC<DriverVehiclesTabProps> = ({ driverProfile }) => {
  return <VehicleManager driverProfile={driverProfile} />;
};
