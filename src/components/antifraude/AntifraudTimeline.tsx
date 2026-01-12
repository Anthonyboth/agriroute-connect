import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MapPin, WifiOff, Navigation, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TimelineEvent } from '@/hooks/useAntifraudData';

interface AntifraudTimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

const getRiskBadge = (level: TimelineEvent['risk_level']) => {
  switch (level) {
    case 'critical':
      return <Badge variant="destructive" className="text-xs">🔴 Crítico</Badge>;
    case 'high':
      return <Badge variant="destructive" className="text-xs bg-orange-500">🟠 Alto</Badge>;
    case 'medium':
      return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">⚠️ Médio</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">✓ Baixo</Badge>;
  }
};

const getEventIcon = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'stop':
      return <MapPin className="h-4 w-4" />;
    case 'offline':
      return <WifiOff className="h-4 w-4" />;
    case 'deviation':
      return <Navigation className="h-4 w-4" />;
    case 'audit':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getEventTypeLabel = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'stop':
      return 'Parada';
    case 'offline':
      return 'Offline';
    case 'deviation':
      return 'Desvio';
    case 'audit':
      return 'Alerta';
    default:
      return 'Evento';
  }
};

const formatDuration = (minutes?: number) => {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

export const AntifraudTimeline: React.FC<AntifraudTimelineProps> = ({ events, onEventClick }) => {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Linha do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum evento registrado para este frete.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Linha do Tempo ({events.length} eventos)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-3 hover:bg-muted/50 transition-colors ${onEventClick ? 'cursor-pointer' : ''}`}
                onClick={() => onEventClick?.(event)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-full ${
                      event.risk_level === 'critical' ? 'bg-red-100 text-red-600' :
                      event.risk_level === 'high' ? 'bg-orange-100 text-orange-600' :
                      event.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">
                          {getEventTypeLabel(event.type)}
                        </span>
                        {getRiskBadge(event.risk_level)}
                      </div>
                      <p className="text-sm mt-0.5 line-clamp-2">{event.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(event.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                        {event.duration_minutes !== undefined && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(event.duration_minutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
