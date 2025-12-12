import React from 'react';
import { DriverExpenseManager } from '@/components/driver/DriverExpenseManager';
import { DriverPerformanceDashboard } from '@/components/dashboards/DriverPerformanceDashboard';
import { DriverFinancialReport } from '@/components/driver/DriverFinancialReport';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface DriverReportsTabProps {
  driverId: string;
}

export const DriverReportsTab: React.FC<DriverReportsTabProps> = ({ driverId }) => {
  // Guard: Se driverId estiver vazio, mostrar loading
  if (!driverId) {
    return (
      <SafeListWrapper>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </SafeListWrapper>
    );
  }

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
