import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Weight, TrendingUp, MessageSquare, Eye, XCircle, Clock, AlertTriangle, User, Truck as TruckIcon } from 'lucide-react';
import { SignedStorageImage } from '@/components/ui/signed-storage-image';
import { formatBRL, formatKm, formatTons, formatDate, getPricePerTruck } from '@/lib/formatters';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { ScheduledFreightDetailsModal } from '@/components/ScheduledFreightDetailsModal';
import { ChatModal } from '@/components/ChatModal';
import { ParticipantProfileModal } from '@/components/freight/ParticipantProfileModal';
import type { ChatConversation } from '@/hooks/useUnifiedChats';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';
import { DriverVehiclePreview } from '@/components/freight/DriverVehiclePreview';

interface ScheduledFreightCardProps {
  freight: any;
  userRole: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO';
  userProfileId: string;
  currentUserProfile: any;
  onWithdraw?: (freightId: string) => void;
}

const ScheduledFreightCardComponent: React.FC<ScheduledFreightCardProps> = ({
  freight,
  userRole,
  userProfileId,
  currentUserProfile,
  onWithdraw
}) => {
  const [showChatModal, setShowChatModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [profileModal, setProfileModal] = useState<{ userId: string; userType: 'driver' | 'producer'; userName: string } | null>(null);
  
  // Construir conversação para o ChatModal
  const conversation: ChatConversation = {
    id: freight.id,
    type: freight.is_service_request ? 'SERVICE' : 'FREIGHT',
    title: `Frete: ${getCargoTypeLabel(freight.cargo_type)}`,
    lastMessage: '',
    lastMessageTime: freight.updated_at || freight.created_at,
    unreadCount: 0,
    otherParticipant: {
      name: userRole === 'PRODUTOR' 
        ? (freight.assigned_drivers?.[0]?.driver_profile?.full_name || 'Motorista')
        : (freight.producer?.full_name || 'Produtor')
    },
    participants: [],
    metadata: freight,
    isClosed: false
  };

  const badgeInfo = getPickupDateBadge(freight.pickup_date || freight.scheduled_date);

  // Determinar participantes a exibir
  const producer = freight.producer;
  const assignedDrivers: any[] = freight.assigned_drivers || [];
  const primaryDriverId = assignedDrivers[0]?.driver_id || freight.driver_id || null;
  const requiredTrucks = freight.required_trucks ?? 1;
  const isMultiTruck = requiredTrucks > 1;

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-semibold truncate flex-1">
              {getCargoTypeLabel(freight.cargo_type)}
            </CardTitle>
            {badgeInfo && (() => {
              const iconMap = { AlertTriangle, Clock, Calendar };
              const IconComponent = iconMap[badgeInfo.icon];
              return (
                <Badge variant={badgeInfo.variant} className="whitespace-nowrap flex items-center gap-1">
                  <IconComponent className="h-3 w-3" />
                  {badgeInfo.text}
                </Badge>
              );
            })()}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {freight.origin_city} → {freight.destination_city}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1 overflow-hidden">
          {/* Detalhes do Frete */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{formatTons(freight.weight)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{formatKm(freight.distance_km)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">
              {formatDate(freight.pickup_date || freight.scheduled_date)}
            </span>
          </div>

          {/* ✅ Informações dos Participantes - CLICÁVEIS */}
          <div className="border-t pt-3 space-y-3">
            {/* Motorista vendo Produtor */}
            {(userRole === 'MOTORISTA' || userRole === 'MOTORISTA_AFILIADO') && producer && (
              <div 
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors"
                onClick={() => setProfileModal({ userId: freight.producer_id, userType: 'producer', userName: producer.full_name })}
              >
                {producer.profile_photo_url ? (
                  <SignedStorageImage 
                    src={producer.profile_photo_url} 
                    alt="Foto do produtor"
                    className="h-8 w-8 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Produtor</p>
                  <p className="text-sm font-medium truncate">{producer.full_name}</p>
                  {producer.rating && (
                    <p className="text-xs text-muted-foreground">
                      ⭐ {Number(producer.rating).toFixed(1)} ({producer.total_ratings || 0})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Produtor vendo Motorista(s) */}
            {userRole === 'PRODUTOR' && assignedDrivers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {isMultiTruck 
                    ? `Motoristas (${assignedDrivers.length}/${requiredTrucks} carretas)` 
                    : 'Motorista'}
                </p>
                {assignedDrivers.map((assignment: any, idx: number) => {
                  const driver = assignment.driver_profile;
                  if (!driver) return null;
                  return (
                    <div 
                      key={assignment.driver_id || idx} 
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors"
                      onClick={() => setProfileModal({ userId: assignment.driver_id, userType: 'driver', userName: driver.full_name })}
                    >
                      {driver.profile_photo_url ? (
                        <SignedStorageImage 
                          src={driver.profile_photo_url} 
                          alt="Foto do motorista"
                          className="h-8 w-8 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{driver.full_name}</p>
                        {driver.rating && (
                          <p className="text-xs text-muted-foreground">
                            ⭐ {Number(driver.rating).toFixed(1)} ({driver.total_ratings || 0})
                          </p>
                        )}
                      </div>
                      {assignment.agreed_price && (
                        <span className="text-xs text-primary font-medium whitespace-nowrap">
                          {formatBRL(assignment.agreed_price)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Produtor sem motorista atribuído */}
            {userRole === 'PRODUTOR' && assignedDrivers.length === 0 && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center border border-dashed">
                  <TruckIcon className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Motorista</p>
                  <p className="text-sm text-muted-foreground italic">Aguardando motorista</p>
                </div>
              </div>
            )}
          </div>

          {/* ✅ Preview do veículo do motorista (para produtor) */}
          {userRole === 'PRODUTOR' && primaryDriverId && (
            <DriverVehiclePreview driverId={primaryDriverId} freightId={freight.id} />
          )}

          {/* ✅ Valor do Frete - SEMPRE usa pipeline centralizado de preço */}
          <div className="pt-2 border-t">
            {(() => {
              // ✅ PREÇO PREENCHIDO — fonte única de verdade
              const pd = precoPreenchidoDoFrete(freight.id, freight);

              return (
                <>
                  <div className="text-2xl font-bold text-primary">
                    {pd.primaryText}
                  </div>
                  {pd.secondaryText && (
                    <p className="text-xs text-muted-foreground">{pd.secondaryText}</p>
                  )}
                </>
              );
            })()}
          </div>
        </CardContent>

        <CardFooter className="grid grid-cols-3 gap-2 pt-3 mt-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChatModal(true)}
            className="w-full"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Chat
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetailsModal(true)}
            className="w-full"
          >
            <Eye className="h-4 w-4 mr-1" />
            Detalhes
          </Button>

          {onWithdraw && userRole !== 'PRODUTOR' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onWithdraw(freight.id)}
              className="w-full text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Desistir
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Modal de Chat */}
      <ChatModal
        conversation={showChatModal ? conversation : null}
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        userProfileId={userProfileId}
        userRole={userRole}
      />

      {/* Modal de Detalhes */}
      <ScheduledFreightDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        freight={freight}
        userRole={userRole}
        onOpenChat={() => {
          setShowDetailsModal(false);
          setShowChatModal(true);
        }}
        onWithdraw={onWithdraw ? () => {
          setShowDetailsModal(false);
          onWithdraw(freight.id);
        } : undefined}
        onOpenProfile={(userId, userType, userName) => {
          setShowDetailsModal(false);
          setProfileModal({ userId, userType, userName });
        }}
      />

      {/* ✅ Modal de Perfil do Participante */}
      {profileModal && (
        <ParticipantProfileModal
          isOpen={true}
          onClose={() => setProfileModal(null)}
          userId={profileModal.userId}
          userType={profileModal.userType}
          userName={profileModal.userName}
          freightId={freight.id}
        />
      )}
    </>
  );
};

// ✅ Memoização para evitar re-renders desnecessários em listas
export const ScheduledFreightCard = React.memo(ScheduledFreightCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.freight.id === nextProps.freight.id &&
    prevProps.freight.status === nextProps.freight.status &&
    prevProps.freight.price === nextProps.freight.price &&
    prevProps.freight.pickup_date === nextProps.freight.pickup_date &&
    prevProps.userRole === nextProps.userRole &&
    prevProps.userProfileId === nextProps.userProfileId &&
    prevProps.onWithdraw === nextProps.onWithdraw &&
    prevProps.freight.assigned_drivers?.length === nextProps.freight.assigned_drivers?.length &&
    prevProps.freight.producer?.full_name === nextProps.freight.producer?.full_name
  );
});