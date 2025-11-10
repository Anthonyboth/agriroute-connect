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
import { MapPin, Truck, Clock, ArrowRight } from 'lucide-react';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatKm, formatBRL, formatTons, formatDate } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';

interface FreightInProgressCardProps {
  freight: {
    id: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    weight: number;
    distance_km: number;
    pickup_date: string;
    price: number;
    status: string;
    driver_profiles?: {
      full_name: string;
    } | null;
  };
  onViewDetails?: () => void;
  onRequestCancel?: () => void;
  showActions?: boolean;
}

export const FreightInProgressCard: React.FC<FreightInProgressCardProps> = ({
  freight,
  onViewDetails,
  onRequestCancel,
  showActions = true,
}) => {
  return (
    <Card className="h-full flex flex-col border-l-4 border-l-primary hover:shadow-lg transition-all">
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

            {/* Pílulas: peso, distância, data */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>{formatTons(freight.weight)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                <span>{formatKm(freight.distance_km)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span>{formatDate(freight.pickup_date)}</span>
              </div>
            </div>
          </div>

          {/* Status e Preço */}
          <div className="text-right space-y-2 flex-shrink-0">
            <Badge 
              variant={getFreightStatusVariant(freight.status)} 
              className="font-medium whitespace-nowrap"
            >
              {getFreightStatusLabel(freight.status)}
            </Badge>
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
