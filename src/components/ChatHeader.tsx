import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Navigation, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatHeaderProps {
  title: string;
  phoneNumber?: string | null;
  participantName?: string;
  gpsInfo?: {
    isActive: boolean;
    lastUpdate?: string;
    lat?: number;
    lng?: number;
  };
  unreadCount?: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  phoneNumber,
  participantName,
  gpsInfo,
  unreadCount = 0,
}) => {
  const handlePhoneCall = () => {
    if (phoneNumber) {
      // Limpar número de telefone para formato de link tel:
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      window.open(`tel:+55${cleanNumber}`, '_self');
    }
  };

  const getTimeSinceUpdate = () => {
    if (!gpsInfo?.lastUpdate) return null;
    return formatDistanceToNow(new Date(gpsInfo.lastUpdate), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{title}</h3>
        {participantName && (
          <p className="text-xs text-muted-foreground truncate">{participantName}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Indicador GPS Ativo */}
        {gpsInfo?.isActive && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="relative">
              <Navigation className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <span className="text-xs font-medium text-green-700 dark:text-green-300">
              GPS Ativo
            </span>
            {gpsInfo.lastUpdate && (
              <span className="text-xs text-green-600/70 dark:text-green-400/70 flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {getTimeSinceUpdate()}
              </span>
            )}
          </div>
        )}

        {/* Badge de mensagens não lidas */}
        {unreadCount > 0 && (
          <Badge variant="destructive" className="px-1.5 py-0">
            {unreadCount}
          </Badge>
        )}

        {/* Botão de chamada telefônica */}
        {phoneNumber && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePhoneCall}
            className="gap-1.5 bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Ligar</span>
          </Button>
        )}
      </div>
    </div>
  );
};
