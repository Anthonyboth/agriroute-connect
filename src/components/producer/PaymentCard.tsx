import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PublicProfileModal } from '@/components/profile/PublicProfileModal';
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
import { usePrecoPreenchido } from '@/hooks/usePrecoPreenchido';

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
    pricing_type?: string;
    price_per_km?: number;
    price_per_ton?: number;
    required_trucks?: number;
    weight?: number;
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
  const [showProfile, setShowProfile] = useState(false);
  const statusConfig = getStatusConfig(payment.status);
  const StatusIcon = statusConfig.icon;

  // ✅ Preço canônico via pipeline — NUNCA usar freight.price ou payment.amount direto
  const preco = usePrecoPreenchido(payment.freight ? {
    id: payment.freight.id,
    price: payment.freight.price,
    pricing_type: payment.freight.pricing_type,
    price_per_km: payment.freight.price_per_km,
    price_per_ton: payment.freight.price_per_ton,
    required_trucks: payment.freight.required_trucks,
    weight: payment.freight.weight,
    distance_km: payment.freight.distance_km,
  } : null);

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
      <Card className={`transition-all duration-200 border ${isExpanded ? 'shadow-md ring-1 ring-border' : 'hover:shadow-sm'} bg-card`}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer">
            <CardContent className="p-5 sm:p-6">
              {/* Top row: cargo badge + status */}
              <div className="flex items-center justify-between mb-4">
                {payment.freight?.cargo_type && (
                  <Badge variant="outline" className="text-xs font-medium bg-orange-500/[0.06] border-orange-200 text-orange-700">
                    <Package className="h-3 w-3 mr-1.5" />
                    {payment.freight.cargo_type}
                  </Badge>
                )}
                <Badge 
                  variant={statusConfig.variant}
                  className={`text-xs font-medium ${
                    normalizeStatus(payment.status) === 'completed' 
                      ? 'bg-emerald-500/[0.08] text-emerald-700 border-emerald-200' 
                      : normalizeStatus(payment.status) === 'paid_by_producer' 
                        ? 'bg-orange-500/[0.08] text-orange-700 border-orange-200' 
                        : 'bg-blue-500/[0.08] text-blue-700 border-blue-200'
                  }`}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>

              {/* Main content: avatar + info + price */}
              <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    className="shrink-0 mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProfile(true);
                    }}
                    title="Ver perfil do motorista"
                  >
                    <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm cursor-pointer">
                      <SignedAvatarImage src={payment.driver?.profile_photo_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <button
                      type="button"
                      className="font-semibold text-sm text-foreground truncate block hover:text-primary hover:underline transition-colors focus:outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfile(true);
                      }}
                      title="Ver perfil do motorista"
                    >
                      {payment.driver?.full_name || 'Motorista'}
                    </button>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      {formatRoute()}
                    </p>
                  </div>
                </div>

                {/* Price + chevron */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <p className="font-bold text-base text-foreground">
                    {preco && !preco.invalid ? preco.primaryText : 'Preço indisponível'}
                  </p>
                  {isExpanded ? (
                    <ChevronUp className="h-4.5 w-4.5 text-muted-foreground/60" />
                  ) : (
                    <ChevronDown className="h-4.5 w-4.5 text-muted-foreground/60" />
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-5 px-5 sm:px-6">
            <div className="border-t border-border/40 pt-5 space-y-5">
              {/* Detalhes do Frete — stacked layout for clarity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {payment.freight?.pickup_date && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Calendar className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Coleta</span>
                      <span className="text-sm font-medium text-foreground">{formatDate(payment.freight.pickup_date)}</span>
                    </div>
                  </div>
                )}
                
                {payment.freight?.distance_km && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Truck className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Distância</span>
                      <span className="text-sm font-medium text-foreground">{payment.freight.distance_km.toLocaleString('pt-BR')} km</span>
                    </div>
                  </div>
                )}
                
                {preco && !preco.invalid && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <DollarSign className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Preço do Frete</span>
                      <span className="text-sm font-medium text-foreground">{preco.primaryText}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Solicitado em</span>
                    <span className="text-sm font-medium text-foreground">{formatDate(payment.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {payment.notes && (
                <div className="p-4 bg-muted/20 rounded-lg border border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Observações</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{payment.notes}</p>
                </div>
              )}

              {/* Ações — proper spacing */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfile(true);
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  Ver Perfil
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat(payment.freight_id, payment.driver_id);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat com Motorista
                </Button>
                
                {(payment.status === 'proposed' || normalizeStatus(payment.status) === 'proposed') && (
                  <Button
                    className="flex-1 h-10"
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

      {/* Modal de perfil público do motorista */}
      <PublicProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userId={payment.driver_id}
        userType="driver"
        userName={payment.driver?.full_name}
      />
    </Collapsible>
  );
};
