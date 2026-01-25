import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, Loader2 } from 'lucide-react';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { supabase } from '@/integrations/supabase/client';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface AddressData {
  city?: string;
  state?: string;
  neighborhood?: string;
  street?: string;
  number?: string;
  lat: number;
  lng: number;
}

interface GPSAddressButtonProps {
  onLocationFilled: (data: AddressData) => void;
  onError?: (message: string) => void;
  label?: string;
  className?: string;
}

/**
 * Button 2: "Usar GPS para Endereço de Coleta" - Fills full address
 * Fills: city, state, street, number, neighborhood (when available)
 * If number not available, leaves empty or uses "s/n"
 * If only city found, fills only city
 */
export function GPSAddressButton({ 
  onLocationFilled, 
  onError,
  label = 'Usar GPS para Endereço',
  className = '' 
}: GPSAddressButtonProps) {
  const [loading, setLoading] = useState(false);
  const { requestLocation } = useLocationPermission(false);

  const handleClick = async () => {
    setLoading(true);
    
    try {
      // Request permission
      const granted = await requestLocation();
      if (!granted) {
        onError?.('Não foi possível acessar sua localização para preencher o endereço.');
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
          onError?.('Não foi possível acessar sua localização para preencher o endereço.');
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
          onError?.('Não foi possível acessar sua localização para preencher o endereço.');
          return;
        }
      }

      // Full reverse geocode
      try {
        const { data, error } = await supabase.functions.invoke('reverse-geocode', {
          body: { lat: latitude, lng: longitude }
        });

        if (error) {
          console.error('Reverse geocode error:', error);
          // Still provide coordinates even if geocode fails
          onLocationFilled({ lat: latitude, lng: longitude });
          return;
        }

        // Build address data - fill what's available
        const addressData: AddressData = {
          lat: latitude,
          lng: longitude,
          city: data?.city || undefined,
          state: data?.state || undefined,
          neighborhood: data?.neighborhood || undefined,
          street: data?.street || undefined,
          // If no number, leave undefined (UI can show empty or handle it)
          number: data?.number || undefined,
        };

        onLocationFilled(addressData);
      } catch (geocodeError) {
        console.error('Geocode exception:', geocodeError);
        // Fallback: provide coordinates only
        onLocationFilled({ lat: latitude, lng: longitude });
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
        <Navigation className="h-4 w-4" />
      )}
      <span className="text-xs sm:text-sm">
        {loading ? '' : label}
      </span>
    </Button>
  );
}
