/**
 * src/hooks/useMultiDriverLocations.ts
 * 
 * Hook para rastrear localização em tempo real de MÚLTIPLOS motoristas
 * em fretes multi-carreta. Cada motorista tem seu próprio status e posição.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDriverOnline, getSecondsSinceUpdate } from '@/lib/maplibre-utils';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

export interface DriverLocationData {
  driverId: string;
  driverName: string;
  avatarUrl?: string;
  lat: number | null;
  lng: number | null;
  lastUpdate: Date | null;
  isOnline: boolean;
  secondsAgo: number;
  /** Status individual da atribuição do motorista (ACCEPTED, LOADING, etc) */
  assignmentStatus: string;
  /** Veículo do motorista */
  vehicleType?: string;
  vehiclePlate?: string;
}

interface UseMultiDriverLocationsResult {
  drivers: DriverLocationData[];
  isLoading: boolean;
  error: string | null;
  /** Atualizar manualmente */
  refetch: () => Promise<void>;
}

const OFFLINE_THRESHOLD_MS = 120000; // 2 minutos
const REFRESH_INTERVAL_MS = 10000; // Atualizar a cada 10s

export function useMultiDriverLocations(freightId: string | null): UseMultiDriverLocationsResult {
  const [drivers, setDrivers] = useState<DriverLocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Buscar dados de todos os motoristas
  const fetchDrivers = useCallback(async () => {
    if (!freightId) {
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Buscar todas as atribuições ativas do frete
      const { data: assignments, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select(`
          driver_id,
          status,
          company_id
        `)
        .eq('freight_id', freightId)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION']);

      if (assignmentsError) {
        console.error('[useMultiDriverLocations] Assignments error:', assignmentsError);
        throw assignmentsError;
      }

      if (!assignments || assignments.length === 0) {
        console.log('[useMultiDriverLocations] No active assignments for freight:', freightId);
        setDrivers([]);
        return;
      }

      const driverIds = assignments.map(a => a.driver_id).filter(Boolean);
      console.log('[useMultiDriverLocations] Found', driverIds.length, 'assigned drivers');

      // 2. Buscar perfis dos motoristas (via view segura)
      const { data: profiles } = await supabase
        .from('profiles_secure')
        .select('id, full_name, profile_photo_url')
        .in('id', driverIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // 3. Buscar localizações atuais
      const { data: locations } = await supabase
        .from('driver_current_locations')
        .select('driver_profile_id, lat, lng, last_gps_update')
        .in('driver_profile_id', driverIds);

      const locationsMap = new Map(locations?.map(l => [l.driver_profile_id, l]) || []);

      // 4. Buscar veículos dos motoristas
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('driver_id, vehicle_type, license_plate')
        .in('driver_id', driverIds)
        .eq('status', 'ATIVO');

      const vehiclesMap = new Map<string, { vehicle_type: string; license_plate: string }>();
      vehicles?.forEach(v => {
        if (v.driver_id && !vehiclesMap.has(v.driver_id)) {
          vehiclesMap.set(v.driver_id, { vehicle_type: v.vehicle_type, license_plate: v.license_plate });
        }
      });

      // 5. Montar dados consolidados
      const driversData: DriverLocationData[] = assignments.map(assignment => {
        const profile = profilesMap.get(assignment.driver_id);
        const location = locationsMap.get(assignment.driver_id);
        const vehicle = vehiclesMap.get(assignment.driver_id);

        const lastUpdate = location?.last_gps_update ? new Date(location.last_gps_update) : null;
        const secondsAgo = lastUpdate ? getSecondsSinceUpdate(lastUpdate) : Infinity;
        const isOnline = lastUpdate ? isDriverOnline(lastUpdate, OFFLINE_THRESHOLD_MS) : false;

        // Normalizar coordenadas
        let lat: number | null = null;
        let lng: number | null = null;
        
        if (location?.lat && location?.lng) {
          const normalized = normalizeLatLngPoint({ lat: location.lat, lng: location.lng }, 'BR');
          if (normalized) {
            lat = normalized.lat;
            lng = normalized.lng;
          }
        }

        return {
          driverId: assignment.driver_id,
          driverName: profile?.full_name || 'Motorista',
          avatarUrl: profile?.profile_photo_url || undefined,
          lat,
          lng,
          lastUpdate,
          isOnline,
          secondsAgo,
          assignmentStatus: assignment.status || 'ACCEPTED',
          vehicleType: vehicle?.vehicle_type,
          vehiclePlate: vehicle?.license_plate,
        };
      });

      console.log('[useMultiDriverLocations] Loaded', driversData.length, 'drivers with locations');
      setDrivers(driversData);

    } catch (err: any) {
      console.error('[useMultiDriverLocations] Error:', err);
      setError(err.message || 'Erro ao carregar motoristas');
    } finally {
      setIsLoading(false);
    }
  }, [freightId]);

  // Fetch inicial
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Subscription realtime para assignments
  useEffect(() => {
    if (!freightId) return;

    // Cleanup
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`multi-driver-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `freight_id=eq.${freightId}`
        },
        () => {
          console.log('[useMultiDriverLocations] Assignment changed, refetching...');
          fetchDrivers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_current_locations'
        },
        (payload) => {
          // Atualizar localização específica do motorista
          const data = payload.new as any;
          if (data?.driver_profile_id) {
            setDrivers(prev => prev.map(d => {
              if (d.driverId === data.driver_profile_id && data.lat && data.lng) {
                const normalized = normalizeLatLngPoint({ lat: data.lat, lng: data.lng }, 'BR');
                const lastUpdate = data.last_gps_update ? new Date(data.last_gps_update) : d.lastUpdate;
                const secondsAgo = lastUpdate ? getSecondsSinceUpdate(lastUpdate) : Infinity;
                
                return {
                  ...d,
                  lat: normalized?.lat ?? data.lat,
                  lng: normalized?.lng ?? data.lng,
                  lastUpdate,
                  secondsAgo,
                  isOnline: lastUpdate ? isDriverOnline(lastUpdate, OFFLINE_THRESHOLD_MS) : false,
                };
              }
              return d;
            }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [freightId, fetchDrivers]);

  // Atualizar secondsAgo periodicamente
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.lastUpdate) {
          const secondsAgo = getSecondsSinceUpdate(d.lastUpdate);
          const isOnline = isDriverOnline(d.lastUpdate, OFFLINE_THRESHOLD_MS);
          if (d.secondsAgo !== secondsAgo || d.isOnline !== isOnline) {
            return { ...d, secondsAgo, isOnline };
          }
        }
        return d;
      }));
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    drivers,
    isLoading,
    error,
    refetch: fetchDrivers,
  };
}
