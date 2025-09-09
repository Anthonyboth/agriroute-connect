import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Package, 
  Truck, 
  Calendar, 
  DollarSign, 
  Clock,
  Eye,
  FileText,
  ArrowRight 
} from 'lucide-react';

interface FreightCardProps {
  freight: {
    id: string;
    cargo_type: string;
    weight: number;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    delivery_date: string;
    price: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'OPEN' | 'IN_TRANSIT' | 'DELIVERED';
    distance_km: number;
    minimum_antt_price: number;
  };
  onAction?: (action: 'propose' | 'accept' | 'complete') => void;
  showActions?: boolean;
}

export const FreightCard: React.FC<FreightCardProps> = ({ freight, onAction, showActions = false }) => {
  const getUrgencyVariant = (urgency: string) => {
    switch (urgency) {
      case 'HIGH': return 'destructive';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'HIGH': return 'Alta';
      case 'LOW': return 'Baixa';
      default: return 'Normal';
    }
  };

  const urgencyVariant = getUrgencyVariant(freight.urgency);
  const urgencyLabel = getUrgencyLabel(freight.urgency);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">
              {freight.cargo_type}
            </h3>
          </div>
          <Badge variant={urgencyVariant}>
            {urgencyLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Peso e Distância */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{freight.weight >= 1000 ? `${(freight.weight / 1000).toFixed(1)}t` : `${freight.weight}kg`}</span>
          </div>
          <div className="flex items-center space-x-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{freight.distance_km} km</span>
          </div>
        </div>

        {/* Origem e Destino */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Origem</p>
            <p className="text-sm text-muted-foreground">{freight.origin_address}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-foreground">Destino</p>
            <p className="text-sm text-muted-foreground">{freight.destination_address}</p>
          </div>
        </div>

        <Separator />

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Coleta</span>
            </div>
            <p className="font-medium text-foreground">
              {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Entrega</span>
            </div>
            <p className="font-medium text-foreground">
              {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-right">
            <p className="font-semibold text-lg">R$ {freight.price.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground">
              Min. ANTT: R$ {freight.minimum_antt_price.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </CardFooter>

      {showActions && onAction && freight.status === 'OPEN' && (
        <div className="px-6 pb-6">
          <Button 
            onClick={() => onAction('propose')}
            className="w-full"
            size="sm"
          >
            Fazer Proposta
          </Button>
        </div>
      )}
    </Card>
  );
};
export default FreightCard;