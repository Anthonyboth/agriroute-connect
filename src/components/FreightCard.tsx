import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProposalCounterModal } from './ProposalCounterModal';
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
    required_trucks?: number;
    accepted_trucks?: number;
  };
  onAction?: (action: 'propose' | 'accept' | 'complete') => void;
  showActions?: boolean;
}

export const FreightCard: React.FC<FreightCardProps> = ({ freight, onAction, showActions = false }) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  
  // Verificar se o frete está com vagas completas
  const isFullyBooked = (freight.required_trucks || 1) <= (freight.accepted_trucks || 0);
  const availableSlots = (freight.required_trucks || 1) - (freight.accepted_trucks || 0);
  
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
        {/* Carretas Info */}
        {(freight.required_trucks && freight.required_trucks > 1) && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Carretas:</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${isFullyBooked ? 'text-green-600' : 'text-primary'}`}>
                {freight.accepted_trucks || 0}/{freight.required_trucks}
              </span>
              {isFullyBooked && (
                <Badge variant="default" className="text-xs bg-green-500">
                  Completo
                </Badge>
              )}
              {!isFullyBooked && availableSlots > 0 && (
                <Badge variant="outline" className="text-xs">
                  {availableSlots} vaga{availableSlots > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        )}

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
                <span>{(freight.weight / 1000).toFixed(1)}t</span>
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

        {/* Informações de carretas */}
        {(freight.required_trucks || 1) > 1 && (
          <div className="mt-4 p-3 bg-secondary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Carretas</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {freight.accepted_trucks || 0}/{freight.required_trucks || 1}
                </span>
                {isFullyBooked ? (
                  <Badge variant="destructive" className="text-xs">Completo</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {availableSlots} vaga{availableSlots !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
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

      {showActions && onAction && freight.status === 'OPEN' && !isFullyBooked && (
        <div className="px-6 pb-6">
          {(freight.service_type === 'CARGA' || !freight.service_type) ? (
            <div className="flex gap-2">
              <Button 
                onClick={() => onAction('accept')}
                className="flex-1"
                size="sm"
              >
                Aceitar Frete
              </Button>
              <Button 
                onClick={() => setProposalModalOpen(true)}
                className="flex-1"
                size="sm"
                variant="secondary"
              >
                Fazer Contra-Proposta
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => onAction('propose')}
              className="w-full"
              size="sm"
            >
               {freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' : 
                freight.service_type === 'MUDANCA' ? 'Fazer Orçamento' : 
                'Fazer Contra-Proposta'}
            </Button>
          )}
        </div>
      )}

      {showActions && isFullyBooked && (
        <div className="px-6 pb-6">
          <Button disabled className="w-full" size="sm" variant="secondary">
            Frete Completo - Sem Vagas
          </Button>
        </div>
      )}

      {/* Counter Proposal Modal */}
      <ProposalCounterModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        originalProposal={{
          id: freight.id,
          freight_id: freight.id,
          proposed_price: freight.price,
          message: 'Proposta do produtor',
          driver_name: 'Produtor'
        }}
        freightPrice={freight.price}
        onSuccess={() => {
          setProposalModalOpen(false);
          if (onAction) onAction('propose');
        }}
      />
    </Card>
  );
};
export default FreightCard;