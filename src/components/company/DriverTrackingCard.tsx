import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Clock, Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriverTrackingCardProps {
  driver: {
    id: string;
    driver_profile_id: string;
    is_available: boolean;
    tracking_status: 'IDLE' | 'IN_TRANSIT' | 'LOADING' | 'UNLOADING';
    last_gps_update: string | null;
    current_lat: number | null;
    current_lng: number | null;
    driver: {
      full_name: string;
      profile_photo_url: string | null;
    };
    freight: {
      origin_address: string;
      destination_address: string;
    } | null;
  };
  onClick?: () => void;
}

export const DriverTrackingCard = ({ driver, onClick }: DriverTrackingCardProps) => {
  const getStatusColor = () => {
    if (!driver.is_available) {
      switch (driver.tracking_status) {
        case 'IN_TRANSIT':
          return 'bg-blue-500';
        case 'LOADING':
        case 'UNLOADING':
          return 'bg-yellow-500';
        default:
          return 'bg-red-500';
      }
    }
    
    // Verificar se GPS está desatualizado (>5 minutos)
    if (driver.last_gps_update) {
      const minutesSinceUpdate = (Date.now() - new Date(driver.last_gps_update).getTime()) / 60000;
      if (minutesSinceUpdate > 5) {
        return 'bg-gray-500';
      }
    }
    
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!driver.is_available) {
      switch (driver.tracking_status) {
        case 'IN_TRANSIT':
          return 'Em trânsito';
        case 'LOADING':
          return 'Carregando';
        case 'UNLOADING':
          return 'Descarregando';
        default:
          return 'Ocupado';
      }
    }
    
    // Verificar se GPS está desatualizado
    if (driver.last_gps_update) {
      const minutesSinceUpdate = (Date.now() - new Date(driver.last_gps_update).getTime()) / 60000;
      if (minutesSinceUpdate > 5) {
        return 'GPS desatualizado';
      }
    }
    
    return 'Disponível';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar com indicador de status */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <SignedAvatarImage src={driver.driver.profile_photo_url} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(driver.driver.full_name)}
              </AvatarFallback>
            </Avatar>
            <div 
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${getStatusColor()}`}
              title={getStatusText()}
            />
          </div>

          {/* Informações */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">
              {driver.driver.full_name}
            </h4>
            
            <Badge 
              variant="secondary" 
              className="mt-1 text-xs"
            >
              {getStatusText()}
            </Badge>

            {/* Frete ativo */}
            {driver.freight && !driver.is_available && (
              <div className="mt-2 space-y-1">
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Navigation className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{driver.freight.origin_address}</span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{driver.freight.destination_address}</span>
                </div>
              </div>
            )}

            {/* Última atualização GPS */}
            {driver.last_gps_update && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Atualizado {formatDistanceToNow(new Date(driver.last_gps_update), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
