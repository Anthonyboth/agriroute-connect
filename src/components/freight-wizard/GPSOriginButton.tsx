import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { requestPermissionSafe, getCurrentPositionSafe } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';

interface GPSOriginButtonProps {
  onLocationFilled: (data: { city: string; state: string; lat: number; lng: number }) => void;
  onError?: (message: string) => void;
  className?: string;
}

/**
 * Button 1: "Usar GPS para Origem" - Only fills origin city/state
 * Does NOT fill street, number, or neighborhood
 * 
 * Usa requestPermissionSafe + getCurrentPositionSafe diretamente
 * para evitar chamadas duplicadas ao navigator.geolocation
 */
export function GPSOriginButton({ 
  onLocationFilled, 
  onError,
  className = '' 
}: GPSOriginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    
    try {
      // Step 1: Request permission (single call)
      const granted = await requestPermissionSafe();
      if (!granted) {
        onError?.('Permissão de localização negada. Verifique as configurações do navegador.');
        setLoading(false);
        return;
      }

      // Step 2: Get position using centralized utility (with retries + rate limiting)
      let latitude: number;
      let longitude: number;

      try {
        const position = await getCurrentPositionSafe(3);
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (posError: any) {
        console.error('GPS position error:', posError?.message || posError);
        onError?.('Não foi possível obter sua localização. Mova-se para uma área aberta e tente novamente.');
        setLoading(false);
        return;
      }

      // Step 3: Reverse geocode - only need city and state
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
