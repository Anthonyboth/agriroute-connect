import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { showGPSToast } from '@/utils/gpsToastGuard';
import { checkPermissionSafe, requestPermissionSafe, getCurrentPositionSafe } from '@/utils/location';

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
    try {
      // Use the unified checkPermissionSafe that works on iOS, Android and Web
      const granted = await checkPermissionSafe();
      setLocationEnabled(granted);
      onPermissionChange(granted);
    } catch (error) {
      console.warn('[LocationPermission] Error checking permission:', error);
      setLocationEnabled(false);
      onPermissionChange(false);
    }
  };

  const requestLocationPermission = async () => {
    setChecking(true);
    
    try {
      const granted = await requestPermissionSafe();
      if (!granted) {
        setLocationEnabled(false);
        onPermissionChange(false);
        showGPSToast('NO_PERMISSION');
        return;
      }
      
      await getCurrentPositionSafe();
      setLocationEnabled(true);
      onPermissionChange(true);
      toast.success('Localização ativada com sucesso!');
    } catch (error: any) {
      setLocationEnabled(false);
      onPermissionChange(false);
      
      const msg = error?.message || '';
      if (msg.includes('desativados') || msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('not enabled')) {
        showGPSToast('GPS_OFF');
      } else if (error?.code === 1) {
        showGPSToast('NO_PERMISSION');
      } else if (error?.code === 2) {
        showGPSToast('GPS_UNAVAILABLE');
      } else if (error?.code === 3) {
        toast.error('Tempo limite para obter localização. Tente novamente.', { id: 'gps-timeout' });
      } else {
        toast.error('Erro ao obter localização. Verifique as permissões do dispositivo.', { id: 'gps-error' });
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
