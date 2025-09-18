import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocationPermission } from './useLocationPermission';

interface TrackingState {
  isActive: boolean;
  lastUpdate: Date | null;
  error: string | null;
  signalLost: boolean;
  locationCount: number;
}

interface TrackingSettings {
  updateInterval: number;
  signalLossThreshold: number;
  routeDeviationThreshold: number;
}

export function useFreightTracking(freightId: string | null, enabled: boolean = false) {
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isActive: false,
    lastUpdate: null,
    error: null,
    signalLost: false,
    locationCount: 0
  });
  
  const [settings, setSettings] = useState<TrackingSettings>({
    updateInterval: 30000, // 30 segundos
    signalLossThreshold: 90000, // 90 segundos
    routeDeviationThreshold: 5000 // 5km
  });

  const { hasPermission, requestLocation } = useLocationPermission();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const signalLossTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Carregar configurações do sistema
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('tracking_settings')
          .select('setting_key, setting_value');
        
        if (data) {
          const settingsMap = data.reduce((acc, item) => {
            acc[item.setting_key] = item.setting_value;
            return acc;
          }, {} as Record<string, string>);

          setSettings({
            updateInterval: parseInt(settingsMap.location_update_interval || '30') * 1000,
            signalLossThreshold: parseInt(settingsMap.signal_loss_threshold || '90') * 1000,
            routeDeviationThreshold: parseInt(settingsMap.route_deviation_threshold || '5000')
          });
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    };

    loadSettings();
  }, []);

  // Função para enviar localização
  const sendLocation = useCallback(async () => {
    if (!freightId || !hasPermission) {
      return;
    }

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude, speed, heading, accuracy } = position.coords;

      // Enviar para o backend
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.functions.invoke('tracking-service', {
        body: {
          freight_id: freightId,
          lat: latitude,
          lng: longitude,
          speed: speed || 0,
          heading: heading || 0,
          accuracy: accuracy || 0,
          source: 'GPS'
        }
      });

      if (error) throw error;

      // Atualizar estado local
      setTrackingState(prev => ({
        ...prev,
        lastUpdate: new Date(),
        error: null,
        signalLost: false,
        locationCount: prev.locationCount + 1
      }));

      lastLocationRef.current = { lat: latitude, lng: longitude };

      // Reset timer de perda de sinal
      if (signalLossTimerRef.current) {
        clearTimeout(signalLossTimerRef.current);
      }
      
      signalLossTimerRef.current = setTimeout(() => {
        handleSignalLoss();
      }, settings.signalLossThreshold);

    } catch (error: any) {
      console.error('Erro ao enviar localização:', error);
      setTrackingState(prev => ({
        ...prev,
        error: error.message
      }));
    }
  }, [freightId, hasPermission, settings.signalLossThreshold]);

  // Função para lidar com perda de sinal
  const handleSignalLoss = useCallback(async () => {
    if (!freightId) return;

    setTrackingState(prev => ({ ...prev, signalLost: true }));
    
    // Notificar motorista
    toast.error(
      "Rastreamento interrompido. Ative a localização em até 30s para evitar suspensão e notificação ao embarcador.",
      { duration: 30000 }
    );

    // Criar incidente automático
    try {
      const { error } = await supabase.functions.invoke('tracking-service', {
        body: {
          freight_id: freightId,
          incident_type: 'SIGNAL_LOST',
          severity: 'HIGH',
          last_known_lat: lastLocationRef.current?.lat,
          last_known_lng: lastLocationRef.current?.lng,
          description: 'Perda de sinal GPS detectada automaticamente',
          evidence_data: {
            last_location: lastLocationRef.current,
            signal_loss_duration: settings.signalLossThreshold / 1000,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) {
        console.error('Erro ao criar incidente:', error);
      }
    } catch (error) {
      console.error('Erro ao reportar perda de sinal:', error);
    }
  }, [freightId, settings.signalLossThreshold]);

  // Iniciar rastreamento
  const startTracking = useCallback(async () => {
    if (!freightId) {
      setTrackingState(prev => ({ ...prev, error: 'ID do frete não fornecido' }));
      return false;
    }

    if (!hasPermission) {
      const granted = await requestLocation();
      if (!granted) {
        setTrackingState(prev => ({ ...prev, error: 'Permissão de localização negada' }));
        return false;
      }
    }

    try {
      // Marcar frete como sendo rastreado
      const { error } = await supabase
        .from('freights')
        .update({
          tracking_required: true,
          tracking_status: 'ACTIVE',
          tracking_started_at: new Date().toISOString()
        })
        .eq('id', freightId);

      if (error) throw error;

      // Iniciar envio periódico de localização
      intervalRef.current = setInterval(sendLocation, settings.updateInterval);
      
      // Enviar primeira localização imediatamente
      await sendLocation();

      setTrackingState(prev => ({
        ...prev,
        isActive: true,
        error: null,
        signalLost: false
      }));

      toast.success("Rastreamento ativado com sucesso");
      return true;
    } catch (error: any) {
      console.error('Erro ao iniciar rastreamento:', error);
      setTrackingState(prev => ({ ...prev, error: error.message }));
      return false;
    }
  }, [freightId, hasPermission, requestLocation, sendLocation, settings.updateInterval]);

  // Parar rastreamento
  const stopTracking = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (signalLossTimerRef.current) {
      clearTimeout(signalLossTimerRef.current);
      signalLossTimerRef.current = null;
    }

    if (freightId) {
      try {
        await supabase
          .from('freights')
          .update({
            tracking_status: 'INACTIVE',
            tracking_ended_at: new Date().toISOString()
          })
          .eq('id', freightId);
      } catch (error) {
        console.error('Erro ao parar rastreamento:', error);
      }
    }

    setTrackingState(prev => ({
      ...prev,
      isActive: false,
      signalLost: false
    }));

    toast.info("Rastreamento desativado");
  }, [freightId]);

  // Efeito para controlar o rastreamento
  useEffect(() => {
    if (enabled && freightId && hasPermission) {
      startTracking();
    } else if (!enabled) {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, freightId, hasPermission, startTracking, stopTracking]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (signalLossTimerRef.current) {
        clearTimeout(signalLossTimerRef.current);
      }
    };
  }, []);

  return {
    trackingState,
    startTracking,
    stopTracking,
    settings
  };
}

// Função helper para obter posição atual
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  });
}