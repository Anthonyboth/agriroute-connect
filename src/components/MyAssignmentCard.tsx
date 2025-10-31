import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Truck, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ANTTValidation } from './ANTTValidation';
import { ShareFreightToDriver } from './ShareFreightToDriver';
import { driverUpdateFreightStatus, FINAL_STATUSES } from '@/lib/freight-status-helpers';
import { useAuth } from '@/hooks/useAuth';
import { useTransportCompany } from '@/hooks/useTransportCompany';

interface MyAssignmentCardProps {
  assignment: any;
  onAction: () => void;
}

export const MyAssignmentCard: React.FC<MyAssignmentCardProps> = ({ assignment, onAction }) => {
  const { profile: currentUserProfile } = useAuth();
  const { company } = useTransportCompany();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 🛡️ Proteção contra null/undefined
  const freight = assignment?.freight ?? null;
  const status = assignment?.status ?? 'N/A';
  const agreedPrice = typeof assignment?.agreed_price === 'number' ? assignment.agreed_price : null;
  const pricePerKm = typeof assignment?.price_per_km === 'number' ? assignment.price_per_km : null;
  const minimumAnttPrice = typeof assignment?.minimum_antt_price === 'number' ? assignment.minimum_antt_price : null;

  // 🛡️ Se faltar assignment ou freight, renderiza fallback seguro
  if (!assignment || !freight) {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Frete não disponível</h3>
            <Badge variant="outline">N/A</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Este item não possui dados completos no momento.
        </CardContent>
      </Card>
    );
  }

  const isTransportCompany = currentUserProfile?.role === 'TRANSPORTADORA';

  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'ACCEPTED':
        return <Badge variant="outline">Aceito</Badge>;
      case 'LOADING':
        return <Badge variant="secondary">A Caminho</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="secondary">Em Trânsito</Badge>;
      case 'DELIVERED_PENDING_CONFIRMATION':
        return <Badge className="bg-orange-500">Aguardando Confirmação</Badge>;
      case 'DELIVERED':
        return <Badge variant="default">Entregue</Badge>;
      default:
        return <Badge variant="outline">{s || 'N/A'}</Badge>;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentUserProfile || isUpdatingStatus || !freight?.id) return;
    
    // ✅ Check if freight is in final status using central constant
    if (freight?.status && FINAL_STATUSES.includes(freight.status as any)) {
      return; // Silently prevent action (helper will show toast if somehow reached)
    }
    
    setIsUpdatingStatus(true);
    const success = await driverUpdateFreightStatus({
      freightId: freight.id,
      newStatus,
      currentUserProfile
    });
    setIsUpdatingStatus(false);
    
    if (success) {
      // Recarregar página para atualizar dados
      window.location.reload();
    }
  };

  // ✅ Check if freight is in final status using central constant
  const isFreightFinal = freight?.status ? FINAL_STATUSES.includes(freight.status as any) : false;

  // 🛡️ Proteção de dados para renderização
  const originCity = freight?.origin_city || '—';
  const originState = freight?.origin_state || '—';
  const destinationCity = freight?.destination_city || '—';
  const destinationState = freight?.destination_state || '—';
  const distanceKm = typeof freight?.distance_km === 'number' ? freight.distance_km : null;
  const requiredTrucks = typeof freight?.required_trucks === 'number' ? freight.required_trucks : 0;
  const acceptedTrucks = typeof freight?.accepted_trucks === 'number' ? freight.accepted_trucks : 0;
  const cargoType = freight?.cargo_type || freight?.service_type || '—';
  
  return (
    <Card className="border-l-4 border-l-green-600">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{cargoType}</h3>
          {getStatusBadge(status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Valor APENAS deste motorista */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
          <p className="text-sm text-muted-foreground">Seu valor acordado:</p>
          <p className="text-2xl font-bold text-green-600">
            {agreedPrice !== null
              ? `R$ ${agreedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : '—'}
          </p>
          {assignment?.pricing_type === 'PER_KM' && pricePerKm !== null && (
            <p className="text-xs text-muted-foreground">
              R$ {pricePerKm.toFixed(2)}/km
            </p>
          )}
        </div>

        {/* Validação ANTT */}
        {minimumAnttPrice !== null && typeof distanceKm === 'number' && (
          <ANTTValidation
            proposedPrice={agreedPrice ?? 0}
            minimumAnttPrice={minimumAnttPrice}
            distance={distanceKm}
          />
        )}

        {/* Informações da rota */}
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium">Origem:</span> {originCity}, {originState}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-600" />
            <span className="font-medium">Destino:</span> {destinationCity}, {destinationState}
          </p>
          <p className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>{typeof distanceKm === 'number' ? `${distanceKm} km` : '—'}</span>
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

        {/* Ações Rápidas para FRETE_MOTO */}
        {!isFreightFinal && (freight?.service_type || freight?.cargo_type) === 'FRETE_MOTO' && (
          <div className="flex flex-col gap-2 pt-2">
            {status === 'ACCEPTED' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('LOADING')}
                disabled={isUpdatingStatus}
              >
                🚚 Marcar "A caminho"
              </Button>
            )}
            {status === 'LOADING' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={isUpdatingStatus}
              >
                🛣️ Iniciar Trânsito
              </Button>
            )}
            {status === 'IN_TRANSIT' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('DELIVERED_PENDING_CONFIRMATION')}
                disabled={isUpdatingStatus}
              >
                ✅ Encerrar Frete
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