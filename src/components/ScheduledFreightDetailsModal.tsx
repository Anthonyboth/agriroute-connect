import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Weight, TrendingUp, Calendar, User, Phone, MessageSquare, XCircle } from 'lucide-react';
import { formatBRL, formatKm, formatTons, formatDate, getPricePerTruck } from '@/lib/formatters';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';

interface ScheduledFreightDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  userRole: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO';
  onOpenChat?: () => void;
  onWithdraw?: () => void;
}

export const ScheduledFreightDetailsModal = ({
  isOpen,
  onClose,
  freight,
  userRole,
  onOpenChat,
  onWithdraw
}: ScheduledFreightDetailsModalProps) => {
  const badgeInfo = getPickupDateBadge(freight.pickup_date || freight.scheduled_date);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{getCargoTypeLabel(freight.cargo_type)}</span>
            {badgeInfo && (() => {
              const iconMap = { AlertTriangle: null, Clock: null, Calendar: null };
              return (
                <Badge variant={badgeInfo.variant} className="whitespace-nowrap">
                  {badgeInfo.text}
                </Badge>
              );
            })()}
          </DialogTitle>
        </DialogHeader>

        {/* SEÇÃO 1: INFORMAÇÕES DA ROTA */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Rota
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Origem</p>
              <p className="font-medium">{freight.origin_city}, {freight.origin_state}</p>
              {freight.origin_address && (
                <p className="text-sm text-muted-foreground mt-1">{freight.origin_address}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destino</p>
              <p className="font-medium">{freight.destination_city}, {freight.destination_state}</p>
              {freight.destination_address && (
                <p className="text-sm text-muted-foreground mt-1">{freight.destination_address}</p>
              )}
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DETALHES DO FRETE */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold">Detalhes do Frete</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Peso</p>
                <p className="font-medium">{formatTons(freight.weight)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Distância</p>
                <p className="font-medium">{formatKm(freight.distance_km)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Data de Coleta</p>
                <p className="font-medium">{formatDate(freight.pickup_date || freight.scheduled_date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: INFORMAÇÕES DO PRODUTOR/MOTORISTA */}
        <div className="space-y-4 border-b pb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            {userRole === 'PRODUTOR' ? 'Motorista' : 'Produtor'}
          </h3>
          <div className="space-y-2">
            <p className="font-medium">
              {userRole === 'PRODUTOR' 
                ? (freight.profiles?.full_name || 'Motorista')
                : (freight.producer?.full_name || 'Produtor')}
            </p>
            {(freight.profiles?.phone || freight.producer?.phone) && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <a 
                  href={`tel:${userRole === 'PRODUTOR' ? freight.profiles?.phone : freight.producer?.phone}`} 
                  className="text-primary hover:underline"
                >
                  {userRole === 'PRODUTOR' ? freight.profiles?.phone : freight.producer?.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 4: VALOR */}
        <div className="bg-primary/5 p-4 rounded-lg">
          {(() => {
            const requiredTrucks = freight.required_trucks || 1;
            const pricePerTruck = getPricePerTruck(freight.price, requiredTrucks);
            const hasMultipleTrucks = requiredTrucks > 1;
            const isProducer = userRole === 'PRODUTOR';
            return (
              <>
                <p className="text-sm text-muted-foreground">Valor do Frete{hasMultipleTrucks && !isProducer ? ' (por carreta)' : ''}</p>
                <p className="text-3xl font-bold text-primary">
                  {formatBRL(isProducer ? freight.price : pricePerTruck)}
                </p>
                {hasMultipleTrucks && isProducer && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {requiredTrucks} carretas × {formatBRL(pricePerTruck)} por carreta
                  </p>
                )}
              </>
            );
          })()}
        </div>

        {/* DESCRIÇÃO (se houver) */}
        {freight.description && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Observações</h3>
            <p className="text-sm text-muted-foreground">{freight.description}</p>
          </div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-3 pt-4 border-t">
          {onOpenChat && (
            <Button onClick={onOpenChat} className="flex-1">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Button>
          )}
          {onWithdraw && userRole !== 'PRODUTOR' && (
            <Button onClick={onWithdraw} variant="destructive" className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Desistir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
