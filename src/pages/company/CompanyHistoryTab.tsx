import React from 'react';
import { FreightHistoryFromDB } from '@/components/history/FreightHistoryFromDB';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CenteredSpinner } from '@/components/ui/AppSpinner';

export const CompanyHistoryTab: React.FC = () => {
  const { company, isLoadingCompany } = useTransportCompany();

  if (isLoadingCompany) {
    return <CenteredSpinner size="lg" />;
  }

  return (
    <div className="space-y-4">
      <FreightHistoryFromDB role="TRANSPORTADORA" companyId={company?.id} />
    </div>
  );
};