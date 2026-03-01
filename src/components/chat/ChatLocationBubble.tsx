/**
 * ChatLocationBubble.tsx
 * 
 * Bolha de localização compartilhada no chat, estilo WhatsApp.
 * Exibe mini-mapa estático com pin e botão para abrir modal de rota.
 */
import React from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatLocationBubbleProps {
  lat: number;
  lng: number;
  address?: string;
  timestamp: string;
  isCurrentUser: boolean;
  onOpenRouteModal: (lat: number, lng: number, address?: string) => void;
}

export const ChatLocationBubble: React.FC<ChatLocationBubbleProps> = ({
  lat,
  lng,
  address,
  timestamp,
  isCurrentUser,
  onOpenRouteModal,
}) => {
  const isRecent = () => {
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);
    return new Date(timestamp) > hourAgo;
  };

  // OpenStreetMap static tile preview
  const zoom = 15;
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${Math.floor((lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`;

  return (
    <div className="space-y-2 min-w-[220px]">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4" />
        <span className="text-sm font-medium">Localização compartilhada</span>
        {isRecent() && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Recente
          </Badge>
        )}
      </div>

      {/* Mini mapa preview - clicável */}
      <button
        onClick={() => onOpenRouteModal(lat, lng, address)}
        className="relative w-full h-[120px] rounded-lg overflow-hidden border border-border/50 cursor-pointer group"
      >
        <div className="w-full h-full bg-muted flex items-center justify-center relative">
          <img
            src={tileUrl}
            alt="Localização no mapa"
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Pin central */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          {/* Overlay de ação */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-2">
            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded">
              Abrir rota no mapa
            </span>
          </div>
        </div>
      </button>

      {address && (
        <p className="text-xs opacity-90 leading-tight">{address}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={isCurrentUser ? 'secondary' : 'outline'}
          className="flex-1 text-xs h-7"
          onClick={() => onOpenRouteModal(lat, lng, address)}
        >
          <Navigation className="h-3 w-3 mr-1" />
          Ver Rota
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 px-2"
          asChild
        >
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
};
