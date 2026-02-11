/**
 * src/components/antifraude/AntifraudMapView.tsx
 * 
 * Mapa antifraude com visualização de rota OSRM (estradas reais),
 * paradas, desvios e incidentes offline.
 * 
 * REFATORADO: Usa useOSRMRoute para rotas reais por estradas.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTileWatchdog } from "@/hooks/maplibre";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, Eye, EyeOff, Route, Clock } from "lucide-react";
import { useOSRMRoute } from "@/hooks/maplibre";
import { RURAL_STYLE_INLINE, MAP_COLORS } from "@/config/maplibre";

import type { StopEvent, RouteDeviation, OfflineIncident, TimelineEvent } from "@/hooks/useAntifraudData";

interface AntifraudMapViewProps {
  stops: StopEvent[];
  routeDeviations: RouteDeviation[];
  offlineIncidents: OfflineIncident[];
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  currentLat?: number;
  currentLng?: number;
  onEventClick?: (event: TimelineEvent) => void;
}

const DEFAULT_CENTER: [number, number] = [-51.925, -14.235]; // Brasil

export const AntifraudMapView: React.FC<AntifraudMapViewProps> = ({
  stops,
  routeDeviations,
  offlineIncidents,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  currentLat,
  currentLng,
  onEventClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializingRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Tile Watchdog
  useTileWatchdog(mapRef);

  const [layers, setLayers] = useState({
    stops: true,
    deviations: true,
    offline: true,
  });

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ✅ Origem e destino efetivos
  const effectiveOrigin = useMemo(() => {
    if (typeof originLat === "number" && typeof originLng === "number" && !Number.isNaN(originLat) && !Number.isNaN(originLng)) {
      return { lat: originLat, lng: originLng };
    }
    return null;
  }, [originLat, originLng]);

  const effectiveDestination = useMemo(() => {
    if (typeof destinationLat === "number" && typeof destinationLng === "number" && !Number.isNaN(destinationLat) && !Number.isNaN(destinationLng)) {
      return { lat: destinationLat, lng: destinationLng };
    }
    return null;
  }, [destinationLat, destinationLng]);

  // ✅ 🚗 OSRM: Buscar rota real por estradas
  const { 
    route: osrmRoute, 
    isLoading: isLoadingRoute 
  } = useOSRMRoute({
    origin: effectiveOrigin,
    destination: effectiveDestination,
    profile: 'driving',
    enabled: !!(effectiveOrigin && effectiveDestination),
  });

  // 🔒 Centro seguro (0 é válido, NaN não)
  const center = useMemo<[number, number]>(() => {
    const points: [number, number][] = [];

    const push = (lng?: number, lat?: number) => {
      if (typeof lng === "number" && typeof lat === "number" && !Number.isNaN(lng) && !Number.isNaN(lat)) {
        points.push([lng, lat]);
      }
    };

    push(originLng, originLat);
    push(destinationLng, destinationLat);
    push(currentLng, currentLat);

    stops.forEach((s) => push(Number(s.lng), Number(s.lat)));
    routeDeviations.forEach((d) => push(Number(d.lng), Number(d.lat)));
    offlineIncidents.forEach((o) => push(o.last_known_lng, o.last_known_lat));

    if (!points.length) return DEFAULT_CENTER;

    return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
  }, [
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    currentLat,
    currentLng,
    stops,
    routeDeviations,
    offlineIncidents,
  ]);

  // 🧠 Inicialização robusta do mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || initializingRef.current) return;

    const container = mapContainerRef.current;
    const rect = container.getBoundingClientRect();
    
    // ✅ Verificar dimensões válidas
    if (rect.width < 10 || rect.height < 10) {
      if (retryCount < 10) {
        const retryTimeout = setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 100 + (retryCount * 50));
        return () => clearTimeout(retryTimeout);
      }
      console.warn('[AntifraudMapView] Max retries reached, container has no valid dimensions');
      return;
    }

    initializingRef.current = true;

    const map = new maplibregl.Map({
      container: container,
      style: RURAL_STYLE_INLINE,
      center,
      zoom: 8,
      pixelRatio: window.devicePixelRatio || 1,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // ✅ Adicionar source e layer para rota OSRM
      map.addSource('osrm-route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'osrm-route-line',
        type: 'line',
        source: 'osrm-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': MAP_COLORS.primary,
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });

      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
      
      setMapReady(true);
      initializingRef.current = false;
    });

    map.on("error", (e) => {
      console.error("[AntifraudMapView] Map error:", e?.error || e);
      initializingRef.current = false;
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try { map.resize(); } catch {}
      });
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
      initializingRef.current = false;
    };
  }, [center, retryCount]);

  // ✅ Atualizar rota OSRM quando disponível
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const source = mapRef.current.getSource('osrm-route') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (osrmRoute && osrmRoute.coordinates.length >= 2) {
      source.setData({
        type: 'Feature',
        properties: {
          distance: osrmRoute.distanceText,
          duration: osrmRoute.durationText,
        },
        geometry: {
          type: 'LineString',
          coordinates: osrmRoute.coordinates,
        },
      });
      console.log('[AntifraudMapView] OSRM route drawn:', osrmRoute.distanceText, osrmRoute.durationText);
    } else {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [mapReady, osrmRoute]);

  // 🔄 Centraliza quando dados mudam
  useEffect(() => {
    if (mapRef.current && mapReady) {
      mapRef.current.setCenter(center);
    }
  }, [center, mapReady]);

  // ========================================
  // 🚨 DESATIVADO TEMPORARIAMENTE - ZERANDO MAPA
  // Sem markers - apenas basemap puro
  // ========================================
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    // 🚨 DESATIVADO: Limpar markers existentes
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Retorno antecipado - não criar markers
    return;

    /* CÓDIGO ORIGINAL COMENTADO - REATIVAR DEPOIS
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const add = (lng: number, lat: number, el: HTMLElement, html?: string) => {
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]);
      if (html) m.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(html));
      m.addTo(map);
      markersRef.current.push(m);
    };
    
    const createMarkerEl = (color: string, text: string, hasPulse = false) => {
      const root = document.createElement("div");
      root.className = "truck-marker";
      
      root.innerHTML = `
        <div class="truck-marker-inner">
          ${hasPulse ? '<div class="truck-marker-pulse"></div>' : ''}
          <div style="
            width: ${text === '🚛' ? '32px' : '24px'};
            height: ${text === '🚛' ? '32px' : '24px'};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${color};
            color: white;
            font-size: ${text === '🚛' ? '16px' : '12px'};
            font-weight: bold;
          ">
            ${text}
          </div>
        </div>
      `;
      
      return root;
    };

    // Origem
    if (typeof originLat === "number" && typeof originLng === "number") {
      add(originLng, originLat, createMarkerEl("#22c55e", "O"), "<strong>Origem</strong>");
    }

    // Destino
    if (typeof destinationLat === "number" && typeof destinationLng === "number") {
      add(destinationLng, destinationLat, createMarkerEl("#ef4444", "D"), "<strong>Destino</strong>");
    }

    // Posição atual do motorista
    if (typeof currentLat === "number" && typeof currentLng === "number") {
      add(currentLng, currentLat, createMarkerEl("#3b82f6", "🚛", true), "<strong>Posição Atual</strong>");
    }

    // Paradas (se visíveis)
    if (layers.stops) {
      stops.forEach((s) => {
        const el = createMarkerEl("#f97316", "P");
        el.title = `Parada: ${s.duration_minutes || 0} min`;
        add(Number(s.lng), Number(s.lat), el, `<strong>Parada</strong><br/>Duração: ${s.duration_minutes || 0} min`);
      });
    }

    // Desvios (se visíveis)
    if (layers.deviations) {
      routeDeviations.forEach((d) => {
        const el = createMarkerEl("#eab308", "⚠");
        el.title = `Desvio: ${d.deviation_km?.toFixed(1) || '?'} km`;
        add(Number(d.lng), Number(d.lat), el, `<strong>Desvio de Rota</strong><br/>Distância: ${d.deviation_km?.toFixed(1) || '?'} km`);
      });
    }

    // Incidentes offline (se visíveis)
    if (layers.offline) {
      offlineIncidents.forEach((o) => {
        if (o.last_known_lat && o.last_known_lng) {
          const el = createMarkerEl("#6b7280", "📵");
          el.title = `Offline: ${o.duration_minutes || 0} min`;
          add(o.last_known_lng, o.last_known_lat, el, `<strong>Offline</strong><br/>Duração: ${o.duration_minutes || 0} min`);
        }
      });
    }

    // Fit bounds
    if (markersRef.current.length) {
      const bounds = new maplibregl.LngLatBounds();
      markersRef.current.forEach((m) => bounds.extend(m.getLngLat()));
      
      if (osrmRoute && osrmRoute.coordinates.length >= 2) {
        osrmRoute.coordinates.forEach(coord => {
          bounds.extend(coord as [number, number]);
        });
      }
      
      map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 0 });
    }
    */
  }, [
    mapReady,
    layers,
    stops,
    routeDeviations,
    offlineIncidents,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    currentLat,
    currentLng,
    osrmRoute,
    onEventClick,
  ]);

  const hasData =
    stops.length ||
    routeDeviations.length ||
    offlineIncidents.length ||
    typeof originLat === "number" ||
    typeof destinationLat === "number" ||
    typeof currentLat === "number";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="h-4 w-4" /> Mapa Antifraude
          </CardTitle>

          {/* ✅ Badge com distância e tempo da rota OSRM */}
          {osrmRoute && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Route className="h-3 w-3" />
                {osrmRoute.distanceText}
              </Badge>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {osrmRoute.durationText}
              </Badge>
            </div>
          )}

          <div className="flex gap-1">
            {(["stops", "deviations", "offline"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={layers[k] ? "default" : "outline"}
                className="h-7 text-xs px-2"
                onClick={() => toggleLayer(k)}
              >
                {layers[k] ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {k === 'stops' ? 'Paradas' : k === 'deviations' ? 'Desvios' : 'Offline'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <div ref={mapContainerRef} className="h-[400px] w-full rounded-b-lg" />
        {isLoadingRoute && (
          <div className="absolute top-2 left-2 bg-background/80 rounded px-2 py-1 text-xs text-muted-foreground">
            Carregando rota...
          </div>
        )}
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <p className="text-sm text-muted-foreground">Sem dados de localização</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
