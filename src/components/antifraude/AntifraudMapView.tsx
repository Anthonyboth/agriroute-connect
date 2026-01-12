import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map, Layers, Eye, EyeOff } from 'lucide-react';
import type { StopEvent, RouteDeviation, OfflineIncident, TimelineEvent } from '@/hooks/useAntifraudData';

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
  
  const [layers, setLayers] = useState({
    stops: true,
    deviations: true,
    offline: true,
    route: true,
  });

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Calculate center from available coordinates
  const getCenter = (): [number, number] => {
    const points: [number, number][] = [];
    
    if (originLat && originLng) points.push([originLng, originLat]);
    if (destinationLat && destinationLng) points.push([destinationLng, destinationLat]);
    if (currentLat && currentLng) points.push([currentLng, currentLat]);
    
    stops.forEach(s => points.push([Number(s.lng), Number(s.lat)]));
    routeDeviations.forEach(d => points.push([Number(d.lng), Number(d.lat)]));
    offlineIncidents.forEach(o => {
      if (o.last_known_lat && o.last_known_lng) {
        points.push([Number(o.last_known_lng), Number(o.last_known_lat)]);
      }
    });

    if (points.length === 0) return [-49.2733, -25.4284]; // Default: Curitiba

    const avgLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    
    return [avgLng, avgLat];
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = getCenter();
    
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data or layer visibility changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const map = mapRef.current;

    // Add origin marker
    if (originLat && originLng) {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold';
      el.textContent = 'O';
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([originLng, originLat])
        .setPopup(new maplibregl.Popup().setHTML('<strong>Origem</strong>'))
        .addTo(map);
      
      markersRef.current.push(marker);
    }

    // Add destination marker
    if (destinationLat && destinationLng) {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold';
      el.textContent = 'D';
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([destinationLng, destinationLat])
        .setPopup(new maplibregl.Popup().setHTML('<strong>Destino</strong>'))
        .addTo(map);
      
      markersRef.current.push(marker);
    }

    // Add current position marker
    if (currentLat && currentLng) {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 rounded-full bg-blue-500 border-3 border-white shadow-lg flex items-center justify-center animate-pulse';
      el.innerHTML = '🚛';
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([currentLng, currentLat])
        .setPopup(new maplibregl.Popup().setHTML('<strong>Posição Atual</strong>'))
        .addTo(map);
      
      markersRef.current.push(marker);
    }

    // Add stop markers
    if (layers.stops) {
      stops.forEach(stop => {
        const riskColor = 
          stop.risk_level === 'critical' ? 'bg-red-600' :
          stop.risk_level === 'high' ? 'bg-orange-500' :
          stop.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-gray-400';
        
        const el = document.createElement('div');
        el.className = `w-5 h-5 rounded-full ${riskColor} border-2 border-white shadow-lg cursor-pointer`;
        el.title = stop.reason || 'Parada';
        
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <strong class="text-sm">Parada ${stop.risk_level}</strong>
            <p class="text-xs text-gray-600 mt-1">${stop.reason || 'Parada detectada'}</p>
            ${stop.duration_minutes ? `<p class="text-xs mt-1">Duração: ${stop.duration_minutes} min</p>` : ''}
          </div>
        `);
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(stop.lng), Number(stop.lat)])
          .setPopup(popup)
          .addTo(map);
        
        el.addEventListener('click', () => {
          onEventClick?.({
            id: stop.id,
            type: 'stop',
            timestamp: stop.started_at,
            duration_minutes: stop.duration_minutes,
            description: stop.reason || 'Parada detectada',
            risk_level: stop.risk_level,
            lat: Number(stop.lat),
            lng: Number(stop.lng),
          });
        });
        
        markersRef.current.push(marker);
      });
    }

    // Add deviation markers
    if (layers.deviations) {
      routeDeviations.forEach(deviation => {
        const el = document.createElement('div');
        el.className = 'w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-lg cursor-pointer flex items-center justify-center';
        el.innerHTML = '↗';
        el.style.fontSize = '10px';
        el.style.color = 'white';
        
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <strong class="text-sm">Desvio de Rota</strong>
            <p class="text-xs text-gray-600 mt-1">${Number(deviation.deviation_km).toFixed(1)} km da rota</p>
            <p class="text-xs">Severidade: ${deviation.severity}</p>
          </div>
        `);
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(deviation.lng), Number(deviation.lat)])
          .setPopup(popup)
          .addTo(map);
        
        markersRef.current.push(marker);
      });
    }

    // Add offline incident markers
    if (layers.offline) {
      offlineIncidents.forEach(incident => {
        if (!incident.last_known_lat || !incident.last_known_lng) return;
        
        const el = document.createElement('div');
        el.className = `w-5 h-5 rounded-full ${incident.is_suspicious ? 'bg-red-600' : 'bg-gray-500'} border-2 border-white shadow-lg cursor-pointer flex items-center justify-center`;
        el.innerHTML = '📡';
        el.style.fontSize = '10px';
        
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <strong class="text-sm">${incident.is_suspicious ? '⚠️ Offline Suspeito' : 'Perda de Sinal'}</strong>
            ${incident.duration_minutes ? `<p class="text-xs mt-1">Duração: ${incident.duration_minutes} min</p>` : ''}
            ${incident.distance_gap_km ? `<p class="text-xs">Gap: ${Number(incident.distance_gap_km).toFixed(1)} km</p>` : ''}
          </div>
        `);
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([Number(incident.last_known_lng), Number(incident.last_known_lat)])
          .setPopup(popup)
          .addTo(map);
        
        markersRef.current.push(marker);
      });
    }

    // Fit bounds to all markers
    if (markersRef.current.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      markersRef.current.forEach(m => bounds.extend(m.getLngLat()));
      map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [stops, routeDeviations, offlineIncidents, layers, originLat, originLng, destinationLat, destinationLng, currentLat, currentLng]);

  const hasData = stops.length > 0 || routeDeviations.length > 0 || offlineIncidents.length > 0 || originLat || destinationLat;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="h-4 w-4" />
            Mapa Antifraude
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={layers.stops ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer('stops')}
            >
              {layers.stops ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Paradas
            </Button>
            <Button
              size="sm"
              variant={layers.deviations ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer('deviations')}
            >
              {layers.deviations ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Desvios
            </Button>
            <Button
              size="sm"
              variant={layers.offline ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => toggleLayer('offline')}
            >
              {layers.offline ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Offline
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={mapContainerRef} 
          className="h-[350px] w-full rounded-b-lg"
        />
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-b-lg">
            <p className="text-sm text-muted-foreground">Sem dados de localização disponíveis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
