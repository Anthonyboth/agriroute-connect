/**
 * src/hooks/useFreightRealtimeLocation.ts
 * 
 * Hook para subscription realtime da localização do motorista.
 * Gerencia estado de conexão, cálculo de online/offline e cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDriverOnline, getSecondsSinceUpdate } from '@/lib/maplibre-utils';

interface DriverLocation {
  lat: number;
  lng: number;
}

interface UseFreightRealtimeLocationResult {
  driverLocation: DriverLocation | null;
  lastUpdate: Date | null;
  isOnline: boolean;
  secondsAgo: number;
  isLoading: boolean;
  error: string | null;
}

const OFFLINE_THRESHOLD_MS = 90000; // 90 segundos
const REFRESH_INTERVAL_MS = 5000; // Atualizar secondsAgo a cada 5s

export function useFreightRealtimeLocation(freightId: string | null): UseFreightRealtimeLocationResult {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(Infinity);
  const [isOnline, setIsOnline] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateRef = useRef<number>(0); // Debounce para updates extremos

  // Função para atualizar estado de tempo
  const updateTimeState = useCallback(() => {
    if (lastUpdate) {
      const seconds = getSecondsSinceUpdate(lastUpdate);
      setSecondsAgo(seconds);
      setIsOnline(isDriverOnline(lastUpdate, OFFLINE_THRESHOLD_MS));
    } else {
      setSecondsAgo(Infinity);
      setIsOnline(false);
    }
  }, [lastUpdate]);

  // Buscar localização inicial
  useEffect(() => {
    if (!freightId) {
      setIsLoading(false);
      return;
    }

    const fetchInitialLocation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Buscar frete com driver_id para fallback
        const { data, error: fetchError } = await supabase
          .from('freights')
          .select('current_lat, current_lng, last_location_update, driver_id')
          .eq('id', freightId)
          .single();

        if (fetchError) {
          console.error('[useFreightRealtimeLocation] Fetch error:', fetchError);
          setError('Erro ao buscar localização');
          return;
        }

        // FALLBACK: Se frete não tem localização, buscar do driver_location_history (mais seguro)
        if ((!data?.current_lat || !data?.current_lng) && data?.driver_id) {
          console.log('[useFreightRealtimeLocation] Freight location null, fetching from driver location history...');
          
          // Buscar última localização do histórico (protegido por RLS para participantes do frete)
          const { data: locationHistory } = await supabase
            .from('driver_location_history')
            .select('lat, lng, captured_at')
            .eq('driver_profile_id', data.driver_id)
            .eq('freight_id', freightId)
            .order('captured_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (locationHistory?.lat && locationHistory?.lng) {
            setDriverLocation({ 
              lat: locationHistory.lat, 
              lng: locationHistory.lng 
            });
            if (locationHistory.captured_at) {
              setLastUpdate(new Date(locationHistory.captured_at));
            }
            console.log('[useFreightRealtimeLocation] Using driver location history:', {
              lat: locationHistory.lat,
              lng: locationHistory.lng
            });
            return;
          }
        }

        if (data?.current_lat && data?.current_lng) {
          setDriverLocation({ lat: data.current_lat, lng: data.current_lng });
        }

        if (data?.last_location_update) {
          setLastUpdate(new Date(data.last_location_update));
        }

        console.log('[useFreightRealtimeLocation] Initial location loaded:', {
          freightId,
          lat: data?.current_lat,
          lng: data?.current_lng,
          lastUpdate: data?.last_location_update
        });

      } catch (err) {
        console.error('[useFreightRealtimeLocation] Unexpected error:', err);
        setError('Erro inesperado');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialLocation();
  }, [freightId]);

  // Subscription Realtime
  useEffect(() => {
    if (!freightId) return;

    console.log('[useFreightRealtimeLocation] Setting up realtime subscription for freight:', freightId);

    // Cleanup de canal existente antes de criar novo (evita duplicação em hot reload)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`freight-realtime-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'freights',
          filter: `id=eq.${freightId}`
        },
        (payload) => {
          // Debounce: ignorar updates muito frequentes (<800ms)
          const now = Date.now();
          if (now - lastUpdateRef.current < 800) {
            console.log('[useFreightRealtimeLocation] Update debounced');
            return;
          }
          lastUpdateRef.current = now;

          console.log('[useFreightRealtimeLocation] Realtime update received:', payload);
          
          const newData = payload.new as {
            current_lat?: number;
            current_lng?: number;
            last_location_update?: string;
          };

          if (typeof newData.current_lat === 'number' && typeof newData.current_lng === 'number') {
            setDriverLocation(prev => {
              // Só atualiza se a posição mudou
              if (prev?.lat === newData.current_lat && prev?.lng === newData.current_lng) {
                return prev;
              }
              return { lat: newData.current_lat!, lng: newData.current_lng! };
            });
          }

          if (newData.last_location_update) {
            setLastUpdate(new Date(newData.last_location_update));
          }
        }
      )
      .subscribe((status) => {
        console.log('[useFreightRealtimeLocation] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[useFreightRealtimeLocation] Successfully subscribed to freight updates');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[useFreightRealtimeLocation] Cleaning up subscription for freight:', freightId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [freightId]);

  // Atualizar secondsAgo periodicamente
  useEffect(() => {
    updateTimeState();
    
    refreshIntervalRef.current = setInterval(updateTimeState, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [updateTimeState]);

  return {
    driverLocation,
    lastUpdate,
    isOnline,
    secondsAgo,
    isLoading,
    error
  };
}
