import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  MessageCircle, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Truck, 
  Package,
  Calendar,
  DollarSign,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PaymentCardData {
  id: string;
  freight_id: string;
  driver_id: string;
  amount: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  freight?: {
    id: string;
    cargo_type: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    pickup_date?: string;
    status?: string;
    price?: number;
    distance_km?: number;
  };
  driver?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    profile_photo_url?: string;
  };
}

interface PaymentCardProps {
  payment: PaymentCardData;
  onConfirmPayment: (paymentId: string) => void;
  onOpenChat: (freightId: string, driverId: string) => void;
  isLoading?: boolean;
  defaultExpanded?: boolean;
}

// ✅ Normalizar status do banco para UI
const normalizeStatus = (status: string): string => {
  // 'confirmed' do banco = 'completed' na UI
  if (status === 'confirmed') return 'completed';
  return status;
};

const getStatusConfig = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  
  switch (normalizedStatus) {
    case 'proposed':
      return {
        label: 'Pendente',
        variant: 'default' as const,
        bgColor: 'bg-blue-50 border-blue-200',
        iconColor: 'text-blue-600',
        icon: Clock
      };
    case 'paid_by_producer':
      return {
        label: 'Aguardando Motorista',
        variant: 'secondary' as const,
        bgColor: 'bg-orange-50 border-orange-200',
        iconColor: 'text-orange-600',
        icon: Clock
      };
    case 'completed':
      return {
        label: 'Concluído',
        variant: 'secondary' as const,
        bgColor: 'bg-green-50 border-green-200',
        iconColor: 'text-green-600',
        icon: CheckCircle
      };
    case 'rejected':
      return {
        label: 'Rejeitado',
        variant: 'destructive' as const,
        bgColor: 'bg-red-50 border-red-200',
        iconColor: 'text-red-600',
        icon: DollarSign
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        variant: 'outline' as const,
        bgColor: 'bg-gray-50 border-gray-200',
        iconColor: 'text-gray-600',
        icon: DollarSign
      };
    default:
      return {
        label: status,
        variant: 'outline' as const,
        bgColor: 'bg-muted/50 border-border',
        iconColor: 'text-muted-foreground',
        icon: DollarSign
      };
  }
};

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onConfirmPayment,
  onOpenChat,
  isLoading = false,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const statusConfig = getStatusConfig(payment.status);
  const StatusIcon = statusConfig.icon;

  const formatRoute = () => {
    if (!payment.freight) return 'Rota não disponível';
    const origin = payment.freight.origin_city 
      ? `${payment.freight.origin_city}/${payment.freight.origin_state}` 
      : 'Origem';
    const destination = payment.freight.destination_city 
      ? `${payment.freight.destination_city}/${payment.freight.destination_state}` 
      : 'Destino';
    return `${origin} → ${destination}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMM, yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`transition-all duration-200 ${statusConfig.bgColor} ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Avatar e Info Principal */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-10 w-10 shrink-0">
                    <SignedAvatarImage src={payment.driver?.profile_photo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">
                        {payment.driver?.full_name || 'Motorista'}
                      </h4>
                      {payment.freight?.cargo_type && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {payment.freight.cargo_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {formatRoute()}
                    </p>
                  </div>
                </div>

                {/* Valor e Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-base">
                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <Badge 
                      variant={statusConfig.variant}
                      className={`text-xs ${payment.status === 'completed' ? 'bg-green-100 text-green-800' : payment.status === 'paid_by_producer' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 border-t border-border/50">
            <div className="space-y-4 pt-4">
              {/* Detalhes do Frete */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {payment.freight?.pickup_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Coleta:</span>
                    <span className="font-medium">{formatDate(payment.freight.pickup_date)}</span>
                  </div>
                )}
                
                {payment.freight?.distance_km && (
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Distância:</span>
                    <span className="font-medium">{payment.freight.distance_km.toLocaleString('pt-BR')} km</span>
                  </div>
                )}
                
                {payment.freight?.price && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Valor do Frete:</span>
                    <span className="font-medium">R$ {payment.freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Solicitado em:</span>
                  <span className="font-medium">{formatDate(payment.created_at)}</span>
                </div>
              </div>

              {/* Notas */}
              {payment.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Observações:</p>
                  <p className="text-sm text-muted-foreground">{payment.notes}</p>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat(payment.freight_id, payment.driver_id);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat com Motorista
                </Button>
                
                {/* ✅ Botão de ação baseado no status normalizado */}
                {(payment.status === 'proposed' || normalizeStatus(payment.status) === 'proposed') && (
                  <Button
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmPayment(payment.id);
                    }}
                    disabled={isLoading}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Pagamento
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
