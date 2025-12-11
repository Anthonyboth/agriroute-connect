import React from 'react';
import { DriverExpenseManager } from '@/components/driver/DriverExpenseManager';
import { DriverPerformanceDashboard } from '@/components/dashboards/DriverPerformanceDashboard';
import { DriverFinancialReport } from '@/components/driver/DriverFinancialReport';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Separator } from '@/components/ui/separator';

interface DriverReportsTabProps {
  driverId: string;
}

export const DriverReportsTab: React.FC<DriverReportsTabProps> = ({ driverId }) => {
  return (
    <SafeListWrapper>
      <div className="space-y-6">
        {/* Formulário para registrar despesas */}
        <DriverExpenseManager driverId={driverId} />
        
        <Separator />
        
        {/* Dashboard de Performance */}
        <DriverPerformanceDashboard driverId={driverId} />
        
        <Separator />
        
        {/* Relatório Financeiro Completo */}
        <DriverFinancialReport driverId={driverId} />
      </div>
    </SafeListWrapper>
  );
};
