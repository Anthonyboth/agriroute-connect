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

    // Fetch initial location
    const fetchLocation = async () => {
      if (companyId) {
        // Use affiliated_drivers_tracking for company view
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
      } else {
        // Use profiles for direct driver view
        const { data, error } = await supabase
          .from('profiles')
          .select('current_location_lat, current_location_lng, last_gps_update')
          .eq('id', driverProfileId)
          .maybeSingle();

        if (data && !error) {
          const isRecent = data.last_gps_update 
            ? (new Date().getTime() - new Date(data.last_gps_update).getTime()) < 5 * 60 * 1000
            : false;

          setLocation({
            lat: data.current_location_lat,
            lng: data.current_location_lng,
            lastUpdate: data.last_gps_update,
            isOnline: isRecent,
          });
        }
      }
      setIsLoading(false);
    };

    fetchLocation();

    // Setup realtime subscription (may fail with CHANNEL_ERROR)
    const tableName = companyId ? 'affiliated_drivers_tracking' : 'profiles';
    const channel = supabase
      .channel(`driver-location-${driverProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: companyId 
            ? `driver_profile_id=eq.${driverProfileId}` 
            : `id=eq.${driverProfileId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          const isRecent = newData.last_gps_update 
            ? (new Date().getTime() - new Date(newData.last_gps_update).getTime()) < 5 * 60 * 1000
            : false;

          if (companyId) {
            setLocation({
              lat: newData.current_lat,
              lng: newData.current_lng,
              lastUpdate: newData.last_gps_update,
              isOnline: isRecent,
            });
          } else {
            setLocation({
              lat: newData.current_location_lat,
              lng: newData.current_location_lng,
              lastUpdate: newData.last_gps_update,
              isOnline: isRecent,
            });
          }
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
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('current_location_lat, current_location_lng, last_gps_update')
        .eq('id', driverProfileId)
        .maybeSingle();

      if (data && !error) {
        const isRecent = data.last_gps_update 
          ? (new Date().getTime() - new Date(data.last_gps_update).getTime()) < 5 * 60 * 1000
          : false;

        setLocation({
          lat: data.current_location_lat,
          lng: data.current_location_lng,
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
