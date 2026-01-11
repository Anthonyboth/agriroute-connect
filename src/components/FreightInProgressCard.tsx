/**
 * src/components/FreightInProgressCard.tsx
 * 
 * Card padronizado para fretes em andamento.
 * Usado em múltiplos dashboards (Produtor, Motorista, Transportadora).
 * Inclui abas para Detalhes e Mapa em tempo real.
 */

import React, { useState, lazy, Suspense } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Truck, Clock, ArrowRight, Calendar, AlertTriangle, Bike, Map, FileText, Loader2 } from 'lucide-react';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatKm, formatBRL, formatTons, formatDate } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { getDaysUntilPickup, getPickupDateBadge } from '@/utils/freightDateHelpers';

// Lazy load do mapa MapLibre para performance (100% gratuito, sem Google Maps)
const FreightRealtimeMap = lazy(() => 
  import('@/components/freight/FreightRealtimeMapMapLibre').then(module => ({ 
    default: module.FreightRealtimeMapMapLibre 
  }))
);

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
    // Campos de tracking
    current_lat?: number;
    current_lng?: number;
    last_location_update?: string;
    tracking_status?: string;
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
  const [activeTab, setActiveTab] = useState<string>('details');
  const [mapMounted, setMapMounted] = useState(false);

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

  // Verificar se o frete está em andamento (permite mapa)
  const isInProgress = ['em_transito', 'in_transit', 'in_progress', 'aceito', 'accepted', 'carregando', 'loading'].includes(freight.status?.toLowerCase() || '');

  // Handler para quando a aba mapa é selecionada
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'map' && !mapMounted) {
      setMapMounted(true);
    }
  };

  return (
    <Card className={cn(
      "h-full flex flex-col border-l-4 hover:shadow-lg transition-all overflow-hidden",
      isHighlighted ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-xl ring-2 ring-yellow-400" : "border-l-primary"
    )}>
      <CardHeader className="pb-2 min-h-[100px] overflow-x-auto">
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
                <span>{formatKm(typeof freight.distance_km === 'number' ? freight.distance_km : 0)}</span>
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

      <CardContent className="flex flex-col gap-2 flex-1 pt-0 overflow-hidden">
        {/* Abas: Detalhes e Mapa */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="details" className="text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger 
              value="map" 
              className="text-xs flex items-center gap-1.5"
              disabled={!isInProgress}
            >
              <Map className="h-3.5 w-3.5" />
              Mapa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 flex flex-col mt-2">
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
              <div className="mt-auto grid grid-cols-2 gap-3 pt-3">
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
          </TabsContent>

          <TabsContent value="map" className="flex-1 mt-2">
            {mapMounted && (
              <Suspense fallback={
                <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">Carregando mapa...</span>
                  </div>
                </div>
              }>
                <FreightRealtimeMap
                  freightId={freight.id}
                  originLat={freight.origin_lat}
                  originLng={freight.origin_lng}
                  destinationLat={freight.destination_lat}
                  destinationLng={freight.destination_lng}
                  initialDriverLat={freight.current_lat}
                  initialDriverLng={freight.current_lng}
                  lastLocationUpdate={freight.last_location_update}
                />
              </Suspense>
            )}
            {!mapMounted && (
              <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Map className="h-8 w-8 opacity-50" />
                  <span className="text-sm">Clique para carregar o mapa</span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// ✅ Memoização para evitar re-renders desnecessários em listas
// Não comparar callbacks (onViewDetails, onRequestCancel) pois são instáveis quando inline
export const FreightInProgressCard = React.memo(FreightInProgressCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.freight.id === nextProps.freight.id &&
    prevProps.freight.status === nextProps.freight.status &&
    prevProps.freight.price === nextProps.freight.price &&
    prevProps.freight.current_lat === nextProps.freight.current_lat &&
    prevProps.freight.current_lng === nextProps.freight.current_lng &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.highlightFreightId === nextProps.highlightFreightId
    // Removidos onViewDetails e onRequestCancel - callbacks inline quebram memo
  );
});
