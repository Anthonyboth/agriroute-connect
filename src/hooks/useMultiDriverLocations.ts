/**
 * src/hooks/useMultiDriverLocations.ts
 * Hook para rastrear localização em tempo real de MÚLTIPLOS motoristas
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDriverOnline, getSecondsSinceUpdate } from '@/lib/maplibre-utils';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';
import { toFiniteNumber } from '@/lib/geo/toFiniteNumber';
import { isDriverStillActive } from '@/lib/driver-effective-status';
import { devLog } from '@/lib/devLogger';

export interface DriverLocationData {
  driverId: string;
  driverName: string;
  avatarUrl?: string;
  lat: number | null;
  lng: number | null;
  lastUpdate: Date | null;
  isOnline: boolean;
  secondsAgo: number;
  assignmentStatus: string;
  vehicleType?: string;
  vehiclePlate?: string;
}

interface UseMultiDriverLocationsResult {
  drivers: DriverLocationData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const OFFLINE_THRESHOLD_MS = 120000;
const REFRESH_INTERVAL_MS = 10000;

export function useMultiDriverLocations(freightId: string | null): UseMultiDriverLocationsResult {
  const [drivers, setDrivers] = useState<DriverLocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDrivers = useCallback(async () => {
    if (!freightId) { setDrivers([]); setIsLoading(false); return; }
    try {
      setIsLoading(true); setError(null);
      const { data: assignments, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select(`driver_id, status, company_id`)
        .eq('freight_id', freightId)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION']);
      if (assignmentsError) { console.error('[useMultiDriverLocations] Assignments error:', assignmentsError); throw assignmentsError; }
      if (!assignments || assignments.length === 0) {
        devLog('[useMultiDriverLocations] No active assignments for freight:', freightId);
        setDrivers([]); return;
      }
      const driverIds = assignments.map(a => a.driver_id).filter(Boolean);
      const tripProgressMap = new Map<string, string>();
      if (driverIds.length > 0) {
        const { data: tripProgressData } = await supabase.from('driver_trip_progress').select('driver_id, current_status').eq('freight_id', freightId).in('driver_id', driverIds);
        (tripProgressData || []).forEach(tp => { tripProgressMap.set(tp.driver_id, tp.current_status); });
      }
      const activeAssignments = assignments.filter(a => {
        const tripStatus = tripProgressMap.get(a.driver_id);
        return isDriverStillActive(a.status, tripStatus);
      });
      const activeDriverIds = activeAssignments.map(a => a.driver_id).filter(Boolean);
      devLog('[useMultiDriverLocations] Found', activeDriverIds.length, 'active drivers (filtered from', driverIds.length, 'total)');
      if (activeDriverIds.length === 0) {
        devLog('[useMultiDriverLocations] All drivers have delivered/completed');
        setDrivers([]); return;
      }
      const { data: profiles } = await supabase.from('profiles_secure').select('id, full_name, profile_photo_url').in('id', activeDriverIds);
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const { data: locations } = await supabase.from('driver_current_locations').select('driver_profile_id, lat, lng, last_gps_update').in('driver_profile_id', activeDriverIds);
      const locationsMap = new Map(locations?.map(l => [l.driver_profile_id, l]) || []);
      const { data: vehicles } = await supabase.from('vehicles').select('driver_id, vehicle_type, license_plate').in('driver_id', activeDriverIds).eq('status', 'ATIVO');
      const vehiclesMap = new Map<string, { vehicle_type: string; license_plate: string }>();
      vehicles?.forEach(v => { if (v.driver_id && !vehiclesMap.has(v.driver_id)) { vehiclesMap.set(v.driver_id, { vehicle_type: v.vehicle_type, license_plate: v.license_plate }); } });
      const driversData: DriverLocationData[] = activeAssignments.map(assignment => {
        const profile = profilesMap.get(assignment.driver_id);
        const location = locationsMap.get(assignment.driver_id);
        const vehicle = vehiclesMap.get(assignment.driver_id);
        const lastUpdate = location?.last_gps_update ? new Date(location.last_gps_update) : null;
        const secondsAgo = lastUpdate ? getSecondsSinceUpdate(lastUpdate) : Infinity;
        const isOnline = lastUpdate ? isDriverOnline(lastUpdate, OFFLINE_THRESHOLD_MS) : false;
        let lat: number | null = null; let lng: number | null = null;
        const latNum = toFiniteNumber((location as any)?.lat);
        const lngNum = toFiniteNumber((location as any)?.lng);
        if (latNum !== null && lngNum !== null) {
          const normalized = normalizeLatLngPoint({ lat: latNum, lng: lngNum }, 'BR');
          lat = normalized?.lat ?? latNum; lng = normalized?.lng ?? lngNum;
        }
        return { driverId: assignment.driver_id, driverName: profile?.full_name || 'Motorista', avatarUrl: profile?.profile_photo_url || undefined, lat, lng, lastUpdate, isOnline, secondsAgo, assignmentStatus: assignment.status || 'ACCEPTED', vehicleType: vehicle?.vehicle_type, vehiclePlate: vehicle?.license_plate };
      });
      devLog('[useMultiDriverLocations] Loaded', driversData.length, 'drivers with locations');
      setDrivers(driversData);
    } catch (err: any) {
      console.error('[useMultiDriverLocations] Error:', err);
      setError(err.message || 'Erro ao carregar motoristas');
    } finally {
      setIsLoading(false);
    }
  }, [freightId]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  useEffect(() => {
    if (!freightId) return;
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    const channel = supabase.channel(`multi-driver-${freightId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_assignments', filter: `freight_id=eq.${freightId}` },
        () => { devLog('[useMultiDriverLocations] Assignment changed, refetching...'); fetchDrivers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_current_locations' },
        (payload) => {
          const data = payload.new as any;
          if (data?.driver_profile_id) {
            setDrivers(prev => prev.map(d => {
              if (d.driverId === data.driver_profile_id) {
                const latNum = toFiniteNumber(data.lat); const lngNum = toFiniteNumber(data.lng);
                if (latNum === null || lngNum === null) return d;
                const normalized = normalizeLatLngPoint({ lat: latNum, lng: lngNum }, 'BR');
                const lastUpdate = data.last_gps_update ? new Date(data.last_gps_update) : d.lastUpdate;
                const secondsAgo = lastUpdate ? getSecondsSinceUpdate(lastUpdate) : Infinity;
                return { ...d, lat: normalized?.lat ?? latNum, lng: normalized?.lng ?? lngNum, lastUpdate, secondsAgo, isOnline: lastUpdate ? isDriverOnline(lastUpdate, OFFLINE_THRESHOLD_MS) : false };
              }
              return d;
            }));
          }
        })
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [freightId, fetchDrivers]);

  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.lastUpdate) {
          const secondsAgo = getSecondsSinceUpdate(d.lastUpdate);
          const isOnline = isDriverOnline(d.lastUpdate, OFFLINE_THRESHOLD_MS);
          if (d.secondsAgo !== secondsAgo || d.isOnline !== isOnline) return { ...d, secondsAgo, isOnline };
        }
        return d;
      }));
    }, REFRESH_INTERVAL_MS);
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, []);

  return { drivers, isLoading, error, refetch: fetchDrivers };
}
