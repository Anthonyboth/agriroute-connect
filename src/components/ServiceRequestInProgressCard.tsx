import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, Phone, MessageSquare, Navigation, CheckCircle, Truck, Clock, Wrench,
  Car, AlertTriangle, Calendar, FileText, Mail, User, Map
} from 'lucide-react';
import { formatBRL } from '@/lib/formatters';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface ServiceRequestInProgressCardProps {
  request: {
    id: string;
    service_type: string;
    status: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    location_address?: string;
    location_lat?: number;
    location_lng?: number;
    problem_description?: string;
    estimated_price?: number;
    is_emergency?: boolean;
    client_id?: string;
    prospect_user_id?: string;
    city_name?: string;
    state?: string;
    created_at: string;
    accepted_at?: string;
    vehicle_info?: string;
    urgency?: string;
    preferred_datetime?: string;
    additional_info?: string;
  };
  onMarkOnTheWay: (id: string) => void;
  onFinishService: (id: string) => void;
}

// Mini-mapa embutido no card
const InlineTrackingMap = React.memo(({ lat, lng, label }: { lat: number; lng: number; label?: string }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [lng, lat],
        zoom: 14,
        interactive: false,
        attributionControl: false,
      });

      map.on('load', () => {
        // Marker via elemento HTML
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:28px;height:28px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ef4444"/></svg>
        </div>`;
        new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      });

      map.on('error', () => setMapError(true));
      mapRef.current = map;
    } catch {
      setMapError(true);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  if (mapError) {
    return (
      <div className="h-32 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
        <Map className="h-4 w-4 mr-1" /> Mapa indisponível
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height: '140px' }}>
      <div ref={mapContainer} className="w-full h-full" />
      {label && (
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
          📍 {label}
        </div>
      )}
    </div>
  );
});
InlineTrackingMap.displayName = 'InlineTrackingMap';

const ServiceRequestInProgressCardComponent = ({ 
  request, 
  onMarkOnTheWay, 
  onFinishService 
}: ServiceRequestInProgressCardProps) => {
  
  const openInMaps = () => {
    if (request.location_lat && request.location_lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${request.location_lat},${request.location_lng}`, '_blank');
    } else if (request.location_address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.location_address)}`, '_blank');
    }
  };

  const openWhatsApp = () => {
    if (request.contact_phone) {
      const cleaned = request.contact_phone.replace(/\D/g, '');
      const num = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
      window.open(`https://wa.me/${num}`, '_blank');
    }
  };

  const openEmail = () => {
    if (request.contact_email) {
      window.open(`mailto:${request.contact_email}`, '_blank');
    }
  };

  const getServiceLabel = () => {
    const labels: Record<string, string> = {
      GUINCHO: 'Guincho', MUDANCA: 'Mudança', FRETE_URBANO: 'Frete Urbano',
      TRANSPORTE_PET: 'Transporte PET', ENTREGA_PACOTES: 'Entrega Pacotes',
      FRETE_MOTO: 'Frete Moto', MECANICO: 'Mecânico', BORRACHEIRO: 'Borracheiro',
      ELETRICISTA: 'Eletricista', SOCORRO_MECANICO: 'Socorro Mecânico',
    };
    return labels[request.service_type] || request.service_type;
  };

  const getStatusBadge = () => {
    const styles: Record<string, string> = {
      ACCEPTED: 'bg-blue-500', ON_THE_WAY: 'bg-orange-500', IN_PROGRESS: 'bg-green-500',
    };
    const labels: Record<string, string> = {
      ACCEPTED: 'Aceito', ON_THE_WAY: 'A Caminho', IN_PROGRESS: 'Em Andamento',
    };
    return (
      <Badge className={`${styles[request.status] || 'bg-muted'} text-xs px-2 py-0.5`}>
        {labels[request.status] || request.status}
      </Badge>
    );
  };

  const formatAcceptedAt = () => {
    const dateStr = request.accepted_at || request.created_at;
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return new Date(dateStr).toLocaleString('pt-BR');
    }
  };

  const formatPreferredDateTime = () => {
    if (!request.preferred_datetime) return null;
    try {
      const date = parseISO(request.preferred_datetime);
      const time = format(date, 'HH:mm', { locale: ptBR });
      if (isToday(date)) return `Hoje às ${time}`;
      if (isTomorrow(date)) return `Amanhã às ${time}`;
      return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
    } catch {
      return request.preferred_datetime;
    }
  };

  // Parse additional_info
  let parsedInfo: any = null;
  try {
    parsedInfo = typeof request.additional_info === 'string'
      ? JSON.parse(request.additional_info)
      : request.additional_info;
    if (typeof parsedInfo !== 'object') parsedInfo = null;
  } catch { parsedInfo = null; }

  // Extrair endereços de coleta e entrega do additional_info
  // Estrutura real: { origin: { full_address, city, ... }, destination: { full_address, city, ... } }
  const originAddress = parsedInfo?.origin?.full_address || parsedInfo?.origin_address || null;
  const destAddress = parsedInfo?.destination?.full_address || parsedInfo?.destination_address || null;
  const destCity = parsedInfo?.destination?.city || null;
  const destState = parsedInfo?.destination?.state || null;

  const isGuestUser = !!request.prospect_user_id && !request.client_id;
  const hasCoords = !!(request.location_lat && request.location_lng);
  const isUrgent = request.urgency && ['ALTA', 'URGENTE'].includes(request.urgency.toUpperCase());

  return (
    <Card className={`border-l-4 ${isUrgent ? 'border-l-red-500' : 'border-l-orange-500'} hover:shadow-lg transition-shadow`}>
      <CardContent className="p-3 space-y-2">
        {/* Header compacto */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wrench className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-bold text-sm truncate">{getServiceLabel()}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {request.is_emergency && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">🚨</Badge>
            )}
            {isUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-3 w-3 mr-0.5" />URGENTE
              </Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>

        {/* Cliente - compacto */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 space-y-1 text-sm">
          {request.contact_name && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-semibold truncate">{request.contact_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {request.contact_phone && (
              <Button variant="default" size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-2" onClick={openWhatsApp}>
                <MessageSquare className="h-3 w-3 mr-1" />
                {request.contact_phone}
              </Button>
            )}
            {request.contact_email && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={openEmail}>
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Button>
            )}
          </div>
        </div>

        {/* Veículo - se existir */}
        {request.vehicle_info && (
          <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1">
            <Car className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{request.vehicle_info}</span>
          </div>
        )}

        {/* Coleta e Entrega */}
        <div className={`grid ${hasCoords ? 'grid-cols-[1fr,160px]' : 'grid-cols-1'} gap-2`}>
          <div className="space-y-1.5">
            {/* COLETA */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded px-2 py-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <span className="text-[11px] font-bold text-green-700 dark:text-green-400">COLETA</span>
                {request.city_name && (
                  <span className="text-xs font-semibold text-primary ml-auto">
                    {request.city_name}{request.state ? ` - ${request.state}` : ''}
                  </span>
                )}
              </div>
              {(originAddress || request.location_address) && (
                <p className="text-xs text-muted-foreground pl-5 line-clamp-2">
                  {originAddress || request.location_address}
                </p>
              )}
            </div>

            {/* ENTREGA */}
            {(destAddress || destCity) && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-red-700 dark:text-red-400">ENTREGA</span>
                  {destCity && (
                    <span className="text-xs font-semibold text-primary ml-auto">
                      {destCity}{destState ? ` - ${destState}` : ''}
                    </span>
                  )}
                </div>
                {destAddress && (
                  <p className="text-xs text-muted-foreground pl-5 line-clamp-2">{destAddress}</p>
                )}
              </div>
            )}

            {(request.location_lat || request.location_address) && (
              <Button variant="outline" size="sm" className="h-7 text-xs w-full mt-1" onClick={openInMaps}>
                <Navigation className="h-3 w-3 mr-1" />
                Abrir no Google Maps
              </Button>
            )}
          </div>

          {/* Mini-mapa de rastreio */}
          {hasCoords && (
            <InlineTrackingMap 
              lat={request.location_lat!} 
              lng={request.location_lng!} 
              label={request.city_name || 'Local'}
            />
          )}
        </div>

        {/* Data preferida */}
        {request.preferred_datetime && (
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-medium">{formatPreferredDateTime()}</span>
          </div>
        )}

        {/* Descrição do problema - compacta */}
        {request.problem_description && request.problem_description !== 'Solicitação de serviço' && (
          <div className="text-xs bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1.5">
            <span className="text-muted-foreground">Descrição: </span>
            <span>{request.problem_description}</span>
          </div>
        )}

        {/* Observações extras de additional_info (texto simples) */}
        {parsedInfo?.notes && (
          <p className="text-xs text-muted-foreground px-2">{parsedInfo.notes}</p>
        )}
        {request.additional_info && !parsedInfo && (
          <div className="text-xs bg-muted/30 rounded px-2 py-1">
            <span className="text-muted-foreground">Obs: </span>
            <span>{request.additional_info}</span>
          </div>
        )}

        {/* Valor do serviço */}
        {request.estimated_price && (
          <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
            <span className="text-sm font-bold text-green-700 dark:text-green-300">💰 Valor:</span>
            <span className="text-lg font-black text-green-600">{formatBRL(request.estimated_price)}</span>
          </div>
        )}

        {/* Aceito em */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Aceito em: {formatAcceptedAt()}</span>
        </div>
      </CardContent>

      <CardFooter className="px-3 pb-3 pt-0 flex gap-2">
        {request.status === 'ACCEPTED' && request.client_id && (
          <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 h-9" onClick={() => onMarkOnTheWay(request.id)}>
            <Navigation className="h-4 w-4 mr-1" />
            A Caminho
          </Button>
        )}
        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-9" onClick={() => onFinishService(request.id)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          {isGuestUser ? 'Encerrar' : 'Concluir'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export const ServiceRequestInProgressCard = React.memo(ServiceRequestInProgressCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.request.id === nextProps.request.id &&
    prevProps.request.status === nextProps.request.status &&
    prevProps.request.estimated_price === nextProps.request.estimated_price &&
    prevProps.onMarkOnTheWay === nextProps.onMarkOnTheWay &&
    prevProps.onFinishService === nextProps.onFinishService
  );
});
