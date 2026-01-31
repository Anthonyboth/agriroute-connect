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
  const [assignedDriverIds, setAssignedDriverIds] = useState<string[]>([]);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const driverChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
          .select('current_lat, current_lng, last_location_update, driver_id, drivers_assigned')
          .eq('id', freightId)
          .single();

        if (fetchError) {
          console.error('[useFreightRealtimeLocation] Fetch error:', fetchError);
          setError('Erro ao buscar localização');
          return;
        }

        // ✅ CORREÇÃO CRÍTICA: Para fretes multi-carreta (OPEN com drivers atribuídos),
        // buscar a localização diretamente de driver_current_locations via freight_assignments
        const hasFreightLocation = data?.current_lat && data?.current_lng;
        
        if (!hasFreightLocation) {
          console.log('[useFreightRealtimeLocation] Freight location null, trying driver_current_locations via assignments...');
          
          // 1) Tentar buscar motoristas atribuídos ao frete
          const { data: assignments } = await supabase
            .from('freight_assignments')
            .select('driver_id')
            .eq('freight_id', freightId)
            .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
            .limit(5);

          const assignedDriverIds = assignments?.map(a => a.driver_id).filter(Boolean) || [];
          
          // Adicionar driver_id principal e drivers_assigned se existirem
          if (data?.driver_id) assignedDriverIds.push(data.driver_id);
          if (Array.isArray(data?.drivers_assigned)) {
            assignedDriverIds.push(...data.drivers_assigned);
          }
          
          // Remover duplicatas
          const uniqueDriverIds = [...new Set(assignedDriverIds)];
          
          // ✅ Salvar IDs para subscription realtime
          setAssignedDriverIds(uniqueDriverIds);
          
          if (uniqueDriverIds.length > 0) {
            console.log('[useFreightRealtimeLocation] Fetching location for drivers:', uniqueDriverIds);
            
            // 2) Buscar localização atual dos motoristas em driver_current_locations
            const { data: currentLocations, error: locError } = await supabase
              .from('driver_current_locations')
              .select('lat, lng, last_gps_update, driver_profile_id')
              .in('driver_profile_id', uniqueDriverIds)
              .order('last_gps_update', { ascending: false })
              .limit(1);

            if (!locError && currentLocations && currentLocations.length > 0) {
              const loc = currentLocations[0];
              if (loc.lat && loc.lng) {
                setDriverLocation({ lat: loc.lat, lng: loc.lng });
                if (loc.last_gps_update) {
                  setLastUpdate(new Date(loc.last_gps_update));
                }
                console.log('[useFreightRealtimeLocation] ✅ Using driver_current_locations:', {
                  lat: loc.lat,
                  lng: loc.lng,
                  driverId: loc.driver_profile_id
                });
                return;
              }
            }
            
            // 3) Fallback: driver_location_history (se driver_current_locations não tiver dados)
            if (data?.driver_id) {
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
                console.log('[useFreightRealtimeLocation] Using driver_location_history fallback:', {
                  lat: locationHistory.lat,
                  lng: locationHistory.lng
                });
                return;
              }
            }
          }
        }

        // Usar dados do frete se disponíveis
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

  // ✅ Subscription Realtime para driver_current_locations (fretes multi-carreta)
  useEffect(() => {
    if (!freightId || assignedDriverIds.length === 0) return;

    console.log('[useFreightRealtimeLocation] Setting up driver_current_locations subscription for drivers:', assignedDriverIds);

    // Cleanup de canal existente
    if (driverChannelRef.current) {
      supabase.removeChannel(driverChannelRef.current);
      driverChannelRef.current = null;
    }

    // Criar subscription para cada motorista atribuído (usando o primeiro por simplicidade)
    const primaryDriverId = assignedDriverIds[0];
    
    const driverChannel = supabase
      .channel(`driver-location-${freightId}-${primaryDriverId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE
          schema: 'public',
          table: 'driver_current_locations',
          filter: `driver_profile_id=eq.${primaryDriverId}`
        },
        (payload) => {
          // Debounce
          const now = Date.now();
          if (now - lastUpdateRef.current < 800) {
            return;
          }
          lastUpdateRef.current = now;

          console.log('[useFreightRealtimeLocation] Driver location realtime update:', payload);
          
          const newData = payload.new as {
            lat?: number;
            lng?: number;
            last_gps_update?: string;
          };

          if (typeof newData.lat === 'number' && typeof newData.lng === 'number') {
            setDriverLocation(prev => {
              if (prev?.lat === newData.lat && prev?.lng === newData.lng) {
                return prev;
              }
              return { lat: newData.lat!, lng: newData.lng! };
            });
          }

          if (newData.last_gps_update) {
            setLastUpdate(new Date(newData.last_gps_update));
          }
        }
      )
      .subscribe((status) => {
        console.log('[useFreightRealtimeLocation] Driver location subscription status:', status);
      });

    driverChannelRef.current = driverChannel;

    return () => {
      if (driverChannelRef.current) {
        supabase.removeChannel(driverChannelRef.current);
        driverChannelRef.current = null;
      }
    };
  }, [freightId, assignedDriverIds]);

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
