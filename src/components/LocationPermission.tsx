import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

interface LocationPermissionProps {
  onPermissionChange: (enabled: boolean) => void;
  required?: boolean;
}

export const LocationPermission: React.FC<LocationPermissionProps> = ({
  onPermissionChange,
  required = false
}) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    if ('geolocation' in navigator) {
      try {
        const permission = await navigator.permissions.query({name: 'geolocation'});
        const enabled = permission.state === 'granted';
        setLocationEnabled(enabled);
        onPermissionChange(enabled);
      } catch (error) {
        // Try to get location permission directly
      }
    }
  };

  const requestLocationPermission = async () => {
    setChecking(true);
    
    try {
      const { requestPermissionSafe, getCurrentPositionSafe } = await import('@/utils/location');
      const granted = await requestPermissionSafe();
      if (!granted) {
        setLocationEnabled(false);
        onPermissionChange(false);
        toast.error('Permissão de localização negada. Por favor, ative nas configurações do navegador.');
        return;
      }
      
      await getCurrentPositionSafe();
      setLocationEnabled(true);
      onPermissionChange(true);
      toast.success('Localização ativada com sucesso!');
    } catch (error: any) {
      setLocationEnabled(false);
      onPermissionChange(false);
      
      if (error?.code === 1) {
        toast.error('Permissão de localização negada. Por favor, ative nas configurações do navegador.');
      } else if (error?.code === 2) {
        toast.error('Localização indisponível no momento.');
      } else if (error?.code === 3) {
        toast.error('Tempo limite para obter localização.');
      } else {
        toast.error('Erro ao obter localização.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className={`${locationEnabled ? 'border-green-200' : required ? 'border-red-200' : 'border-gray-200'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MapPin className={`h-5 w-5 ${locationEnabled ? 'text-green-600' : 'text-gray-400'}`} />
            <div>
              <h4 className="font-medium">
                Localização {required && <span className="text-red-500">*</span>}
              </h4>
              <p className="text-sm text-muted-foreground">
                {locationEnabled 
                  ? 'Localização ativada e funcionando'
                  : 'Necessário para usar o aplicativo'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={locationEnabled ? 'default' : 'secondary'}>
              {locationEnabled ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Ativo
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Inativo
                </>
              )}
            </Badge>
            
            {!locationEnabled && (
              <Button 
                size="sm" 
                onClick={requestLocationPermission}
                disabled={checking}
              >
                {checking ? 'Verificando...' : 'Ativar'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationPermission;