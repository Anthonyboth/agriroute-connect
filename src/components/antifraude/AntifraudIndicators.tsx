import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, Navigation, Wifi, WifiOff, AlertTriangle, TrendingDown } from 'lucide-react';
import type { AntifraudIndicators as IndicatorsType } from '@/hooks/useAntifraudData';

interface AntifraudIndicatorsProps {
  indicators: IndicatorsType;
}

export const AntifraudIndicators: React.FC<AntifraudIndicatorsProps> = ({ indicators }) => {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const items = [
    {
      icon: Clock,
      label: 'Tempo parado total',
      value: formatDuration(indicators.totalStopTimeMinutes),
      color: indicators.totalStopTimeMinutes > 60 ? 'text-orange-600' : 'text-muted-foreground',
      bgColor: indicators.totalStopTimeMinutes > 60 ? 'bg-orange-50' : 'bg-muted/30',
    },
    {
      icon: MapPin,
      label: 'Qtd. de paradas',
      value: indicators.stopsCount.toString(),
      color: indicators.stopsCount > 5 ? 'text-orange-600' : 'text-muted-foreground',
      bgColor: indicators.stopsCount > 5 ? 'bg-orange-50' : 'bg-muted/30',
    },
    {
      icon: Navigation,
      label: 'Desvio máximo',
      value: `${indicators.routeDeviationMaxKm.toFixed(1)} km`,
      color: indicators.routeDeviationMaxKm > 5 ? 'text-red-600' : 'text-muted-foreground',
      bgColor: indicators.routeDeviationMaxKm > 5 ? 'bg-red-50' : 'bg-muted/30',
    },
    {
      icon: indicators.offlinePercentage > 10 ? WifiOff : Wifi,
      label: '% tempo offline',
      value: `${indicators.offlinePercentage.toFixed(1)}%`,
      color: indicators.offlinePercentage > 10 ? 'text-red-600' : 'text-muted-foreground',
      bgColor: indicators.offlinePercentage > 10 ? 'bg-red-50' : 'bg-muted/30',
    },
    {
      icon: AlertTriangle,
      label: 'Paradas alto risco',
      value: indicators.highRiskStops.toString(),
      color: indicators.highRiskStops > 0 ? 'text-red-600' : 'text-green-600',
      bgColor: indicators.highRiskStops > 0 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      icon: TrendingDown,
      label: 'ETA degradado',
      value: indicators.etaDegraded ? 'Sim' : 'Não',
      color: indicators.etaDegraded ? 'text-orange-600' : 'text-green-600',
      bgColor: indicators.etaDegraded ? 'bg-orange-50' : 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map((item, index) => (
        <Card key={index} className={`${item.bgColor} border-0`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground truncate">{item.label}</span>
            </div>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
