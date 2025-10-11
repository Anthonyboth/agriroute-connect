import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, TrendingUp, Truck, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ANTTValidation } from './ANTTValidation';

interface MyAssignmentCardProps {
  assignment: any;
  onAction: () => void;
}

export const MyAssignmentCard: React.FC<MyAssignmentCardProps> = ({ assignment, onAction }) => {
  const freight = assignment.freight;
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge variant="outline">Aceito</Badge>;
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