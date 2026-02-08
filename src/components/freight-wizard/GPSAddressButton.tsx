import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, Loader2 } from 'lucide-react';
import { requestPermissionSafe, getCurrentPositionSafe } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';

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
 * 
 * Usa requestPermissionSafe + getCurrentPositionSafe diretamente
 * para evitar chamadas duplicadas ao navigator.geolocation
 */
export function GPSAddressButton({ 
  onLocationFilled, 
  onError,
  label = 'Usar GPS para Endereço',
  className = '' 
}: GPSAddressButtonProps) {
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

      // Step 3: Full reverse geocode
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
