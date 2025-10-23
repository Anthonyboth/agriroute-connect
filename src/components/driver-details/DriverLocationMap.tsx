import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface DriverLocationMapProps {
  lat: number;
  lng: number;
  driverName?: string;
}

export const DriverLocationMap = ({ lat, lng, driverName }: DriverLocationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: 'AIzaSyDu7faUN3xGE9RmqvPGpKruXcIBE1OX5aI',
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (mapRef.current && !map) {
        const newMap = new google.maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        const newMarker = new google.maps.Marker({
          position: { lat, lng },
          map: newMap,
          title: driverName || 'Localização do Motorista',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600;">${driverName || 'Motorista'}</h3>
              <p style="margin: 0; font-size: 14px; color: #666;">Última localização conhecida</p>
            </div>
          `,
        });

        newMarker.addListener('click', () => {
          infoWindow.open(newMap, newMarker);
        });

        setMap(newMap);
        setMarker(newMarker);
      }
    });
  }, []);

  useEffect(() => {
    if (map && marker) {
      const newPosition = { lat, lng };
      marker.setPosition(newPosition);
      map.panTo(newPosition);
    }
  }, [lat, lng, map, marker]);

  return <div ref={mapRef} className="w-full h-[400px] rounded-lg" />;
};
