import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Truck, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ANTTValidation } from './ANTTValidation';
import { driverUpdateFreightStatus } from '@/lib/freight-status-helpers';
import { useAuth } from '@/hooks/useAuth';

interface MyAssignmentCardProps {
  assignment: any;
  onAction: () => void;
}

export const MyAssignmentCard: React.FC<MyAssignmentCardProps> = ({ assignment, onAction }) => {
  const freight = assignment.freight;
  const { profile: currentUserProfile } = useAuth();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentUserProfile || isUpdatingStatus) return;
    
    // Check if freight is in final status
    const finalStatuses = ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (finalStatuses.includes(freight.status)) {
      return; // Silently prevent action
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

  // Check if freight is in final status
  const isFreightFinal = ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(freight.status);
  
  return (
    <Card className="border-l-4 border-l-green-600">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{freight.cargo_type}</h3>
          {getStatusBadge(assignment.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Valor APENAS deste motorista */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
          <p className="text-sm text-muted-foreground">Seu valor acordado:</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {assignment.agreed_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {assignment.pricing_type === 'PER_KM' && assignment.price_per_km && (
            <p className="text-xs text-muted-foreground">
              R$ {assignment.price_per_km?.toFixed(2)}/km
            </p>
          )}
        </div>

        {/* Validação ANTT */}
        {assignment.minimum_antt_price && (
          <ANTTValidation
            proposedPrice={assignment.agreed_price}
            minimumAnttPrice={assignment.minimum_antt_price}
            distance={freight.distance_km}
          />
        )}

        {/* Informações da rota */}
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium">Origem:</span> {freight.origin_city}, {freight.origin_state}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-600" />
            <span className="font-medium">Destino:</span> {freight.destination_city}, {freight.destination_state}
          </p>
          <p className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>{freight.distance_km} km</span>
          </p>
        </div>

        {/* Informação de múltiplas carretas */}
        {freight.required_trucks > 1 && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Truck className="h-3 w-3" />
              Este frete tem {freight.required_trucks} carretas. 
              Você é uma delas ({freight.accepted_trucks}/{freight.required_trucks} contratadas).
            </p>
          </div>
        )}

        {/* Ações Rápidas para FRETE_MOTO */}
        {!isFreightFinal && (freight.service_type || freight.cargo_type) === 'FRETE_MOTO' && (
          <div className="flex flex-col gap-2 pt-2">
            {assignment.status === 'ACCEPTED' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('LOADING')}
                disabled={isUpdatingStatus}
              >
                🚚 Marcar "A caminho"
              </Button>
            )}
            {assignment.status === 'LOADING' && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleStatusChange('IN_TRANSIT')}
                disabled={isUpdatingStatus}
              >
                🛣️ Iniciar Trânsito
              </Button>
            )}
            {assignment.status === 'IN_TRANSIT' && (
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
              {freight.status === 'DELIVERED_PENDING_CONFIRMATION' && 'Aguardando confirmação de entrega'}
              {freight.status === 'DELIVERED' && 'Frete entregue'}
              {freight.status === 'COMPLETED' && 'Frete concluído'}
              {freight.status === 'CANCELLED' && 'Frete cancelado'}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={onAction}>
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};