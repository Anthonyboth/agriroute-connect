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
import { MapPin, Truck, Clock, ArrowRight, Calendar, AlertTriangle, Bike } from 'lucide-react';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatKm, formatBRL, formatTons, formatDate } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { getDaysUntilPickup, getPickupDateBadge } from '@/utils/freightDateHelpers';

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
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO';
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

const FreightInProgressCardComponent: React.FC<FreightInProgressCardProps> = ({
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
      "h-full flex flex-col border-l-4 hover:shadow-lg transition-all overflow-x-auto",
      isHighlighted ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-xl animate-pulse" : "border-l-primary"
    )}>
      <CardHeader className="pb-4 min-h-[120px] overflow-x-auto">
        <div className="min-w-fit">
          {/* Origem → Destino */}
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-sm whitespace-nowrap">
              {freight.origin_city && freight.origin_state 
                ? `${freight.origin_city}, ${freight.origin_state}`
                : 'Carregando origem...'}
            </p>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="font-semibold text-sm whitespace-nowrap">
              {freight.destination_city && freight.destination_state
                ? `${freight.destination_city}, ${freight.destination_state}`
                : 'Carregando destino...'}
            </p>
          </div>

          {/* Container para badges e informações */}
          <div className="flex items-start justify-between gap-3 mt-3">
            {/* Pílulas: peso, distância (com precisão GPS), data */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>{formatTons(freight.weight)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0" title={precisionInfo.tooltip}>
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>{formatKm(parseFloat(String(freight.distance_km).replace(/[^\d.]/g, '')) || 0)}</span>
                <span className="text-[10px]">{precisionInfo.icon}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap shrink-0">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span>{formatDate(freight.pickup_date)}</span>
              </div>
              {/* Badge de capacidade máxima para moto */}
              {freight.service_type === 'FRETE_MOTO' && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 shrink-0">
                  <Bike className="h-3 w-3 mr-1" />
                  Máx. 500kg
                </Badge>
              )}
            </div>

            {/* Status e Preço no lado direito */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge 
                variant={getFreightStatusVariant(freight.status)} 
                className="font-medium whitespace-nowrap"
              >
                {getFreightStatusLabel(freight.status)}
              </Badge>
              
              {/* Badge de dias até coleta */}
              {(() => {
                const badgeInfo = getPickupDateBadge(freight.pickup_date);
                
                if (!badgeInfo) return null;
                
                const iconMap = {
                  AlertTriangle,
                  Clock,
                  Calendar
                };
                const IconComponent = iconMap[badgeInfo.icon];
                
                return (
                  <Badge variant={badgeInfo.variant} className="text-xs whitespace-nowrap flex items-center gap-1 justify-end">
                    <IconComponent className="h-3 w-3" />
                    {badgeInfo.text}
                  </Badge>
                );
              })()}
            
              <p className="font-bold text-lg text-primary whitespace-nowrap">
                {formatBRL(freight.price, true)}
              </p>
            </div>
          </div>

          {/* Deadline indicator */}
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

// ✅ PHASE 1: Memoização para evitar re-renders desnecessários em listas
export const FreightInProgressCard = React.memo(FreightInProgressCardComponent, (prevProps, nextProps) => {
  // Comparador customizado para evitar re-renders desnecessários
  return (
    prevProps.freight.id === nextProps.freight.id &&
    prevProps.freight.status === nextProps.freight.status &&
    prevProps.freight.price === nextProps.freight.price &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.highlightFreightId === nextProps.highlightFreightId &&
    prevProps.onViewDetails === nextProps.onViewDetails &&
    prevProps.onRequestCancel === nextProps.onRequestCancel
  );
});
