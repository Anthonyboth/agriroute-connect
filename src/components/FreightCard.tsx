import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceProposalModal } from './ServiceProposalModal';
import { Separator } from '@/components/ui/separator';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
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
  Home,
  Edit,
  X
} from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';

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
    status: 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'IN_NEGOTIATION' | 'ACCEPTED' | 'CANCELLED';
    distance_km: number;
    minimum_antt_price: number;
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA';
    required_trucks?: number;
    accepted_trucks?: number;
  };
  onAction?: (action: 'propose' | 'accept' | 'complete' | 'edit' | 'cancel') => void;
  showActions?: boolean;
  showProducerActions?: boolean;
}

export const FreightCard: React.FC<FreightCardProps> = ({ freight, onAction, showActions = false, showProducerActions = false }) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  
  // Verificar se o frete está com vagas completas
  const isFullyBooked = (freight.required_trucks || 1) <= (freight.accepted_trucks || 0);
  const availableSlots = (freight.required_trucks || 1) - (freight.accepted_trucks || 0);
  
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
    <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border border-border/60">
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getServiceIcon()}
              <h3 className="font-semibold text-foreground truncate text-lg">
                {getCargoTypeLabel(freight.cargo_type)}
              </h3>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant={urgencyVariant} className="text-xs font-medium">
                {urgencyLabel}
              </Badge>
              <Badge variant={getFreightStatusVariant(freight.status)} className="text-xs font-medium">
                {getFreightStatusLabel(freight.status)}
              </Badge>
            </div>
          </div>
          <div className="flex justify-start">
            <Badge variant="outline" className="text-xs bg-secondary/30">
              {getServiceLabel()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Carretas Info */}
        {(freight.required_trucks && freight.required_trucks > 1) && (
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/40">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-medium">Carretas:</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`font-semibold ${isFullyBooked ? 'text-success' : 'text-primary'}`}>
                {freight.accepted_trucks || 0}/{freight.required_trucks}
              </span>
              {isFullyBooked ? (
                <Badge variant="default" className="text-xs bg-success text-success-foreground">
                  Completo
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {availableSlots} vaga{availableSlots > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Peso/Info e Distância */}
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div className="flex items-center space-x-2 text-muted-foreground">
            {freight.service_type === 'GUINCHO' ? (
              <>
                <Wrench className="h-4 w-4" />
                <span className="text-sm font-medium">Reboque</span>
              </>
            ) : freight.service_type === 'MUDANCA' ? (
              <>
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">Residencial</span>
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                <span className="text-sm font-medium">{((freight.weight || 0) / 1000).toFixed(1)}t</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium">{freight.distance_km} km</span>
          </div>
        </div>

        {/* Origem e Destino */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Origem
            </p>
            <p className="text-sm text-muted-foreground pl-5">{freight.origin_address}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowRight className="h-3 w-3 text-accent" />
              Destino
            </p>
            <p className="text-sm text-muted-foreground pl-5">{freight.destination_address}</p>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 p-3 bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-lg border border-border/40">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Coleta</span>
            </div>
            <p className="font-semibold text-foreground text-sm">
              {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="space-y-2 p-3 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg border border-border/40">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium">Entrega</span>
            </div>
            <p className="font-semibold text-foreground text-sm">
              {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-6 pb-4">
        <div className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-border/50">
          <div className="text-left">
            <p className="font-bold text-2xl text-primary">R$ {(freight.price || 0).toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Min. ANTT: R$ {(freight.minimum_antt_price || 0).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="text-right">
            <DollarSign className="h-8 w-8 text-accent ml-auto" />
          </div>
        </div>
      </CardFooter>

      {showActions && onAction && freight.status === 'OPEN' && !isFullyBooked && (
        <div className="px-6 pb-6">
          {freight.service_type === 'GUINCHO' ? (
            <div className="flex gap-3">
              <Button 
                onClick={() => onAction('accept')}
                className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                Aceitar Chamado
              </Button>
              <Button 
                onClick={() => setProposalModalOpen(true)}
                className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                size="sm"
                variant="outline"
              >
                Contra proposta
              </Button>
            </div>
          ) : freight.service_type === 'MUDANCA' ? (
            <div className="flex gap-3">
              <Button 
                onClick={() => setProposalModalOpen(true)}
                className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                Fazer Orçamento
              </Button>
              <Button 
                onClick={() => setProposalModalOpen(true)}
                className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                size="sm"
                variant="outline"
              >
                Contra proposta
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                onClick={() => onAction('accept')}
                className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                Aceitar Frete
              </Button>
              <Button 
                onClick={() => setProposalModalOpen(true)}
                className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                size="sm"
                variant="outline"
              >
                Contra proposta
              </Button>
            </div>
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

      {/* Producer Actions */}
      {showProducerActions && onAction && freight.status !== 'CANCELLED' && (
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            <Button 
              onClick={() => onAction('edit')}
              className="flex-1"
              size="sm"
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            {freight.status === 'OPEN' && (
              <Button 
                onClick={() => onAction('cancel')}
                className="flex-1"
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mensagem para fretes cancelados */}
      {showProducerActions && freight.status === 'CANCELLED' && (
        <div className="px-6 pb-6">
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Fretes cancelados não podem ser editados
            </p>
          </div>
        </div>
      )}

      {/* Service Proposal Modal */}
      <ServiceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        freight={freight}
        originalProposal={freight.service_type === 'CARGA' || !freight.service_type ? {
          id: freight.id,
          proposed_price: freight.price,
          message: 'Proposta do produtor',
          driver_name: 'Produtor'
        } : undefined}
        onSuccess={() => {
          setProposalModalOpen(false);
          if (onAction) onAction('propose');
        }}
      />
    </Card>
  );
};
export default FreightCard;