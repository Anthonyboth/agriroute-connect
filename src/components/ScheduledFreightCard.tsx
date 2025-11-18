import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Weight, TrendingUp, MessageSquare, Eye, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatBRL, formatKm, formatTons, formatDate } from '@/lib/formatters';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { ScheduledFreightDetailsModal } from '@/components/ScheduledFreightDetailsModal';
import { ChatModal } from '@/components/ChatModal';
import type { ChatConversation } from '@/hooks/useUnifiedChats';
import { getPickupDateBadge } from '@/utils/freightDateHelpers';

interface ScheduledFreightCardProps {
  freight: any;
  userRole: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO';
  userProfileId: string;
  currentUserProfile: any;
  onWithdraw?: (freightId: string) => void;
}

export const ScheduledFreightCard: React.FC<ScheduledFreightCardProps> = ({
  freight,
  userRole,
  userProfileId,
  currentUserProfile,
  onWithdraw
}) => {
  const [showChatModal, setShowChatModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
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
        ? (freight.profiles?.full_name || 'Motorista')
        : (freight.producer?.full_name || 'Produtor')
    },
    metadata: freight,
    isClosed: false
  };

  const badgeInfo = getPickupDateBadge(freight.pickup_date || freight.scheduled_date);

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

          <div className="pt-2 border-t">
            <div className="text-2xl font-bold text-primary">
              {formatBRL(freight.price)}
            </div>
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
      />
    </>
  );
};
