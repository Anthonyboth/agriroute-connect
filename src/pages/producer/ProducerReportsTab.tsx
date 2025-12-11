import React, { Suspense, lazy, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { AdvancedFreightFilters, FreightFilters } from '@/components/AdvancedFreightFilters';
import { FreightReportExporter } from '@/components/FreightReportExporter';
import { useFreightReportData } from '@/hooks/useFreightReportData';
import type { ProducerFreight, ProducerFilters } from './types';

const FreightAnalyticsDashboard = lazy(() => 
  import('@/components/FreightAnalyticsDashboard').then(m => ({ default: m.FreightAnalyticsDashboard }))
);
const PeriodComparisonDashboard = lazy(() => 
  import('@/components/PeriodComparisonDashboard').then(m => ({ default: m.PeriodComparisonDashboard }))
);
const RouteRentabilityReport = lazy(() => 
  import('@/components/RouteRentabilityReport').then(m => ({ default: m.RouteRentabilityReport }))
);

const ChartLoader = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Carregando gráficos...</span>
  </div>
);

interface ProducerReportsTabProps {
  freights: ProducerFreight[];
}

export const ProducerReportsTab: React.FC<ProducerReportsTabProps> = ({
  freights,
}) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [filters, setFilters] = useState<FreightFilters>({
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const filteredFreights = useMemo(() => {
    let result = [...freights];
    
    if (filters.status?.length) {
      result = result.filter(f => filters.status!.includes(f.status));
    }
    
    if (filters.dateRange) {
      result = result.filter(f => {
        const date = new Date(f.pickup_date);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }
    
    if (filters.priceRange) {
      result = result.filter(f => 
        f.price >= filters.priceRange!.min && 
        f.price <= filters.priceRange!.max
      );
    }
    
    if (filters.distanceRange) {
      result = result.filter(f => 
        (f.distance_km || 0) >= filters.distanceRange!.min && 
        (f.distance_km || 0) <= filters.distanceRange!.max
      );
    }
    
    if (filters.cargoType?.length) {
      result = result.filter(f => filters.cargoType!.includes(f.cargo_type));
    }
    
    if (filters.urgency?.length) {
      result = result.filter(f => f.urgency && filters.urgency!.includes(f.urgency));
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime();
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'distance':
          comparison = (a.distance_km || 0) - (b.distance_km || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [freights, filters]);
  
  const reportData = useFreightReportData(filteredFreights);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">Relatórios e Analytics de Fretes</CardTitle>
            <FreightReportExporter 
              data={reportData}
              reportTitle="Relatório de Fretes - Produtor"
            />
          </div>
        </CardHeader>
      </Card>
      
      <AdvancedFreightFilters
        onFilterChange={setFilters}
        currentFilters={filters}
      />
      
      <Suspense fallback={<ChartLoader />}>
        <FreightAnalyticsDashboard
          freights={filteredFreights}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </Suspense>
      
      <Separator className="my-8" />
      
      <Suspense fallback={<ChartLoader />}>
        <PeriodComparisonDashboard
          freights={filteredFreights}
          comparisonType="month"
        />
      </Suspense>
      
      <Separator className="my-8" />
      
      <Suspense fallback={<ChartLoader />}>
        <RouteRentabilityReport
          freights={filteredFreights}
        />
      </Suspense>
    </div>
  );
};
