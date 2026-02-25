import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, MessageSquare, Navigation, CheckCircle, Truck, Clock,
  Car, AlertTriangle, Calendar, User, Map, Eye, Route, Wrench
} from 'lucide-react';
import { isFreightType } from '@/lib/item-classification';
import { formatBRL } from '@/lib/formatters';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { RURAL_STYLE_INLINE } from '@/config/maplibre';
import { ptBR } from 'date-fns/locale';
import { generateMarkerIcons, buildMarkersFeatureCollection } from '@/lib/maplibre-canvas-icons';
import { fetchOSRMRoute } from '@/hooks/maplibre/useOSRMRoute';
import { normalizeServiceType } from '@/lib/pt-br-validator';
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
    destination_lat?: number;
    destination_lng?: number;
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
    driver_lat?: number;
    driver_lng?: number;
  };
  onMarkOnTheWay: (id: string) => void;
  onStartTransit: (id: string) => void;
  onFinishService: (id: string) => void;
  onCancel?: (id: string) => void;
  onOpenChat?: (request: any) => void;
  /** Optional proposals section to render */
  proposalsSection?: React.ReactNode;
  /** Força nomenclatura visual do card */
  uiNomenclature?: 'SERVICE' | 'FREIGHT';
}

// ✅ Source/Layer IDs para markers no canvas
const MARKERS_SOURCE_ID = 'service-markers-source';
const MARKERS_LAYER_ID = 'service-markers-layer';
const ROUTE_SOURCE_ID = 'service-route-source';
const ROUTE_LAYER_ID = 'service-route-layer';

// Geocodifica endereço via Nominatim (OSM) com fallback progressivo
async function geocodeAddressNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  // Estratégia: tenta com endereço completo, depois versões simplificadas
  const buildUrl = (q: string) =>
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br&addressdetails=1`;

  const tryFetch = async (q: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(buildUrl(q), {
        headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'AgriRoute/1.0' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  // 1. Tenta endereço completo
  let result = await tryFetch(address);
  if (result) return result;

  // 2. Remove número se houver e tenta só a rua + cidade
  // Ex: "Ari Kriff , 500, Setor, Primavera do Leste - MT" → "Ari Kriff, Primavera do Leste, MT"
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Última parte tem formato "Cidade - UF" ou "Cidade"
    const lastPart = parts[parts.length - 1];
    const streetPart = parts[0].replace(/\s*\d+\s*/g, ' ').trim(); // remove números da rua
    const simplified = `${streetPart}, ${lastPart}`;
    result = await tryFetch(simplified);
    if (result) return result;
  }

  // 3. Tenta só cidade/estado (parte após o último hífen ou última parte)
  if (parts.length >= 1) {
    const lastPart = parts[parts.length - 1];
    result = await tryFetch(lastPart);
    if (result) return result;
  }

  return null;
}

// Mini-mapa interativo com marcadores A/B + veículo via canvas WebGL + controles
const InlineTrackingMap = React.memo(({ 
  originLat, originLng, 
  destLat, destLng,
  driverLat, driverLng,
  isDriverOnline,
  label,
  locationAddress,
  destAddress,
}: { 
  originLat: number; originLng: number; 
  destLat?: number; destLng?: number;
  driverLat?: number; driverLng?: number;
  isDriverOnline?: boolean;
  label?: string;
  locationAddress?: string;
  /** Endereço textual do destino, para geocodificar quando não há coords */
  destAddress?: string;
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const iconsRegisteredRef = useRef(false);
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  // ✅ Se originLat/Lng são coordenadas de fallback (centro do Brasil), precisamos geocodificar ANTES de montar o mapa
  // Se já são coords GPS reais, NÃO geocodificamos (coords GPS têm prioridade absoluta)
  const isFallbackCenter = originLat === -15.7801 && originLng === -47.9292;

  // Coordenadas resolvidas: inicia como null se for fallback (aguarda geocodificação), ou com GPS real imediatamente
  const [resolvedOrigin, setResolvedOrigin] = useState<{ lat: number; lng: number } | null>(
    isFallbackCenter ? null : { lat: originLat, lng: originLng }
  );
  const [geocodingDone, setGeocodingDone] = useState(!isFallbackCenter);

  // ✅ Coordenadas resolvidas do destino (via geocodificação quando não há lat/lng)
  const hasDestCoords = !!(destLat && destLng && destLat !== 0 && destLng !== 0);
  const [resolvedDest, setResolvedDest] = useState<{ lat: number; lng: number } | null>(
    hasDestCoords ? { lat: destLat!, lng: destLng! } : null
  );

  // Geocodifica o destino via Nominatim quando não há coordenadas GPS
  useEffect(() => {
    if (hasDestCoords) {
      setResolvedDest({ lat: destLat!, lng: destLng! });
      return;
    }
    if (!destAddress) {
      setResolvedDest(null);
      return;
    }
    geocodeAddressNominatim(destAddress).then(coords => {
      setResolvedDest(coords);
    });
  }, [destAddress, hasDestCoords, destLat, destLng]);

  // Geocodifica o endereço via Nominatim ANTES de renderizar o mapa
  useEffect(() => {
    if (!isFallbackCenter) {
      // Coords GPS reais — usar diretamente
      setResolvedOrigin({ lat: originLat, lng: originLng });
      setGeocodingDone(true);
      return;
    }
    // Precisa geocodificar pelo endereço
    if (!locationAddress) {
      // Sem endereço disponível, usa fallback
      setResolvedOrigin({ lat: originLat, lng: originLng });
      setGeocodingDone(true);
      return;
    }
    setGeocodingDone(false);
    setResolvedOrigin(null);
    geocodeAddressNominatim(locationAddress).then(coords => {
      if (coords) {
        setResolvedOrigin(coords);
      } else {
        // Nominatim não encontrou — fallback para coords originais
        setResolvedOrigin({ lat: originLat, lng: originLng });
      }
      setGeocodingDone(true);
    });
  }, [locationAddress, isFallbackCenter, originLat, originLng]);

  // Usa as coordenadas resolvidas (geocodificadas ou GPS)
  const origin = useMemo(() => 
    resolvedOrigin ?? { lat: originLat, lng: originLng },
    [resolvedOrigin, originLat, originLng]
  );

  // ✅ Usa resolvedDest (pode ter vindo de geocodificação por endereço)
  const destination = useMemo(() => {
    if (resolvedDest) return resolvedDest;
    if (destLat && destLng && destLat !== 0 && destLng !== 0) {
      return { lat: destLat, lng: destLng };
    }
    return null;
  }, [resolvedDest, destLat, destLng]);

  const driverPos = useMemo(() => {
    if (driverLat && driverLng && driverLat !== 0 && driverLng !== 0) {
      return { lat: driverLat, lng: driverLng };
    }
    return null;
  }, [driverLat, driverLng]);

  // Calculate center and zoom
  const { center, zoom } = useMemo(() => {
    const points: { lat: number; lng: number }[] = [origin];
    if (destination) points.push(destination);
    if (driverPos) points.push(driverPos);

    if (points.length > 1) {
      const cLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const cLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
      const latDiff = Math.max(...points.map(p => p.lat)) - Math.min(...points.map(p => p.lat));
      const lngDiff = Math.max(...points.map(p => p.lng)) - Math.min(...points.map(p => p.lng));
      const maxDiff = Math.max(latDiff, lngDiff);
      let z = 12;
      if (maxDiff > 5) z = 5;
      else if (maxDiff > 3) z = 6;
      else if (maxDiff > 1.5) z = 7;
      else if (maxDiff > 0.8) z = 8;
      else if (maxDiff > 0.4) z = 9;
      else if (maxDiff > 0.15) z = 10;
      else if (maxDiff > 0.05) z = 11;
      return { center: [cLng, cLat] as [number, number], zoom: z };
    }
    return { center: [origin.lng, origin.lat] as [number, number], zoom: 13 };
  }, [origin, destination, driverPos]);

  // ✅ Centralizar no motorista
  const handleCenterOnDriver = useCallback(() => {
    if (mapRef.current && driverPos) {
      mapRef.current.flyTo({
        center: [driverPos.lng, driverPos.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [driverPos]);

  // ✅ Ver tudo (fit bounds)
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;
    const validPoints = [origin, destination, driverPos].filter(Boolean) as Array<{ lat: number; lng: number }>;
    if (validPoints.length === 0) return;
    if (validPoints.length === 1) {
      mapRef.current.flyTo({ center: [validPoints[0].lng, validPoints[0].lat], zoom: 12, duration: 1000 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    validPoints.forEach(p => bounds.extend([p.lng, p.lat]));
    mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });
  }, [origin, destination, driverPos]);

  // ✅ Inicializar o mapa uma única vez (quando origem estiver geocodificada)
  useEffect(() => {
    if (!geocodingDone || !resolvedOrigin) return;
    if (!mapContainer.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: RURAL_STYLE_INLINE,
        center,
        zoom,
        interactive: true,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', async () => {
        setMapLoaded(true);

        // Register canvas icons (A, B, truck)
        if (!iconsRegisteredRef.current) {
          try {
            const icons = await generateMarkerIcons();
            for (const icon of icons) {
              if (!map.hasImage(icon.id)) {
                map.addImage(icon.id, icon.imageData, {
                  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                });
              }
            }
            iconsRegisteredRef.current = true;
          } catch (e) {
            console.warn('[InlineTrackingMap] Failed to register icons:', e);
          }
        }

        // Add route source (empty — será preenchido reativamente)
        map.addSource(ROUTE_SOURCE_ID, { 
          type: 'geojson', 
          data: { type: 'FeatureCollection', features: [] } 
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3.5,
            'line-dasharray': [3, 2],
          },
        });

        // Add markers source + layer (on top of route)
        const fc = buildMarkersFeatureCollection(origin, null, driverPos, isDriverOnline ?? true);
        map.addSource(MARKERS_SOURCE_ID, { type: 'geojson', data: fc });
        map.addLayer({
          id: MARKERS_LAYER_ID,
          type: 'symbol',
          source: MARKERS_SOURCE_ID,
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 0.9,
            'icon-allow-overlap': true,
            'icon-anchor': ['match', ['get', 'markerType'],
              'origin', 'bottom',
              'destination', 'bottom',
              'center',
            ],
          },
        });
      });

      map.on('error', () => setMapError(true));
      mapRef.current = map;
    } catch {
      setMapError(true);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      iconsRegisteredRef.current = false;
      setMapLoaded(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodingDone, resolvedOrigin]);

  // ✅ Efeito reativo: atualiza rota + marcadores quando destination ou origin mudam
  // Isso garante que a rota seja desenhada mesmo quando destino chega via geocodificação assíncrona
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const updateRouteAndMarkers = async () => {
      // Atualiza marcadores
      if (map.getSource(MARKERS_SOURCE_ID)) {
        const fc = buildMarkersFeatureCollection(origin, destination, driverPos, isDriverOnline ?? true);
        (map.getSource(MARKERS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(fc);
      }

      if (!destination) {
        // Sem destino: centraliza na origem + motorista
        if (map.getSource(ROUTE_SOURCE_ID)) {
          (map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection', features: [],
          });
        }
        return;
      }

      // Com destino: busca rota OSRM
      try {
        const osrmResult = await fetchOSRMRoute(origin, destination);
        const routeSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (routeSource && osrmResult.coordinates.length >= 2) {
          routeSource.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: osrmResult.coordinates },
          });

          setRouteInfo({
            distanceText: osrmResult.distanceText,
            durationText: osrmResult.durationText,
          });

          // Fit bounds à rota completa
          const bounds = new maplibregl.LngLatBounds();
          osrmResult.coordinates.forEach(coord => bounds.extend(coord as [number, number]));
          if (driverPos) bounds.extend([driverPos.lng, driverPos.lat]);
          map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 500 });
        }
      } catch (e) {
        console.warn('[InlineTrackingMap] OSRM fallback to straight line:', e);
        const routeSource = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (routeSource) {
          routeSource.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
            },
          });
          // Fit bounds para linha reta
          const bounds = new maplibregl.LngLatBounds();
          bounds.extend([origin.lng, origin.lat]);
          bounds.extend([destination.lng, destination.lat]);
          if (driverPos) bounds.extend([driverPos.lng, driverPos.lat]);
          map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 500 });
        }
      }
    };

    updateRouteAndMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, origin, destination, driverPos, isDriverOnline]);

  if (mapError) {
    return (
      <div className="h-32 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
        <Map className="h-4 w-4 mr-1" /> Mapa indisponível
      </div>
    );
  }

  // ✅ Aguardando geocodificação do endereço antes de mostrar o mapa
  if (!geocodingDone) {
    return (
      <div className="h-32 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
        <MapPin className="h-4 w-4 mr-1 animate-pulse" /> Localizando endereço...
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height: '280px' }}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* ✅ Status do motorista */}
      {mapLoaded && (
        <div className="absolute top-2 left-2 z-10">
          <Badge 
            variant={isDriverOnline ? "default" : "secondary"}
            className={`flex items-center gap-1.5 px-2 py-1 ${isDriverOnline ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}
          >
            <span className={`w-2 h-2 rounded-full ${isDriverOnline ? 'bg-white animate-pulse' : 'bg-destructive'}`} />
            {isDriverOnline ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      )}

      {/* 🚗 Badge de rota OSRM */}
      {mapLoaded && routeInfo && (
        <div className="absolute bottom-2 left-2 z-10">
          <Badge variant="outline" className="text-xs flex items-center gap-1.5 bg-background/90 shadow-sm">
            <Route className="h-3 w-3 text-primary" />
            <span>{routeInfo.distanceText}</span>
            <span className="text-muted-foreground">•</span>
            <span>{routeInfo.durationText}</span>
          </Badge>
        </div>
      )}

      {/* ✅ Botões de controle */}
      {mapLoaded && (
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCenterOnDriver}
            disabled={!driverPos}
            className="h-8 px-2 shadow-md"
            title="Centralizar no motorista"
          >
            <Navigation className="h-4 w-4 mr-1" />
            Centralizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFitBounds}
            className="h-8 px-2 shadow-md bg-background/90"
            title="Ver trajeto completo"
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver tudo
          </Button>
        </div>
      )}

      {label && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded z-10">
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
  onStartTransit,
  onFinishService,
  onCancel,
  onOpenChat,
  proposalsSection,
  uiNomenclature,
}: ServiceRequestInProgressCardProps) => {
  
  // Parse additional_info FIRST (needed for dest coords)
  let parsedInfo: any = null;
  try {
    parsedInfo = typeof request.additional_info === 'string'
      ? JSON.parse(request.additional_info)
      : request.additional_info;
    if (typeof parsedInfo !== 'object') parsedInfo = null;
  } catch { parsedInfo = null; }

  // Extrair endereços e coordenadas de coleta e entrega
  const originAddress = parsedInfo?.origin?.full_address || parsedInfo?.origin_address || null;
  const destAddress = parsedInfo?.destination?.full_address || parsedInfo?.destination_address || null;
  const destCity = parsedInfo?.destination?.city || null;
  const destState = parsedInfo?.destination?.state || null;

  // ✅ Extrair coordenadas de destino: props > additional_info
  const effectiveDestLat = request.destination_lat || parsedInfo?.destination?.lat || null;
  const effectiveDestLng = request.destination_lng || parsedInfo?.destination?.lng || null;

  const isGuestUser = !!request.prospect_user_id && !request.client_id;
  const hasOriginCoords = !!(request.location_lat && request.location_lng);
  const hasDestCoords = !!(effectiveDestLat && effectiveDestLng);
  const hasAnyCoords = hasOriginCoords || hasDestCoords;

  // ✅ Endereço completo para geocodificação: prioriza location_address, depois monta a partir dos campos
  const effectiveLocationAddress = originAddress || request.location_address
    || (request.city_name
      ? `${request.city_name}${request.state ? ` - ${request.state}` : ''}`
      : null);

  // ✅ Mostra mapa se tiver coords OU endereço/cidade para geocodificar
  const shouldShowMap = hasOriginCoords || !!effectiveLocationAddress;

  // ✅ Coordenadas de fallback: se não tiver coords mas tiver cidade, usa centro do Brasil
  // O InlineTrackingMap vai geocodificar e voar para a localização correta
  const mapOriginLat = request.location_lat || -15.7801;
  const mapOriginLng = request.location_lng || -47.9292;
  const isUrgent = request.urgency && ['ALTA', 'URGENTE'].includes(request.urgency.toUpperCase());
  // ✅ Fretes urbanos usam terminologia de FRETE; serviços técnicos usam terminologia de SERVIÇO
  const isFreight = isFreightType(request.service_type);
  const useFreightNomenclature = uiNomenclature === 'FREIGHT' || (uiNomenclature !== 'SERVICE' && isFreight);

  const openInMaps = () => {
    if (request.location_lat && request.location_lng && effectiveDestLat && effectiveDestLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${request.location_lat},${request.location_lng}&destination=${effectiveDestLat},${effectiveDestLng}`, '_blank');
    } else if (effectiveDestLat && effectiveDestLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${effectiveDestLat},${effectiveDestLng}`, '_blank');
    } else if (request.location_lat && request.location_lng) {
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
    // Email removido - usar WhatsApp ou Chat da plataforma
  };

  // Usa normalizeServiceType do pt-br-validator que já tem todos os tipos mapeados
  const getServiceLabel = () => {
    return normalizeServiceType(request.service_type);
  };

  const getStatusBadge = () => {
    const styles: Record<string, string> = {
      ACCEPTED: 'bg-blue-500', ON_THE_WAY: 'bg-orange-500', IN_PROGRESS: 'bg-yellow-600',
    };
    const labels: Record<string, string> = {
      ACCEPTED: 'Aceito', ON_THE_WAY: 'A Caminho do Local', IN_PROGRESS: useFreightNomenclature ? 'Em Trânsito' : 'Em Atendimento',
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

  return (
    <Card className={`border-l-4 ${isUrgent ? 'border-l-red-500' : 'border-l-orange-500'} hover:shadow-lg transition-shadow`}>
      <CardContent className="p-3 space-y-2">
        {/* Header compacto */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="h-4 w-4 text-primary flex-shrink-0" />
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
            {onOpenChat && request.client_id && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onOpenChat(request)}>
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
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

        {/* ✅ Mapa MapLibre com marcadores A/B (canvas WebGL) - ACIMA dos endereços */}
        {/* Exibe mapa se tiver coords GPS precisas OU endereço/cidade para geocodificar via Nominatim */}
        {shouldShowMap && (
          <InlineTrackingMap 
            originLat={mapOriginLat} 
            originLng={mapOriginLng}
            destLat={effectiveDestLat || undefined}
            destLng={effectiveDestLng || undefined}
            driverLat={request.driver_lat || undefined}
            driverLng={request.driver_lng || undefined}
            isDriverOnline={request.status === 'IN_PROGRESS' || request.status === 'ON_THE_WAY'}
            label={request.city_name || 'Local'}
            locationAddress={effectiveLocationAddress || undefined}
            destAddress={destAddress || (destCity ? `${destCity}${destState ? ` - ${destState}` : ''}` : undefined)}
          />
        )}

        {/* Local do Serviço e Destino */}
        <div className="space-y-1.5">
          {/* LOCAL DO SERVIÇO */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded px-2 py-1.5 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              <span className="text-[11px] font-bold text-green-700 dark:text-green-400">{useFreightNomenclature ? 'LOCAL DO FRETE' : 'LOCAL DO SERVIÇO'}</span>
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

          {/* DESTINO (quando houver) */}
          {(destAddress || destCity) && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400">DESTINO</span>
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

        </div>

        {/* Data preferida */}
        {request.preferred_datetime && (
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-medium">{formatPreferredDateTime()}</span>
          </div>
        )}

        {/* Descrição do problema - compacta */}
        {(() => {
          const normalizedProblemDescription = useFreightNomenclature
            ? (request.problem_description || '').replace(/\b[Ss]erviço\b/g, 'Frete').replace(/\b[Ss]olicitação de serviço\b/g, 'Solicitação de frete')
            : (request.problem_description || '');
          const isGenericDescription = /solicitação de (serviço|frete)/i.test(normalizedProblemDescription.trim());
          if (!normalizedProblemDescription || isGenericDescription) return null;
          return (
            <div className="text-xs bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1.5">
              <span className="text-muted-foreground">Descrição: </span>
              <span>{normalizedProblemDescription}</span>
            </div>
          );
        })()}

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

        {/* Valor */}
        {request.estimated_price && (
          <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
            <span className="text-sm font-bold text-green-700 dark:text-green-300">{useFreightNomenclature ? '💰 Valor do Frete:' : '💰 Valor do Serviço:'}</span>
            <span className="text-lg font-black text-green-600">{formatBRL(request.estimated_price)}</span>
          </div>
        )}

        {/* Propostas de valor */}
        {proposalsSection}

        {/* Aceito em */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Aceito em: {formatAcceptedAt()}</span>
        </div>
      </CardContent>

      <CardFooter className="px-3 pb-3 pt-0 flex gap-2">
        {/* Etapa 1: ACCEPTED → A Caminho do Local */}
        {request.status === 'ACCEPTED' && (
          <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 h-9" onClick={() => onMarkOnTheWay(request.id)}>
            <Navigation className="h-4 w-4 mr-1" />
            A Caminho do Local
          </Button>
        )}
        {/* Etapa 2: ON_THE_WAY → Iniciar Frete (frete urbano) ou Iniciar Atendimento (serviço) */}
        {request.status === 'ON_THE_WAY' && (
          <Button size="sm" className="flex-1 bg-yellow-600 hover:bg-yellow-700 h-9" onClick={() => onStartTransit(request.id)}>
            {isFreight ? <Truck className="h-4 w-4 mr-1" /> : <Wrench className="h-4 w-4 mr-1" />}
            {isFreight ? 'Iniciar Frete' : 'Iniciar Atendimento'}
          </Button>
        )}
        {/* Etapa 3: IN_PROGRESS → Concluir Frete (frete urbano) ou Concluir Serviço (serviço) */}
        {request.status === 'IN_PROGRESS' && (
          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-9" onClick={() => onFinishService(request.id)}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isFreight ? 'Concluir Frete' : 'Concluir Serviço'}
          </Button>
        )}
        {/* Botão Cancelar */}
        {onCancel && (request.status === 'ACCEPTED' || request.status === 'ON_THE_WAY') && (
          <Button size="sm" variant="destructive" className="h-9" onClick={() => onCancel(request.id)}>
            <AlertTriangle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// ✅ Sem memo customizado — deixa React decidir naturalmente
// Memo customizado anterior bloqueava re-render quando status mudava
export const ServiceRequestInProgressCard = React.memo(ServiceRequestInProgressCardComponent);
