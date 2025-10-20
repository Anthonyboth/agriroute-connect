import React, { useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { safeClearChildren, safeAppendChild } from '@/utils/domUtils';

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

  useEffect(() => {
    const initializeMap = async () => {
      try {
        const loader = new Loader({
          apiKey: "YOUR_GOOGLE_MAPS_API_KEY", // Substituir por sua chave
          version: "weekly",
          libraries: ["places"]
        });

        const { Map } = await loader.importLibrary("maps") as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await loader.importLibrary("marker") as google.maps.MarkerLibrary;

        if (mapRef.current) {
          map.current = new Map(mapRef.current, {
            center,
            zoom,
            mapId: "DEMO_MAP_ID",
          });

          // Adicionar listener de click se fornecido
          if (onClick) {
            map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
              if (event.latLng) {
                const lat = event.latLng.lat();
                const lng = event.latLng.lng();
                onClick(lat, lng);
              }
            });
          }

          // Adicionar marcadores
          markers.forEach((marker) => {
            const markerElement = new AdvancedMarkerElement({
              map: map.current,
              position: marker.position,
              title: marker.title,
            });

            if (marker.info) {
              const infoWindow = new google.maps.InfoWindow({
                content: marker.info,
              });

              markerElement.addListener("click", () => {
                infoWindow.open(map.current, markerElement);
              });
            }
          });
        }
      } catch (error) {
        console.error("Erro ao carregar o Google Maps:", error);
        // Fallback para quando não há chave de API - usando DOM seguro
        if (mapRef.current) {
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
          
          safeAppendChild(innerDiv, title);
          safeAppendChild(innerDiv, subtitle);
          safeAppendChild(container, innerDiv);
          safeAppendChild(mapRef.current, container);
        }
      }
    };

    initializeMap();
  }, [center, zoom, markers]);

  return <div ref={mapRef} className={className} />;
};

export default GoogleMap;