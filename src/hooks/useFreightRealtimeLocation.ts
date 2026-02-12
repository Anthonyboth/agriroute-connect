/**
 * src/hooks/useFreightRealtimeLocation.ts
 * 
 * Hook para subscription realtime da localização do motorista.
 * Gerencia estado de conexão, cálculo de online/offline e cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDriverOnline, getSecondsSinceUpdate } from '@/lib/maplibre-utils';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';
import { isDriverStillActive } from '@/lib/driver-effective-status';

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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
  // ✅ Driver efetivamente acompanhado no realtime (evita assinar o motorista “errado” em multi-carreta)
  const [subscribedDriverId, setSubscribedDriverId] = useState<string | null>(null);
  
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
          .select('current_lat, current_lng, last_location_update, driver_id, drivers_assigned, status, required_trucks')
          .eq('id', freightId)
          .single();

        if (fetchError) {
          console.log('[useFreightRealtimeLocation] Not found in freights, trying service_requests...');
          
          // ✅ Fallback: Pode ser um service_request (PET, Pacotes, Guincho, etc.)
          const { data: srData, error: srError } = await supabase
            .from('service_requests')
            .select('provider_id, location_lat, location_lng, status')
            .eq('id', freightId)
            .single();

          if (srError || !srData) {
            console.error('[useFreightRealtimeLocation] Not found in service_requests either:', srError);
            setError('Erro ao buscar localização');
            return;
          }

          // Se temos um provider, buscar localização atual dele
          if (srData.provider_id) {
            const { data: providerLoc } = await supabase
              .from('driver_current_locations')
              .select('lat, lng, last_gps_update, driver_profile_id')
              .eq('driver_profile_id', srData.provider_id)
              .single();

            if (providerLoc?.lat && providerLoc?.lng) {
              const normalized = normalizeLatLngPoint({ lat: providerLoc.lat, lng: providerLoc.lng }, 'BR');
              setDriverLocation(normalized ?? { lat: providerLoc.lat, lng: providerLoc.lng });
              if (providerLoc.last_gps_update) {
                setLastUpdate(new Date(providerLoc.last_gps_update));
              }
              setSubscribedDriverId(srData.provider_id);
              setAssignedDriverIds([srData.provider_id]);
              console.log('[useFreightRealtimeLocation] ✅ Using service_request provider location:', {
                lat: providerLoc.lat, lng: providerLoc.lng, provider: srData.provider_id?.substring(0,8)
              });
              return;
            }
          }

          // Fallback: usar coordenadas da solicitação
          if (srData.location_lat && srData.location_lng) {
            const normalized = normalizeLatLngPoint({ lat: srData.location_lat, lng: srData.location_lng }, 'BR');
            setDriverLocation(normalized ?? { lat: srData.location_lat, lng: srData.location_lng });
          }
          return;
        }

        // ✅ CORREÇÃO CRÍTICA v2: Para QUALQUER frete, SEMPRE tentar buscar de assignments primeiro
        // Isso garante que fretes multi-carreta (OPEN com assignments) funcionem corretamente
        console.log('[useFreightRealtimeLocation] Fetching driver assignments for freight:', freightId);
        
        // 1) Buscar motoristas atribuídos ao frete (SEMPRE, independente do status do frete)
        const { data: assignments } = await supabase
          .from('freight_assignments')
          .select('driver_id, status')
          .eq('freight_id', freightId)
          // ✅ Inclui DELIVERED_PENDING_CONFIRMATION (ainda é “em andamento” e precisa manter tracking)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'])
          .limit(10);

        const assignedDriverIds = assignments?.map(a => a.driver_id).filter(Boolean) || [];
        const assignmentStatusMap = new Map(
          (assignments || []).map(a => [a.driver_id, a.status])
        );
        
        // Adicionar driver_id principal e drivers_assigned se existirem
        if (data?.driver_id) assignedDriverIds.push(data.driver_id);
        if (Array.isArray(data?.drivers_assigned)) {
          assignedDriverIds.push(...data.drivers_assigned);
        }
        
        // Remover duplicatas
        let uniqueDriverIds = [...new Set(assignedDriverIds)];

        // ✅ CORREÇÃO: Cross-reference com driver_trip_progress para excluir motoristas que já entregaram
        if (uniqueDriverIds.length > 0) {
          const { data: tripProgressData } = await supabase
            .from('driver_trip_progress')
            .select('driver_id, current_status')
            .eq('freight_id', freightId)
            .in('driver_id', uniqueDriverIds);

          if (tripProgressData && tripProgressData.length > 0) {
            const tripMap = new Map(tripProgressData.map(tp => [tp.driver_id, tp.current_status]));
            uniqueDriverIds = uniqueDriverIds.filter(id => {
              const tripStatus = tripMap.get(id);
              const assignStatus = assignmentStatusMap.get(id);
              return isDriverStillActive(assignStatus, tripStatus);
            });
          }
        }
        
        // ✅ Salvar IDs para subscription realtime
        setAssignedDriverIds(uniqueDriverIds);
        // fallback inicial: se não acharmos um driver “mais recente”, assina o primeiro
        setSubscribedDriverId(uniqueDriverIds[0] ?? null);
        
        console.log('[useFreightRealtimeLocation] Found drivers:', uniqueDriverIds, 'Assignments:', assignments?.map(a => ({ driver: a.driver_id?.substring(0,8), status: a.status })));
        
        if (uniqueDriverIds.length > 0) {
          // 2) Buscar localização atual dos motoristas em driver_current_locations
          const { data: currentLocations, error: locError } = await supabase
            .from('driver_current_locations')
            .select('lat, lng, last_gps_update, driver_profile_id')
            .in('driver_profile_id', uniqueDriverIds)
            .order('last_gps_update', { ascending: false })
            .limit(1);

          console.log('[useFreightRealtimeLocation] Current locations query result:', { 
            count: currentLocations?.length,
            error: locError?.message,
            data: currentLocations?.[0]
          });

          if (!locError && currentLocations && currentLocations.length > 0) {
            const loc = currentLocations[0];
            const latNum = toFiniteNumber((loc as any).lat);
            const lngNum = toFiniteNumber((loc as any).lng);
            if (latNum !== null && lngNum !== null) {
              // ✅ Normalizar coordenadas para evitar markers em posições incorretas
              const normalized = normalizeLatLngPoint({ lat: latNum, lng: lngNum }, 'BR');
              if (normalized) {
                setDriverLocation(normalized);
              } else {
                setDriverLocation({ lat: latNum, lng: lngNum });
              }
              
              if (loc.last_gps_update) {
                setLastUpdate(new Date(loc.last_gps_update));
              }

              // ✅ Assinar realtime do driver que realmente tem o update mais recente
              if (loc.driver_profile_id) {
                setSubscribedDriverId(loc.driver_profile_id);
              }

              console.log('[useFreightRealtimeLocation] ✅ Using driver_current_locations:', {
                lat: normalized?.lat ?? latNum,
                lng: normalized?.lng ?? lngNum,
                driverId: loc.driver_profile_id?.substring(0,8),
                lastUpdate: loc.last_gps_update
              });
              return;
            }
          }
          
          // 3) Fallback: driver_location_history
          const primaryDriverId = data?.driver_id || uniqueDriverIds[0];
          if (primaryDriverId) {
            const { data: locationHistory } = await supabase
              .from('driver_location_history')
              .select('lat, lng, captured_at')
              .eq('driver_profile_id', primaryDriverId)
              .eq('freight_id', freightId)
              .order('captured_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (locationHistory?.lat && locationHistory?.lng) {
              // ✅ Normalizar coordenadas
              const normalized = normalizeLatLngPoint({ 
                lat: locationHistory.lat, 
                lng: locationHistory.lng 
              }, 'BR');
              setDriverLocation(normalized ?? { 
                lat: locationHistory.lat, 
                lng: locationHistory.lng 
              });
              if (locationHistory.captured_at) {
                setLastUpdate(new Date(locationHistory.captured_at));
              }
              console.log('[useFreightRealtimeLocation] Using driver_location_history fallback:', {
                lat: normalized?.lat ?? locationHistory.lat,
                lng: normalized?.lng ?? locationHistory.lng
              });
              return;
            }
          }
        }

        // Fallback final: usar dados do frete se disponíveis
        if (data?.current_lat && data?.current_lng) {
          // ✅ Normalizar coordenadas
          const normalized = normalizeLatLngPoint({ lat: data.current_lat, lng: data.current_lng }, 'BR');
          setDriverLocation(normalized ?? { lat: data.current_lat, lng: data.current_lng });
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
            current_lat?: number | string;
            current_lng?: number | string;
            last_location_update?: string;
          };

          const latNum = toFiniteNumber(newData.current_lat);
          const lngNum = toFiniteNumber(newData.current_lng);
          if (latNum !== null && lngNum !== null) {
            setDriverLocation(prev => {
              // Só atualiza se a posição mudou
              if (prev?.lat === latNum && prev?.lng === lngNum) {
                return prev;
              }
              return { lat: latNum, lng: lngNum };
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
    if (!freightId || !subscribedDriverId) return;

    console.log('[useFreightRealtimeLocation] Setting up driver_current_locations subscription for driver:', subscribedDriverId);

    // Cleanup de canal existente
    if (driverChannelRef.current) {
      supabase.removeChannel(driverChannelRef.current);
      driverChannelRef.current = null;
    }

    const driverChannel = supabase
      .channel(`driver-location-${freightId}-${subscribedDriverId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE
          schema: 'public',
          table: 'driver_current_locations',
          filter: `driver_profile_id=eq.${subscribedDriverId}`
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
            lat?: number | string;
            lng?: number | string;
            last_gps_update?: string;
          };

          const latNum = toFiniteNumber(newData.lat);
          const lngNum = toFiniteNumber(newData.lng);
          if (latNum !== null && lngNum !== null) {
            setDriverLocation(prev => {
              if (prev?.lat === latNum && prev?.lng === lngNum) {
                return prev;
              }
              return { lat: latNum, lng: lngNum };
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
  }, [freightId, subscribedDriverId]);

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
