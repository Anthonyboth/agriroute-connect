import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Truck, Clock, Eye, X, MessageCircle, Calendar, Package } from 'lucide-react';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatCurrencyBRL, formatKmCompact, formatDate, formatWeight } from '@/lib/format';

interface ProducerFreightCardProps {
  freight: {
    id: string;
    cargo_type: string;
    weight: number; // in kg
    distance_km: number;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    delivery_date: string;
    price: number;
    status: string;
    driver_profiles?: {
      full_name?: string;
      contact_phone?: string;
    };
  };
  onViewDetails: () => void;
  onCancel?: () => void;
  onRequestCancel?: () => void;
}

/**
 * Optimized freight card for Producer Dashboard "Fretes em Andamento"
 * Features:
 * - Prominent price display (top-right on desktop, top row on mobile)
 * - Compact metadata grid for km, dates, and weight
 * - Sticky action buttons at the bottom
 * - Responsive layout with proper overflow handling
 */
export const ProducerFreightCard: React.FC<ProducerFreightCardProps> = ({
  freight,
  onViewDetails,
  onCancel,
  onRequestCancel,
}) => {
  const canCancelDirectly = ['ACCEPTED', 'LOADING'].includes(freight.status);
  const needsRequestCancel = ['LOADED', 'IN_TRANSIT'].includes(freight.status);

  return (
    <Card className="flex flex-col h-full min-h-[320px] border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
      {/* Header with title and price */}
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          {/* Title and status */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-base truncate">{freight.cargo_type}</h3>
            </div>
            <Badge variant={getFreightStatusVariant(freight.status)} className="text-xs font-medium w-fit">
              {getFreightStatusLabel(freight.status)}
            </Badge>
          </div>

          {/* Price - Always visible and prominent */}
          <div className="flex-shrink-0 text-left sm:text-right">
            <p className="text-xs text-muted-foreground font-medium mb-1">Seu preço acordado</p>
            <p className="font-bold text-xl text-primary whitespace-nowrap">
              {formatCurrencyBRL(freight.price)}
            </p>
          </div>
        </div>
      </CardHeader>

      {/* Content with metadata */}
      <CardContent className="flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Route information */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <span className="sr-only">Origem: </span>
              <p className="text-xs text-muted-foreground line-clamp-2">{freight.origin_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <span className="sr-only">Destino: </span>
              <p className="text-xs text-muted-foreground line-clamp-2">{freight.destination_address}</p>
            </div>
          </div>
        </div>

        {/* Compact metadata grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Distance */}
          <div className="p-2 bg-muted/40 rounded-lg border border-border/40">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-accent" />
              <span className="text-xs text-muted-foreground">Distância</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatKmCompact(freight.distance_km)}</p>
          </div>

          {/* Weight */}
          <div className="p-2 bg-muted/40 rounded-lg border border-border/40">
            <div className="flex items-center gap-1 mb-1">
              <Truck className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">Peso</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatWeight(freight.weight)}</p>
          </div>

          {/* Pickup Date */}
          <div className="p-2 bg-muted/40 rounded-lg border border-border/40">
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">Coleta</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatDate(freight.pickup_date)}</p>
          </div>
        </div>

        {/* Driver info if available */}
        {freight.driver_profiles?.full_name && (
          <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Motorista</p>
            <p className="text-sm font-medium text-foreground">{freight.driver_profiles.full_name}</p>
            {freight.driver_profiles.contact_phone && (
              <p className="text-xs text-muted-foreground">{freight.driver_profiles.contact_phone}</p>
            )}
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        <div className="flex-1"></div>

        {/* Actions row - pinned at bottom */}
        <div className="flex gap-2 pt-2 mt-auto flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            onClick={onViewDetails}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalhes
          </Button>

          {canCancelDirectly && onCancel && (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 hover:shadow-lg transition-all duration-300"
              onClick={onCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}

          {needsRequestCancel && onRequestCancel && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              onClick={onRequestCancel}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Solicitar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
