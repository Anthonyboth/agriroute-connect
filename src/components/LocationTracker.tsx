import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { toast } from 'sonner';
import { 
  MapPin, 
  Satellite, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Clock,
  Navigation
} from 'lucide-react';
import { getCurrentPositionSafe, watchPositionSafe } from '@/utils/location';

interface LocationTrackerProps {
  freightId?: string;
  required?: boolean;
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: Date;
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({
  freightId,
  required = false,
  onLocationUpdate
}) => {
  const { profile } = useAuth();
  const { hasActiveFreight } = useActiveFreight();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [watchId, setWatchId] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setLocationEnabled(profile.location_enabled || false);
      loadLastLocation();
    }
  }, [profile]);

  useEffect(() => {
    if (isTracking) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [isTracking]);

  const loadLastLocation = async () => {
    if (!profile) return;

    try {
      // Carregar última localização salva
      if (profile.current_location_lat && profile.current_location_lng && profile.last_gps_update) {
        setCurrentLocation({
          lat: profile.current_location_lat,
          lng: profile.current_location_lng,
          accuracy: 0,
          timestamp: new Date(profile.last_gps_update)
        });
        setLastUpdate(new Date(profile.last_gps_update));
      }
    } catch (error) {
      console.error('Erro ao carregar localização:', error);
    }
  };

  const getCurrentPosition = async (): Promise<any> => {
    const pos = await getCurrentPositionSafe();
    return { coords: pos.coords } as any;
  };

  const startTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obter posição inicial
      const position = await getCurrentPosition();
      await updateLocation(position as any);

      // Iniciar rastreamento contínuo usando Capacitor/Web fallback
      const handle = watchPositionSafe(
        (coords) => updateLocation({ coords } as any),
        (err) => handleLocationError(err)
      );

      setWatchId(handle);
      toast.success('Rastreamento de localização iniciado');

    } catch (error) {
      handleLocationError(error as GeolocationPositionError);
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = () => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      setWatchId(null);
    }
  };

  const updateLocation = async (position: GeolocationPosition) => {
    if (!profile) return;

    const locationData: LocationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date()
    };

    setCurrentLocation(locationData);
    setLastUpdate(locationData.timestamp);

    try {
      // Salvar no perfil do usuário
      const { error } = await supabase
        .from('profiles')
        .update({
          current_location_lat: locationData.lat,
          current_location_lng: locationData.lng,
          last_gps_update: locationData.timestamp.toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      // ❌ REMOVIDO: Atualização direta na tabela freights
      // Isso causava erro "Data de coleta deve ser futura" devido ao trigger validate_freight_input
      // A localização agora é lida de driver_current_locations ou profiles pelo hook useFreightRealtimeLocation

      // Callback para componentes pais
      if (onLocationUpdate) {
        onLocationUpdate({ lat: locationData.lat, lng: locationData.lng });
      }

    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      setError('Erro ao salvar localização');
    }
  };

  const handleLocationError = (error: GeolocationPositionError | Error) => {
    let errorMessage = 'Erro desconhecido';

    if ('code' in error) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de localização negada';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Localização indisponível';
          break;
        case error.TIMEOUT:
          errorMessage = 'Timeout na obtenção da localização';
          break;
      }
    } else {
      errorMessage = error.message;
    }

    setError(errorMessage);
    setIsTracking(false);
    toast.error(`Erro de localização: ${errorMessage}`);
  };

  const toggleLocationEnabled = async (enabled: boolean) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location_enabled: enabled })
        .eq('id', profile.id);

      if (error) throw error;

      setLocationEnabled(enabled);
      
      if (enabled) {
        toast.success('Localização habilitada');
      } else {
        toast.success('Localização desabilitada');
        setIsTracking(false);
      }
    } catch (error) {
      console.error('Erro ao alterar configuração:', error);
      toast.error('Erro ao alterar configuração');
    }
  };

  const manualUpdate = async () => {
    try {
      setLoading(true);
      const position = await getCurrentPosition();
      await updateLocation(position);
      toast.success('Localização atualizada');
    } catch (error) {
      handleLocationError(error as GeolocationPositionError);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy <= 10) return 'text-green-600';
    if (accuracy <= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLocation = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  return (
    <Card className={required && !locationEnabled ? 'border-red-300' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Rastreamento de Localização
          {required && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Obrigatório
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {required 
            ? 'Localização obrigatória para aceitar fretes'
            : 'Permita o rastreamento para melhor experiência'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status da Permissão */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="location-enabled">Habilitar Localização</Label>
            <p className="text-sm text-muted-foreground">
              Permite o rastreamento da sua localização
            </p>
          </div>
          <Switch
            id="location-enabled"
            checked={locationEnabled}
            onCheckedChange={toggleLocationEnabled}
          />
        </div>

        {locationEnabled && (
          <>
            {/* Controles de Rastreamento */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Rastreamento Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Acompanha sua localização em tempo real
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={manualUpdate}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Switch
                  checked={isTracking}
                  onCheckedChange={setIsTracking}
                />
              </div>
            </div>

            {/* Status Atual */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4" />
                <span className="font-medium">Status:</span>
                {isTracking ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Rastreando
                  </Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
              </div>

              {currentLocation && (
                <>
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    <span className="font-medium">Coordenadas:</span>
                    <span className="font-mono text-sm">
                      {formatLocation(currentLocation.lat, currentLocation.lng)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-medium">Precisão:</span>
                    <span className={`font-mono text-sm ${getAccuracyColor(currentLocation.accuracy)}`}>
                      ±{currentLocation.accuracy.toFixed(0)}m
                    </span>
                  </div>

                  {lastUpdate && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Última atualização:</span>
                      <span className="text-sm text-muted-foreground">
                        {lastUpdate.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Erro de Localização</span>
                </div>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Aviso para Fretes */}
            {required && !isTracking && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Atenção</span>
                </div>
                <p className="text-yellow-600 text-sm mt-1">
                  O rastreamento de localização é obrigatório para aceitar e executar fretes.
                </p>
              </div>
            )}
            
            {/* Informação sobre tracking automático */}
            {!hasActiveFreight && ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile?.role || '') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">Tracking Automático</span>
                </div>
                <p className="text-blue-600 text-sm mt-1">
                  A localização será ativada automaticamente quando você aceitar um frete.
                </p>
              </div>
            )}
          </>
        )}

        {/* Política de Privacidade */}
        <div className="text-xs text-muted-foreground">
          <p>
            Sua localização é usada apenas para fins de logística e segurança. 
            Os dados são criptografados e não compartilhados com terceiros.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};