/**
 * src/components/FreightInProgressCard.tsx
 * 
 * Card padronizado para fretes em andamento.
 * Usado em múltiplos dashboards (Produtor, Motorista, Transportadora).
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Truck, Clock, ArrowRight, Calendar, AlertTriangle } from 'lucide-react';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatKm, formatBRL, formatTons, formatDate } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

// Helper para calcular dias até a coleta
const getDaysUntilPickup = (pickupDate: string | null): number | null => {
  if (!pickupDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pickup = new Date(pickupDate);
  pickup.setHours(0, 0, 0, 0);
  
  const diffTime = pickup.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Helper para gerar badge de dias até coleta
const getDaysUntilPickupBadge = (days: number | null) => {
  if (days === null) return null;
  
  let variant: 'destructive' | 'default' | 'secondary' = 'default';
  let IconComponent = Calendar;
  let text = '';
  
  if (days < 0) {
    variant = 'destructive';
    IconComponent = AlertTriangle;
    text = `${Math.abs(days)} dia(s) atrasado`;
  } else if (days === 0) {
    variant = 'default';
    IconComponent = Clock;
    text = 'Coleta hoje';
  } else if (days === 1) {
    variant = 'secondary';
    text = 'Coleta amanhã';
  } else if (days <= 3) {
    variant = 'secondary';
    text = `${days} dias para coleta`;
  } else {
    variant = 'default';
    text = `${days} dias para coleta`;
  }
  
  return { variant, icon: IconComponent, text };
};

interface FreightInProgressCardProps {
  freight: {
    id: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    origin_lat?: number;
    origin_lng?: number;
    destination_lat?: number;
    destination_lng?: number;
    weight: number;
    distance_km: number;
    pickup_date: string;
    price: number;
    status: string;
    driver_profiles?: {
      full_name: string;
    } | null;
    deliveryDeadline?: {
      hoursRemaining: number;
      isUrgent: boolean;
      isCritical: boolean;
      displayText: string;
    };
  };
  onViewDetails?: () => void;
  onRequestCancel?: () => void;
  showActions?: boolean;
  highlightFreightId?: string;
}

export const FreightInProgressCard: React.FC<FreightInProgressCardProps> = ({
  freight,
  onViewDetails,
  onRequestCancel,
  showActions = true,
  highlightFreightId,
}) => {
  // GPS precision indicator
  const precisionInfo = React.useMemo(() => {
    const originReal = freight.origin_lat !== null && freight.origin_lat !== undefined && 
                       freight.origin_lng !== null && freight.origin_lng !== undefined;
    const destReal = freight.destination_lat !== null && freight.destination_lat !== undefined && 
                     freight.destination_lng !== null && freight.destination_lng !== undefined;
    
    if (originReal && destReal) {
      return {
        isAccurate: true,
        icon: '📍',
        tooltip: 'Distância calculada com GPS preciso'
      };
    }
    
    return {
      isAccurate: false,
      icon: '📌',
      tooltip: 'Distância estimada por endereço'
    };
  }, [freight.origin_lat, freight.origin_lng, freight.destination_lat, freight.destination_lng]);

  const isHighlighted = highlightFreightId === freight.id;

  return (
    <Card className={cn(
      "h-full flex flex-col border-l-4 hover:shadow-lg transition-all",
      isHighlighted ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-xl animate-pulse" : "border-l-primary"
    )}>
      <CardHeader className="pb-4 min-h-[120px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Origem → Destino */}
            <div className="flex items-center gap-2 mb-2">
              <p className="font-semibold text-sm truncate line-clamp-1">
                {freight.origin_city || 'Origem'} - {freight.origin_state || ''}
              </p>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="font-semibold text-sm truncate line-clamp-1">
                {freight.destination_city || 'Destino'} - {freight.destination_state || ''}
              </p>
            </div>

            {/* Pílulas: peso, distância (com precisão GPS), data */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>{formatTons(freight.weight)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap" title={precisionInfo.tooltip}>
                <MapPin className="h-3.5 w-3.5 text-accent" />
                <span>{formatKm(freight.distance_km)}</span>
                <span className="text-[10px]">{precisionInfo.icon}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span>{formatDate(freight.pickup_date)}</span>
              </div>
            </div>

            {/* 🔥 Deadline indicator */}
            {freight.deliveryDeadline && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-bold mt-2",
                freight.deliveryDeadline.isCritical && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                freight.deliveryDeadline.isUrgent && !freight.deliveryDeadline.isCritical && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                !freight.deliveryDeadline.isUrgent && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
              )}>
                <Clock className="h-3 w-3" />
                {freight.deliveryDeadline.displayText}
              </div>
            )}
          </div>

          {/* Status, Badge de Dias até Coleta e Preço */}
          <div className="text-right space-y-2 flex-shrink-0">
            <Badge 
              variant={getFreightStatusVariant(freight.status)} 
              className="font-medium whitespace-nowrap"
            >
              {getFreightStatusLabel(freight.status)}
            </Badge>
            
            {/* 📅 Badge de dias até coleta */}
            {(() => {
              const days = getDaysUntilPickup(freight.pickup_date);
              const badge = getDaysUntilPickupBadge(days);
              
              if (!badge) return null;
              
              const IconComponent = badge.icon;
              
              return (
                <Badge variant={badge.variant} className="text-xs whitespace-nowrap flex items-center gap-1 justify-end">
                  <IconComponent className="h-3 w-3" />
                  {badge.text}
                </Badge>
              );
            })()}
            
            <p className="font-bold text-lg text-primary whitespace-nowrap">
              R$ {formatBRL(freight.price)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 h-full pt-0 overflow-hidden">
        {/* Grid de informações */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-xs text-muted-foreground whitespace-nowrap">
              {LABELS.MOTORISTA_LABEL}
            </p>
            <p className="text-foreground truncate whitespace-nowrap">
              {freight.driver_profiles?.full_name || LABELS.AGUARDANDO_MOTORISTA}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-xs text-muted-foreground whitespace-nowrap">
              {LABELS.PESO_LABEL}
            </p>
            <p className="text-foreground truncate whitespace-nowrap">
              {formatTons(freight.weight)}
            </p>
          </div>
        </div>

        {/* Botões de ação */}
        {showActions && (
          <div className="mt-auto grid grid-cols-2 gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onViewDetails}
              className="w-full"
            >
              {LABELS.VER_DETALHES}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onRequestCancel}
              className="w-full"
            >
              {LABELS.SOLICITAR_CANCELAMENTO}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
