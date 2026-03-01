import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Weight, TrendingUp, Calendar, User, MessageSquare, XCircle, Star, Truck as TruckIcon } from 'lucide-react';
import { formatBRL, formatKm, formatTons, formatDate, getPricePerTruck } from '@/lib/formatters';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';
import { DriverVehiclePreview } from '@/components/freight/DriverVehiclePreview';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface ScheduledFreightDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  userRole: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO';
  onOpenChat?: () => void;
  onWithdraw?: () => void;
  onOpenProfile?: (userId: string, userType: 'driver' | 'producer', userName: string) => void;
}

export const ScheduledFreightDetailsModal = ({
  isOpen,
  onClose,
  freight,
  userRole,
  onOpenChat,
  onWithdraw,
  onOpenProfile
}: ScheduledFreightDetailsModalProps) => {
  const badgeInfo = getPickupDateBadge(freight.pickup_date || freight.scheduled_date);
  const producer = freight.producer;
  const assignedDrivers: any[] = freight.assigned_drivers || [];
  const requiredTrucks = freight.required_trucks ?? 1;
  const isMultiTruck = requiredTrucks > 1;
  const isDriverView = userRole === 'MOTORISTA' || userRole === 'MOTORISTA_AFILIADO';
  const isProducerView = userRole === 'PRODUTOR';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{getCargoTypeLabel(freight.cargo_type)}</span>
            {badgeInfo && (
              <Badge variant={badgeInfo.variant} className="whitespace-nowrap">
                {badgeInfo.text}
              </Badge>
            )}
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

        {/* SEÇÃO 3: PARTICIPANTES - CLICÁVEIS */}
        <div className="space-y-4 border-b pb-4">
          {/* Motorista vendo Produtor */}
          {isDriverView && (
            <>
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Produtor
              </h3>
              {producer ? (
                <div 
                  className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => onOpenProfile?.(freight.producer_id, 'producer', producer.full_name)}
                >
                  {producer.profile_photo_url ? (
                    <img
                      src={producer.profile_photo_url}
                      alt="Foto do produtor"
                      className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base">{producer.full_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {producer.rating ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          {Number(producer.rating).toFixed(1)} ({producer.total_ratings || 0})
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem avaliações</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Ver perfil →</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Dados do produtor não disponíveis</p>
              )}
            </>
          )}

          {/* Produtor vendo Motorista(s) */}
          {isProducerView && (
            <>
              <h3 className="font-semibold flex items-center gap-2">
                <TruckIcon className="h-5 w-5" />
                {isMultiTruck 
                  ? `Motoristas (${assignedDrivers.length}/${requiredTrucks} carretas)` 
                  : 'Motorista'}
              </h3>
              {assignedDrivers.length > 0 ? (
                <div className="space-y-3">
                  {assignedDrivers.map((assignment: any, idx: number) => {
                    const driver = assignment.driver_profile;
                    if (!driver) return null;
                    return (
                      <div 
                        key={assignment.driver_id || idx} 
                        className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                        onClick={() => onOpenProfile?.(assignment.driver_id, 'driver', driver.full_name)}
                      >
                        {driver.profile_photo_url ? (
                          <img
                            src={driver.profile_photo_url}
                            alt="Foto do motorista"
                            className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base">{driver.full_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {driver.rating ? (
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                {Number(driver.rating).toFixed(1)} ({driver.total_ratings || 0})
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Sem avaliações</span>
                            )}
                          </div>
                        </div>
                        {assignment.agreed_price && (
                          <span className="text-sm text-primary font-bold whitespace-nowrap">
                            {formatBRL(assignment.agreed_price)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">Ver →</span>
                      </div>
                    );
                  })}

                  {/* Preview do veículo do primeiro motorista */}
                  {assignedDrivers[0]?.driver_id && (
                    <DriverVehiclePreview driverId={assignedDrivers[0].driver_id} freightId={freight.id} />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center border border-dashed">
                    <TruckIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground italic">Aguardando motorista</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* SEÇÃO 4: VALOR */}
        <div className="bg-primary/5 p-4 rounded-lg">
          {(() => {
            const pd = precoPreenchidoDoFrete(freight.id, {
              price: freight.price || 0,
              pricing_type: freight.pricing_type,
              price_per_km: freight.price_per_km,
              required_trucks: requiredTrucks,
              distance_km: freight.distance_km,
              weight: freight.weight,
            });
            return (
              <>
                <p className="text-sm text-muted-foreground">Valor do Frete</p>
                <p className="text-3xl font-bold text-primary">
                  {pd.primaryText}
                </p>
                {pd.secondaryText && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {pd.secondaryText}
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