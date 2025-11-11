import { useMemo } from 'react';

export interface ReportData {
  freights: any[];
  summary: {
    total: number;
    totalValue: number;
    totalDistance: number;
    totalWeight: number;
    avgPrice: number;
    avgDistance: number;
    byStatus: Record<string, number>;
    byUrgency: Record<string, number>;
    byCargo: Record<string, number>;
  };
}

export const useFreightReportData = (freights: any[]): ReportData => {
  return useMemo(() => {
    const total = freights.length;
    const totalValue = freights.reduce((sum, f) => sum + (f.price || 0), 0);
    const totalDistance = freights.reduce((sum, f) => sum + (f.distance_km || 0), 0);
    const totalWeight = freights.reduce((sum, f) => sum + (f.weight || 0), 0);
    
    const summary = {
      total,
      totalValue,
      totalDistance,
      totalWeight,
      avgPrice: total > 0 ? totalValue / total : 0,
      avgDistance: total > 0 ? totalDistance / total : 0,
      byStatus: freights.reduce((acc, f) => {
        const status = f.status || 'UNKNOWN';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byUrgency: freights.reduce((acc, f) => {
        const urgency = f.urgency || 'LOW';
        acc[urgency] = (acc[urgency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCargo: freights.reduce((acc, f) => {
        const cargo = f.cargo_type || 'UNKNOWN';
        acc[cargo] = (acc[cargo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return { freights, summary };
  }, [freights]);
};
