import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ReportsDashboardPanel } from '@/components/reports/ReportsDashboardPanel';

interface DriverReportsTabProps {
  driverId?: string;
}

export const DriverReportsTab: React.FC<DriverReportsTabProps> = ({ driverId }) => {
  const { profile } = useAuth();
  const profileId = driverId || profile?.id;

  return (
    <ReportsDashboardPanel
      panel="MOTORISTA"
      profileId={profileId}
      title="Relatórios do Motorista"
    />
  );
};

export default DriverReportsTab;