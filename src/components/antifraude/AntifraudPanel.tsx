import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Shield, RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAntifraudData, type TimelineEvent } from '@/hooks/useAntifraudData';
import { AntifraudIndicators } from './AntifraudIndicators';
import { AntifraudTimeline } from './AntifraudTimeline';
import { AntifraudDiagnosis } from './AntifraudDiagnosis';
import { AntifraudMapView } from './AntifraudMapView';
import { Skeleton } from '@/components/ui/skeleton';

interface AntifraudPanelProps {
  freightId: string;
  originCity?: string;
  destinationCity?: string;
  driverName?: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  currentLat?: number;
  currentLng?: number;
}

export const AntifraudPanel: React.FC<AntifraudPanelProps> = ({
  freightId,
  originCity,
  destinationCity,
  driverName,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  currentLat,
  currentLng,
}) => {
  const { data, loading, error, refetch, recalculateScore } = useAntifraudData(freightId);
  const [selectedEvent, setSelectedEvent] = React.useState<TimelineEvent | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Dados de antifraude não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = () => {
    if (data.score >= 70) return 'text-red-600';
    if (data.score >= 40) return 'text-orange-500';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (data.score >= 70) return 'bg-red-500';
    if (data.score >= 40) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getLevelBadge = () => {
    switch (data.level) {
      case 'high_risk':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Risco Alto
          </Badge>
        );
      case 'attention':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Atenção
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-green-700 border-green-300 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Normal
          </Badge>
        );
    }
  };

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
    // Could open a modal or scroll to location on map
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Análise Antifraude
            </CardTitle>
            <div className="flex items-center gap-2">
              {getLevelBadge()}
              <Button variant="ghost" size="sm" onClick={recalculateScore}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Route info */}
            <div className="flex-1 min-w-0">
              {(originCity || destinationCity) && (
                <p className="text-sm text-muted-foreground truncate">
                  {originCity || '—'} → {destinationCity || '—'}
                </p>
              )}
              {driverName && (
                <p className="text-sm font-medium truncate">Motorista: {driverName}</p>
              )}
            </div>

            {/* Score */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Score de Risco</p>
                <p className={`text-2xl font-bold ${getScoreColor()}`}>{data.score}/100</p>
              </div>
              <div className="w-32">
                <Progress 
                  value={data.score} 
                  className="h-3"
                  // Custom color based on score
                  style={{
                    ['--progress-background' as any]: data.score >= 70 ? '#ef4444' : data.score >= 40 ? '#f97316' : '#22c55e'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Last analyzed */}
          {data.analyzedAt && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última análise: {format(new Date(data.analyzedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Indicators */}
      <AntifraudIndicators indicators={data.indicators} />

      {/* Diagnosis */}
      <AntifraudDiagnosis data={data} />

      {/* Map and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AntifraudMapView
          stops={data.stops}
          routeDeviations={data.routeDeviations}
          offlineIncidents={data.offlineIncidents}
          originLat={originLat}
          originLng={originLng}
          destinationLat={destinationLat}
          destinationLng={destinationLng}
          currentLat={currentLat}
          currentLng={currentLng}
          onEventClick={handleEventClick}
        />
        
        <AntifraudTimeline 
          events={data.timeline} 
          onEventClick={handleEventClick}
        />
      </div>

      {/* Summary stats */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total de eventos:</span>{' '}
              <strong>{data.timeline.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Paradas:</span>{' '}
              <strong>{data.stops.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Incidentes offline:</span>{' '}
              <strong>{data.offlineIncidents.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Desvios:</span>{' '}
              <strong>{data.routeDeviations.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Alertas:</span>{' '}
              <strong>{data.auditEvents.length}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Pontos GPS:</span>{' '}
              <strong>{data.trackingPoints}</strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
