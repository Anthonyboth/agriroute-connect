import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Truck, DollarSign, AlertCircle, CheckCircle2, Navigation, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { ANTTValidation } from './ANTTValidation';
import { ShareFreightToDriver } from './ShareFreightToDriver';
import { driverUpdateFreightStatus, FINAL_STATUSES } from '@/lib/freight-status-helpers';
import { useAuth } from '@/hooks/useAuth';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatTons, formatKm, formatBRL, formatDate, formatCityState } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';
import { calculateVisiblePrice } from '@/hooks/useFreightCalculator';

interface MyAssignmentCardProps {
  assignment: any;
  onAction: () => void;
}

const MyAssignmentCardComponent: React.FC<MyAssignmentCardProps> = ({ assignment, onAction }) => {
  const { profile: currentUserProfile } = useAuth();
  const { company } = useTransportCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 🛡️ Proteção contra null/undefined
  const freight = assignment?.freight ?? null;
  const status = assignment?.status ?? 'N/A';
  const agreedPrice = typeof assignment?.agreed_price === 'number' ? assignment.agreed_price : null;
  const pricePerKm = typeof assignment?.price_per_km === 'number' ? assignment.price_per_km : null;
  const minimumAnttPrice = typeof assignment?.minimum_antt_price === 'number' ? assignment.minimum_antt_price : null;

  // 🛡️ Se faltar assignment ou freight, retornar null (não renderizar nada)
  if (!assignment || !freight) {
    return null;
  }

  const isTransportCompany = currentUserProfile?.role === 'TRANSPORTADORA';

  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'ACCEPTED':
        return <Badge variant="outline">Aceito</Badge>;
      case 'LOADING':
        return <Badge variant="secondary">A Caminho da Coleta</Badge>;
      case 'LOADED':
        return <Badge variant="secondary">Carregado</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="secondary">Em Trânsito</Badge>;
      case 'DELIVERED_PENDING_CONFIRMATION':
        return <Badge className="bg-orange-500">Entrega Reportada</Badge>;
      case 'DELIVERED':
        return <Badge variant="default">Entregue</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Concluído</Badge>;
      default:
        return <Badge variant="outline">{s || 'N/A'}</Badge>;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      if (!currentUserProfile || isUpdatingStatus || !freight?.id) {
        return;
      }
      
      if (freight?.status && FINAL_STATUSES.includes(freight.status as any)) {
        return;
      }
      
      setIsUpdatingStatus(true);
      
      const success = await driverUpdateFreightStatus({
        freightId: freight.id,
        newStatus,
        currentUserProfile,
        assignmentId: assignment.id
      });
      
      setIsUpdatingStatus(false);
      
      if (success) {
        // Combine query invalidations
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['assignments'] }),
          queryClient.invalidateQueries({ queryKey: ['freights'] }),
          queryClient.invalidateQueries({ queryKey: ['active-freight'] })
        ]);
        
        onAction();
        
      }
      
    } catch (error: any) {
      setIsUpdatingStatus(false);
      
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  // ✅ Check if freight is in final status using central constant
  const isFreightFinal = freight?.status ? FINAL_STATUSES.includes(freight.status as any) : false;

  // 🛡️ Proteção de dados para renderização
  const originLabel = formatCityState(freight?.origin_city || null, freight?.origin_state || null);
  const destinationLabel = formatCityState(freight?.destination_city || null, freight?.destination_state || null);
  const distanceKm = typeof freight?.distance_km === 'number' ? freight.distance_km : null;
  const requiredTrucks = typeof freight?.required_trucks === 'number' ? freight.required_trucks : 0;
  const acceptedTrucks = typeof freight?.accepted_trucks === 'number' ? freight.accepted_trucks : 0;
  const cargoType = freight?.cargo_type || freight?.service_type || '—';

  // ✅ Hook centralizado: calculateVisiblePrice para MOTORISTA
  const visiblePrice = calculateVisiblePrice(
    isTransportCompany ? 'TRANSPORTADORA' : 'MOTORISTA',
    {
      id: freight?.id || '',
      price: typeof freight?.price === 'number' && Number.isFinite(freight.price) ? freight.price : 0,
      required_trucks: requiredTrucks,
    },
    agreedPrice != null ? {
      id: assignment?.id || '',
      driver_id: assignment?.driver_id || '',
      agreed_price: agreedPrice,
      pricing_type: (assignment?.pricing_type || 'FIXED') as any,
      status: status,
    } : null,
  );
  
  return (
    <Card className="border-l-4 border-l-green-600 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold truncate flex-1">{cargoType}</h3>
          <div className="flex items-center gap-2">
            {getStatusBadge(status)}
            {/* Badge de data de coleta */}
            {(() => {
              const badgeInfo = getPickupDateBadge(freight?.pickup_date);
              if (!badgeInfo) return null;
              
              const iconMap = { AlertTriangle, Clock, Calendar };
              const IconComponent = iconMap[badgeInfo.icon];
              
              return (
                <Badge variant={badgeInfo.variant} className="flex items-center gap-1 text-xs">
                  <IconComponent className="h-3 w-3" />
                  {badgeInfo.text}
                </Badge>
              );
            })()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 overflow-hidden">
        {/* Valor APENAS deste motorista */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
          <p className="text-sm text-muted-foreground">Seu valor acordado:</p>
          <p className="text-2xl font-bold text-green-600">
            {visiblePrice.formattedPrice}
            {visiblePrice.suffix && (
              <span className="text-xs font-semibold text-muted-foreground ml-1">{visiblePrice.suffix}</span>
            )}
          </p>
          {assignment?.pricing_type === 'PER_KM' && pricePerKm !== null && (
            <p className="text-xs text-muted-foreground">
              {formatBRL(pricePerKm)}/km
            </p>
          )}
        </div>

        {/* Validação ANTT */}
        {minimumAnttPrice !== null && typeof distanceKm === 'number' && (
          <ANTTValidation
            proposedPrice={visiblePrice.displayPrice}
            minimumAnttPrice={minimumAnttPrice}
            distance={distanceKm}
          />
        )}

        {/* Informações da rota */}
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium">Origem:</span> {originLabel}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-600" />
            <span className="font-medium">Destino:</span> {destinationLabel}
          </p>
          <p className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>{formatKm(distanceKm)}</span>
          </p>
        </div>

        {/* Informação de múltiplas carretas */}
        {requiredTrucks > 1 && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Truck className="h-3 w-3" />
              Este frete tem {requiredTrucks} carretas. 
              Você é uma delas ({acceptedTrucks}/{requiredTrucks} contratadas).
            </p>
          </div>
        )}

        {/* Ações Rápidas de Atualização de Status - Fluxo Completo */}
        {!isFreightFinal && (
          <div className="flex flex-col gap-2 pt-2">
            {status === 'ACCEPTED' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('LOADING')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <Truck className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Marcar como "A caminho"</span>
              </Button>
            )}
            {status === 'LOADING' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('LOADED')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Confirmar Carregamento</span>
              </Button>
            )}
            {status === 'LOADED' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Iniciar Trânsito</span>
              </Button>
            )}
            {status === 'IN_TRANSIT' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('DELIVERED_PENDING_CONFIRMATION')}
                disabled={isUpdatingStatus}
                className="w-full whitespace-nowrap overflow-hidden text-ellipsis"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Reportar Entrega</span>
              </Button>
            )}
          </div>
        )}

        {/* Show final status message if applicable */}
        {isFreightFinal && (
          <div className="p-2 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              {freight?.status === 'DELIVERED_PENDING_CONFIRMATION' && 'Aguardando confirmação de entrega'}
              {freight?.status === 'DELIVERED' && 'Frete entregue'}
              {freight?.status === 'COMPLETED' && 'Frete concluído'}
              {freight?.status === 'CANCELLED' && 'Frete cancelado'}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          {/* Botão de compartilhamento para transportadoras */}
          {isTransportCompany && company?.id && status === 'ACCEPTED' && (
            <ShareFreightToDriver
              freight={freight}
              companyId={company.id}
              onSuccess={onAction}
            />
          )}
          
          <Button className="flex-1" onClick={onAction}>
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Memoize component to prevent unnecessary re-renders
export const MyAssignmentCard = React.memo(MyAssignmentCardComponent);