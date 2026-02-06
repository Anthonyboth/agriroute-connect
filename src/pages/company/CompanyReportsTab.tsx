import React from 'react';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { ReportsDashboardPanel } from '@/components/reports/ReportsDashboardPanel';

export const CompanyReportsTab: React.FC = () => {
  const { company, isLoadingCompany } = useTransportCompany();

  if (isLoadingCompany) {
    return <CenteredSpinner size="lg" className="py-12" />;
  }

  return (
    <ReportsDashboardPanel
      panel="TRANSPORTADORA"
      profileId={company?.id}
      title="Relatórios da Transportadora"
    />
  );
};

export default CompanyReportsTab;