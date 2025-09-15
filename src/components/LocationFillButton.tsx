import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { toast } from 'sonner';

interface LocationFillButtonProps {
  onLocationFilled: (address: string, lat?: number, lng?: number) => void;
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
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;

      // Usar reverse geocoding para obter o endereço
      try {
        const response = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_API_KEY&language=pt&pretty=1`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const address = data.results[0].formatted;
            onLocationFilled(address, latitude, longitude);
            toast.success('Localização preenchida automaticamente!');
          } else {
            // Fallback simples se a API falhar
            const simpleAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            onLocationFilled(simpleAddress, latitude, longitude);
            toast.success('Coordenadas preenchidas!');
          }
        } else {
          throw new Error('Geocoding failed');
        }
      } catch (geoError) {
        // Fallback: usar apenas as coordenadas
        const simpleAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        onLocationFilled(simpleAddress, latitude, longitude);
        toast.success('Coordenadas preenchidas!');
      }
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
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      {loading ? 'Obtendo...' : 'Usar Localização Atual'}
    </Button>
  );
};