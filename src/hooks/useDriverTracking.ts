import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DriverLocation {
  lat: number | null;
  lng: number | null;
  lastUpdate: string | null;
  isOnline: boolean;
}

export const useDriverTracking = (driverProfileId: string | null, companyId?: string | null) => {
  const [location, setLocation] = useState<DriverLocation>({
    lat: null,
    lng: null,
    lastUpdate: null,
    isOnline: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!driverProfileId) {
      setIsLoading(false);
      return;
    }

    // Fetch initial location from dedicated driver_current_locations table (RLS-optimized)
    const fetchLocation = async () => {
      // First try the dedicated location table (faster, RLS-friendly)
      const { data: locData, error: locError } = await supabase
        .from('driver_current_locations')
        .select('lat, lng, last_gps_update')
        .eq('driver_profile_id', driverProfileId)
        .maybeSingle();

      if (locData && !locError) {
        const isRecent = locData.last_gps_update 
          ? (new Date().getTime() - new Date(locData.last_gps_update).getTime()) < 5 * 60 * 1000
          : false;

        setLocation({
          lat: locData.lat,
          lng: locData.lng,
          lastUpdate: locData.last_gps_update,
          isOnline: isRecent,
        });
        setIsLoading(false);
        return;
      }

      // Fallback: Try affiliated_drivers_tracking for company view
      if (companyId) {
        const { data, error } = await supabase
          .from('affiliated_drivers_tracking')
          .select('current_lat, current_lng, last_gps_update')
          .eq('driver_profile_id', driverProfileId)
          .eq('company_id', companyId)
          .maybeSingle();

        if (data && !error) {
          const isRecent = data.last_gps_update 
            ? (new Date().getTime() - new Date(data.last_gps_update).getTime()) < 5 * 60 * 1000
            : false;

          setLocation({
            lat: data.current_lat,
            lng: data.current_lng,
            lastUpdate: data.last_gps_update,
            isOnline: isRecent,
          });
        }
      }
      setIsLoading(false);
    };

    fetchLocation();

    // Setup realtime subscription on the dedicated table for faster updates
    const channel = supabase
      .channel(`driver-location-${driverProfileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_current_locations',
          filter: `driver_profile_id=eq.${driverProfileId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          if (!newData) return;
          
          const isRecent = newData.last_gps_update 
            ? (new Date().getTime() - new Date(newData.last_gps_update).getTime()) < 5 * 60 * 1000
            : false;

          setLocation({
            lat: newData.lat,
            lng: newData.lng,
            lastUpdate: newData.last_gps_update,
            isOnline: isRecent,
          });
        }
      )
      .subscribe();

    // Polling fallback (every 25s) for when Realtime fails
    pollingIntervalRef.current = setInterval(() => {
      fetchLocation();
    }, 25000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [driverProfileId, companyId]);

  const refreshLocation = async () => {
    if (!driverProfileId) return;

    setIsLoading(true);
    
    // Use the dedicated location table
    const { data: locData, error: locError } = await supabase
      .from('driver_current_locations')
      .select('lat, lng, last_gps_update')
      .eq('driver_profile_id', driverProfileId)
      .maybeSingle();

    if (locData && !locError) {
      const isRecent = locData.last_gps_update 
        ? (new Date().getTime() - new Date(locData.last_gps_update).getTime()) < 5 * 60 * 1000
        : false;

      setLocation({
        lat: locData.lat,
        lng: locData.lng,
        lastUpdate: locData.last_gps_update,
        isOnline: isRecent,
      });
      setIsLoading(false);
      return;
    }
    
    // Fallback for affiliated drivers
    if (companyId) {
      const { data, error } = await supabase
        .from('affiliated_drivers_tracking')
        .select('current_lat, current_lng, last_gps_update')
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (data && !error) {
        const isRecent = data.last_gps_update 
          ? (new Date().getTime() - new Date(data.last_gps_update).getTime()) < 5 * 60 * 1000
          : false;

        setLocation({
          lat: data.current_lat,
          lng: data.current_lng,
          lastUpdate: data.last_gps_update,
          isOnline: isRecent,
        });
      }
    }
    setIsLoading(false);
  };

  return {
    currentLocation: location,
    isLoading,
    refreshLocation,
  };
};
