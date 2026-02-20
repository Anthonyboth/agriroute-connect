import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  neighborhood?: string;
  street?: string;
  cep?: string;
}

interface LocationFillButtonProps {
  onLocationFilled: (address: string, lat?: number, lng?: number, locationData?: LocationData) => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
}

export const LocationFillButton: React.FC<LocationFillButtonProps> = ({
  onLocationFilled,
  className = '',
  size = 'sm',
  variant = 'outline'
}) => {
  const [loading, setLoading] = useState(false);
  const { hasPermission, requestLocation } = useLocationPermission(false);

  const handleFillCurrentLocation = async () => {
    setLoading(true);
    
    try {
      // Solicitar permissão se não tiver
      if (!hasPermission) {
        const granted = await requestLocation();
        if (!granted) {
          toast.error('Permissão de localização negada');
          return;
        }
      }

      // Obter localização atual
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();

      const { latitude, longitude } = position.coords;

      // Tentar geocodificação reversa
      try {
        const { data, error } = await supabase.functions.invoke('reverse-geocode', {
          body: { lat: latitude, lng: longitude }
        });

        if (!error && data) {
          const locationData: LocationData = {
            address: data.formatted_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            lat: latitude,
            lng: longitude,
            city: data.city,
            state: data.state,
            neighborhood: data.neighborhood,
            street: data.street,
            cep: data.cep
          };
          
          onLocationFilled(locationData.address, latitude, longitude, locationData);
          toast.success(`Localização: ${data.city || 'Coordenadas'} preenchida!`);
          return;
        }
      } catch (geocodeError) {
        console.warn('Geocodificação reversa falhou, usando coordenadas:', geocodeError);
      }

      // Fallback: usar coordenadas diretamente
      const simpleAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      onLocationFilled(simpleAddress, latitude, longitude);
      toast.success('Coordenadas preenchidas!');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Erro ao obter localização. Verifique as permissões.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleFillCurrentLocation}
      disabled={loading}
      className={`gap-1.5 ${className}`}
      title="Preencher endereço com localização GPS atual"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MapPin className="h-3.5 w-3.5" />
      )}
      <span>{loading ? 'Obtendo GPS...' : '📍 Preencher com GPS'}</span>
    </Button>
  );
};
