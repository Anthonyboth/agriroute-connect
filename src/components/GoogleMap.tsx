import React, { useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  markers?: Array<{
    position: { lat: number; lng: number };
    title: string;
    info?: string;
  }>;
}

const GoogleMap: React.FC<GoogleMapProps> = ({
  center = { lat: -14.235, lng: -51.925 }, // Centro do Brasil
  zoom = 5,
  className = "w-full h-[400px]",
  markers = []
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
        // Fallback para quando não há chave de API
        if (mapRef.current) {
          mapRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full bg-muted rounded-lg">
              <div class="text-center">
                <p class="text-muted-foreground">Mapa indisponível</p>
                <p class="text-sm text-muted-foreground">Configure a chave da API do Google Maps</p>
              </div>
            </div>
          `;
        }
      }
    };

    initializeMap();
  }, [center, zoom, markers]);

  return <div ref={mapRef} className={className} />;
};

export default GoogleMap;