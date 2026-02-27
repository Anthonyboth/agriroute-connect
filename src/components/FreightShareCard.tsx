import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Package,
  ArrowRight,
  CheckCircle2,
  Eye,
  MessageSquare,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { ServiceProposalModal } from './ServiceProposalModal';
import { CompanyFreightAcceptModal } from './CompanyFreightAcceptModal';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useFreightShareActions } from '@/hooks/useFreightShareActions';
import { toast } from 'sonner';
import { formatKm } from '@/lib/formatters';
import { CenteredSpinner } from '@/components/ui/AppSpinner';

interface FreightShareCardProps {
  freightData: {
    type: string;
    freight_id: string;
    cargo_type: string;
    origin: string;
    destination: string;
    pickup_date: string;
    delivery_date: string;
    price: number;
    distance_km: number;
    weight: number;
    urgency: string;
    service_type: string;
    shared_by: string;
    shared_at: string;
  };
  messageId: string;
  onAccept?: () => void;
}

export const FreightShareCard: React.FC<FreightShareCardProps> = ({
  freightData,
  messageId,
  onAccept
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const { company } = useTransportCompany();
  
  const {
    status: shareStatus,
    canAccept,
    canCounterPropose,
    statusLabel,
    isAcceptedByOther,
    isCancelled,
    isLoading: isCheckingAvailability,
    refetch: recheckAvailability,
  } = useFreightShareActions(freightData.freight_id);

  const handleAcceptSuccess = () => {
    setAcceptModalOpen(false);
    toast.success('Frete aceito com sucesso!', {
      description: 'O frete foi atribuído à sua transportadora.'
    });
    recheckAvailability();
    onAccept?.();
  };

  const renderStatusBanner = () => {
    if (isCheckingAvailability) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Verificando disponibilidade...</span>
        </div>
      );
    }

    if (shareStatus === 'UNAVAILABLE') {
      return (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          isCancelled 
            ? 'bg-destructive/10 text-destructive' 
            : 'bg-warning/10 text-warning-foreground'
        }`}>
          {isCancelled ? (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">Frete Indisponível</p>
            <p className="text-xs opacity-80">{statusLabel}</p>
          </div>
        </div>
      );
    }

    if (shareStatus === 'ERROR') {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Erro ao verificar</p>
            <p className="text-xs opacity-80">{statusLabel}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Frete Compartilhado</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {shareStatus === 'AVAILABLE' && (
              <Badge className="bg-success/20 text-success border-success/30">
                Disponível
              </Badge>
            )}
            {shareStatus === 'UNAVAILABLE' && (
              <Badge variant="destructive" className="opacity-80">
                Indisponível
              </Badge>
            )}
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {freightData.service_type === 'GUINCHO' ? 'Guincho' : 
               freightData.service_type === 'MUDANCA' ? 'Mudança' : 'Carga'}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhado por <strong>{freightData.shared_by}</strong> • {
            new Date(freightData.shared_at).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          }
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Status Banner */}
        {renderStatusBanner()}

        {/* Resumo do Frete */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="font-medium">{freightData.cargo_type}</span>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Origem</p>
              <p className="text-muted-foreground text-xs">{freightData.origin}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Destino</p>
              <p className="text-muted-foreground text-xs">{freightData.destination}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {new Date(freightData.pickup_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-sm font-bold text-primary">
                R$ {freightData.price.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Detalhes Expandidos */}
        {showDetails && (
          <div className="pt-3 border-t border-border space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Peso:</span>{' '}
                <span className="font-medium">{(freightData.weight / 1000).toFixed(1)}t</span>
              </div>
              <div>
                <span className="text-muted-foreground">Distância:</span>{' '}
                <span className="font-medium">{formatKm(freightData.distance_km)}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Entrega:</span>{' '}
              <span className="font-medium">
                {new Date(freightData.delivery_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Urgência:</span>{' '}
              <Badge 
                variant={
                  freightData.urgency === 'HIGH' ? 'destructive' : 
                  freightData.urgency === 'LOW' ? 'secondary' : 'default'
                }
                className="text-xs"
              >
                {freightData.urgency === 'HIGH' ? 'Alta' : 
                 freightData.urgency === 'LOW' ? 'Baixa' : 'Normal'}
              </Badge>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showDetails ? 'Menos' : 'Mais'} Detalhes
          </Button>
          
          {canAccept && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 gradient-primary"
              onClick={() => setAcceptModalOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceitar Frete
            </Button>
          )}
        </div>

        {canCounterPropose && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-primary/30 hover:bg-primary/5"
            onClick={() => setProposalModalOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Fazer Contraproposta
          </Button>
        )}

        {shareStatus === 'UNAVAILABLE' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => recheckAvailability()}
          >
            <Loader2 className="h-4 w-4 mr-2" />
            Verificar novamente
          </Button>
        )}
      </CardContent>

      {/* Modal de Proposta */}
      <ServiceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        freight={{
          id: freightData.freight_id,
          cargo_type: freightData.cargo_type,
          weight: freightData.weight,
          origin_address: freightData.origin,
          destination_address: freightData.destination,
          pickup_date: freightData.pickup_date,
          delivery_date: freightData.delivery_date,
          price: freightData.price,
          distance_km: freightData.distance_km,
          service_type: freightData.service_type as any
        }}
        onSuccess={() => {
          setProposalModalOpen(false);
          recheckAvailability();
        }}
      />

      {/* Modal de Aceite para Transportadora */}
      {company && (
        <CompanyFreightAcceptModal
          isOpen={acceptModalOpen}
          onClose={() => {
            setAcceptModalOpen(false);
          }}
          freight={{
            id: freightData.freight_id,
            cargo_type: freightData.cargo_type,
            weight: freightData.weight,
            origin_address: freightData.origin,
            destination_address: freightData.destination,
            pickup_date: freightData.pickup_date,
            price: freightData.price
          }}
          driverId={freightData.shared_by}
          driverName="Motorista"
          companyOwnerId={company.profile_id}
          companyId={company.id}
        />
      )}
    </Card>
  );
};
