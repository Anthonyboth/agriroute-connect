import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlexibleProposalModal } from './FlexibleProposalModal';
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
  ArrowRight,
  Wrench,
  Home 
} from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';

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
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA';
  };
  onAction?: (action: 'propose' | 'accept' | 'complete') => void;
  showActions?: boolean;
}

export const FreightCard: React.FC<FreightCardProps> = ({ freight, onAction, showActions = false }) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
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

  // Icon based on service type
  const getServiceIcon = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-5 w-5 text-warning" />;
      case 'MUDANCA':
        return <Home className="h-5 w-5 text-accent" />;
      default:
        return <Package className="h-5 w-5 text-primary" />;
    }
  };

  // Service type label
  const getServiceLabel = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return 'Guincho';
      case 'MUDANCA':
        return 'Mudança';
      default:
        return 'Carga';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getServiceIcon()}
              <h3 className="font-semibold text-foreground truncate">
                {getCargoTypeLabel(freight.cargo_type)}
              </h3>
            </div>
            <Badge variant={urgencyVariant} className="flex-shrink-0 ml-2">
              {urgencyLabel}
            </Badge>
          </div>
          <div className="flex justify-start">
            <Badge variant="outline" className="text-xs">
              {getServiceLabel()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Peso/Info e Distância */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1 text-muted-foreground">
            {freight.service_type === 'GUINCHO' ? (
              <>
                <Wrench className="h-4 w-4" />
                <span>Reboque</span>
              </>
            ) : freight.service_type === 'MUDANCA' ? (
              <>
                <Home className="h-4 w-4" />
                <span>Residencial</span>
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                <span>{freight.weight >= 1000 ? `${(freight.weight / 1000).toFixed(1)}t` : `${freight.weight}kg`}</span>
              </>
            )}
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
            onClick={() => {
              if (freight.service_type === 'CARGA') {
                setProposalModalOpen(true);
              } else {
                onAction('propose');
              }
            }}
            className="w-full"
            size="sm"
          >
            {freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' : 
             freight.service_type === 'MUDANCA' ? 'Fazer Orçamento' : 
             'Fazer Proposta'}
          </Button>
        </div>
      )}

      {/* Flexible Proposal Modal */}
      <FlexibleProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        freight={{
          ...freight,
          producer_name: 'Produtor',
          scheduled_date: freight.pickup_date,
          flexible_dates: true,
          date_range_start: freight.pickup_date,
          date_range_end: freight.delivery_date
        }}
        onSuccess={() => {
          setProposalModalOpen(false);
          if (onAction) onAction('propose');
        }}
      />
    </Card>
  );
};
export default FreightCard;