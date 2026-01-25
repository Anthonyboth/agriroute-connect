import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface GPSOriginButtonProps {
  onLocationFilled: (data: { city: string; state: string; lat: number; lng: number }) => void;
  onError?: (message: string) => void;
  className?: string;
}

/**
 * Button 1: "Usar GPS para Origem" - Only fills origin city/state
 * Does NOT fill street, number, or neighborhood
 */
export function GPSOriginButton({ 
  onLocationFilled, 
  onError,
  className = '' 
}: GPSOriginButtonProps) {
  const [loading, setLoading] = useState(false);
  const { requestLocation } = useLocationPermission(false);

  const handleClick = async () => {
    setLoading(true);
    
    try {
      // Request permission
      const granted = await requestLocation();
      if (!granted) {
        onError?.('Não foi possível acessar sua localização para definir a cidade de origem.');
        setLoading(false);
        return;
      }

      // Get current position (Capacitor for native, Web API for browser)
      let latitude: number;
      let longitude: number;

      if (Capacitor.isNativePlatform()) {
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (capacitorError) {
          console.error('Capacitor Geolocation error:', capacitorError);
          onError?.('Não foi possível acessar sua localização para definir a cidade de origem.');
          return;
        }
      } else {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (webError) {
          console.error('Web Geolocation error:', webError);
          onError?.('Não foi possível acessar sua localização para definir a cidade de origem.');
          return;
        }
      }

      // Reverse geocode - only need city and state
      try {
        const { data, error } = await supabase.functions.invoke('reverse-geocode', {
          body: { lat: latitude, lng: longitude }
        });

        if (error) {
          console.error('Reverse geocode error:', error);
          onError?.('Não foi possível identificar a cidade a partir da sua localização.');
          return;
        }

        if (data?.city && data?.state) {
          onLocationFilled({
            city: data.city,
            state: data.state,
            lat: latitude,
            lng: longitude
          });
        } else {
          onError?.('Não foi possível identificar a cidade a partir da sua localização.');
        }
      } catch (geocodeError) {
        console.error('Geocode exception:', geocodeError);
        onError?.('Erro ao identificar a cidade. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={`gap-2 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {loading ? '' : 'Usar GPS'}
      </span>
    </Button>
  );
}
