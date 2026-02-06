import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ReportsDashboardPanel } from '@/components/reports/ReportsDashboardPanel';

interface ProviderReportsTabProps {
  providerId?: string;
}

export const ProviderReportsTab: React.FC<ProviderReportsTabProps> = ({ providerId }) => {
  const { profile } = useAuth();
  const activeMode = profile?.active_mode || profile?.role;
  const profileId = providerId ?? ((activeMode === 'PRESTADOR_SERVICOS' && profile?.id) ? profile.id : undefined);

  return (
    <ReportsDashboardPanel
      panel="PRESTADOR"
      profileId={profileId}
      title="Relatórios do Prestador"
    />
  );
};

export default ProviderReportsTab;