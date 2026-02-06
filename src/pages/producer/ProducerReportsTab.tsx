import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ReportsDashboardPanel } from '@/components/reports/ReportsDashboardPanel';

export const ProducerReportsTab: React.FC = () => {
  const { profile } = useAuth();
  const activeMode = profile?.active_mode || profile?.role;
  const profileId = (activeMode === 'PRODUTOR' && profile?.id) ? profile.id : undefined;

  return (
    <ReportsDashboardPanel
      panel="PRODUTOR"
      profileId={profileId}
      title="Relatórios do Produtor"
    />
  );
};