import React, { useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { safeClearChildren, optionalRemove } from '@/utils/domUtils';

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  markers?: Array<{
    position: { lat: number; lng: number };
    title: string;
    info?: string;
  }>;
  onClick?: (lat: number, lng: number) => void;
}

const GoogleMap: React.FC<GoogleMapProps> = ({
  center = { lat: -14.235, lng: -51.925 }, // Centro do Brasil
  zoom = 5,
  className = "w-full h-[400px]",
  markers = [],
  onClick
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const fallbackContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const cleanup = () => {
      // Close all info windows
      infoWindowsRef.current.forEach(iw => {
        try {
          iw.close();
        } catch (e) {
          console.warn('[GoogleMap] Error closing InfoWindow:', e);
        }
      });
      infoWindowsRef.current = [];

      // Remove all listeners
      listenersRef.current.forEach(listener => {
        try {
          listener.remove();
        } catch (e) {
          console.warn('[GoogleMap] Error removing listener:', e);
        }
      });
      listenersRef.current = [];

      // Remove all markers
      markersRef.current.forEach(marker => {
        try {
          if (marker.map) {
            marker.map = null;
          }
        } catch (e) {
          console.warn('[GoogleMap] Error removing marker:', e);
        }
      });
      markersRef.current = [];

      // Clear map reference
      map.current = null;

      // Remove fallback container if exists
      if (fallbackContainerRef.current) {
        optionalRemove(fallbackContainerRef.current);
        fallbackContainerRef.current = null;
      }

      // Clear any remaining children
      if (mapRef.current) {
        safeClearChildren(mapRef.current);
      }
    };

    const initializeMap = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          throw new Error('Google Maps API key not configured');
        }
        
        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places"]
        });

        const { Map } = await loader.importLibrary("maps") as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await loader.importLibrary("marker") as google.maps.MarkerLibrary;

        if (!mounted || !mapRef.current) return;

        map.current = new Map(mapRef.current, {
          center,
          zoom,
          mapId: "DEMO_MAP_ID",
        });

        // Adicionar listener de click se fornecido
        if (onClick && map.current) {
          const clickListener = map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const lat = event.latLng.lat();
              const lng = event.latLng.lng();
              onClick(lat, lng);
            }
          });
          listenersRef.current.push(clickListener);
        }

        // Adicionar marcadores
        markers.forEach((marker) => {
          if (!map.current) return;

          const markerElement = new AdvancedMarkerElement({
            map: map.current,
            position: marker.position,
            title: marker.title,
          });
          markersRef.current.push(markerElement);

          if (marker.info) {
            const infoWindow = new google.maps.InfoWindow({
              content: marker.info,
            });
            infoWindowsRef.current.push(infoWindow);

            const markerListener = markerElement.addListener("click", () => {
              infoWindow.open(map.current, markerElement);
            });
            listenersRef.current.push(markerListener);
          }
        });
      } catch (error) {
        console.error("Erro ao carregar o Google Maps:", error);
        
        if (!mounted || !mapRef.current) return;

        // Clear existing content safely
        safeClearChildren(mapRef.current);
        
        // Create fallback UI using DOM methods (prevents XSS)
        const container = document.createElement('div');
        container.className = 'flex items-center justify-center h-full bg-muted rounded-lg';
        
        const innerDiv = document.createElement('div');
        innerDiv.className = 'text-center';
        
        const title = document.createElement('p');
        title.className = 'text-muted-foreground';
        title.textContent = 'Mapa indisponível';
        
        const subtitle = document.createElement('p');
        subtitle.className = 'text-sm text-muted-foreground';
        subtitle.textContent = 'Configure a chave da API do Google Maps';
        
        innerDiv.appendChild(title);
        innerDiv.appendChild(subtitle);
        container.appendChild(innerDiv);
        mapRef.current.appendChild(container);
        
        fallbackContainerRef.current = container;
      }
    };

    initializeMap();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [center, zoom, markers, onClick]);

  return <div ref={mapRef} className={className} />;
};

export default GoogleMap;