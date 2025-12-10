import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, Star, XCircle, Phone, Eye } from 'lucide-react';
import { CompanyDriverPerformance } from '@/hooks/useCompanyDriverPerformance';

interface DriverPerformanceAlertsProps {
  drivers: CompanyDriverPerformance[];
  onViewDriver?: (driverId: string) => void;
}

interface PerformanceAlert {
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  type: 'low_rating' | 'high_cancellation' | 'low_acceptance' | 'slow_response';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
}

export const DriverPerformanceAlerts: React.FC<DriverPerformanceAlertsProps> = ({
  drivers,
  onViewDriver,
}) => {
  // Generate alerts based on performance thresholds
  const alerts: PerformanceAlert[] = [];

  drivers.forEach(driver => {
    // Low rating alert (< 3.5 with at least 3 ratings)
    if (driver.averageRating > 0 && driver.averageRating < 3.5 && driver.totalRatings >= 3) {
      alerts.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        driverPhone: driver.driverPhone,
        type: 'low_rating',
        severity: driver.averageRating < 2.5 ? 'critical' : 'warning',
        message: `Avaliação baixa: ${driver.averageRating.toFixed(1)}/5.0`,
        value: driver.averageRating,
      });
    }

    // High cancellation rate (> 20% with at least 5 freights)
    if (driver.totalFreights >= 5) {
      const cancellationRate = (driver.cancelledFreights / driver.totalFreights) * 100;
      if (cancellationRate > 20) {
        alerts.push({
          driverId: driver.driverId,
          driverName: driver.driverName,
          driverPhone: driver.driverPhone,
          type: 'high_cancellation',
          severity: cancellationRate > 40 ? 'critical' : 'warning',
          message: `Taxa de cancelamento: ${cancellationRate.toFixed(0)}%`,
          value: cancellationRate,
        });
      }
    }

    // Low acceptance rate (< 50% with at least 5 proposals)
    if (driver.acceptanceRate < 50 && driver.totalFreights >= 3) {
      alerts.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        driverPhone: driver.driverPhone,
        type: 'low_acceptance',
        severity: driver.acceptanceRate < 30 ? 'critical' : 'warning',
        message: `Taxa de aceitação: ${driver.acceptanceRate.toFixed(0)}%`,
        value: driver.acceptanceRate,
      });
    }

    // Slow response time (> 24 hours average)
    if (driver.responseTime > 24) {
      alerts.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        driverPhone: driver.driverPhone,
        type: 'slow_response',
        severity: driver.responseTime > 48 ? 'critical' : 'warning',
        message: `Tempo médio de resposta: ${driver.responseTime.toFixed(0)}h`,
        value: driver.responseTime,
      });
    }
  });

  // Sort by severity (critical first) then by value
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return b.value - a.value;
  });

  const getAlertIcon = (type: PerformanceAlert['type']) => {
    switch (type) {
      case 'low_rating':
        return <Star className="h-4 w-4" />;
      case 'high_cancellation':
        return <XCircle className="h-4 w-4" />;
      case 'low_acceptance':
        return <TrendingDown className="h-4 w-4" />;
      case 'slow_response':
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertTypeLabel = (type: PerformanceAlert['type']) => {
    switch (type) {
      case 'low_rating':
        return 'Avaliação';
      case 'high_cancellation':
        return 'Cancelamentos';
      case 'low_acceptance':
        return 'Aceitação';
      case 'slow_response':
        return 'Resposta';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Sem alertas de performance</p>
              <p className="text-sm opacity-80">Todos os motoristas estão dentro dos padrões esperados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <Card className="border-amber-500/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alertas de Performance
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} crítico{criticalCount > 1 ? 's' : ''}</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary">{warningCount} atenção</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.driverId}-${alert.type}-${index}`}
              className={`p-3 rounded-lg border flex items-center justify-between ${
                alert.severity === 'critical' 
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  alert.severity === 'critical' 
                    ? 'bg-red-500/20 text-red-600' 
                    : 'bg-amber-500/20 text-amber-600'
                }`}>
                  {getAlertIcon(alert.type)}
                </div>
                <div>
                  <p className="font-medium text-sm">{alert.driverName}</p>
                  <p className={`text-xs ${
                    alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getAlertTypeLabel(alert.type)}
                </Badge>
                {alert.driverPhone && (
                  <a href={`tel:${alert.driverPhone}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Phone className="h-3 w-3" />
                    </Button>
                  </a>
                )}
                {onViewDriver && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => onViewDriver(alert.driverId)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
