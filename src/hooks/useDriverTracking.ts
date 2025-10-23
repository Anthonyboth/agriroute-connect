import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DriverLocation {
  lat: number | null;
  lng: number | null;
  lastUpdate: string | null;
  isOnline: boolean;
}

export const useDriverTracking = (driverProfileId: string | null) => {
  const [location, setLocation] = useState<DriverLocation>({
    lat: null,
    lng: null,
    lastUpdate: null,
    isOnline: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!driverProfileId) {
      setIsLoading(false);
      return;
    }

    // Fetch initial location
    const fetchLocation = async () => {
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
      setIsLoading(false);
    };

    fetchLocation();

    // Setup realtime subscription
    const channel = supabase
      .channel(`driver-location-${driverProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${driverProfileId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          const isRecent = newData.last_gps_update 
            ? (new Date().getTime() - new Date(newData.last_gps_update).getTime()) < 5 * 60 * 1000
            : false;

          setLocation({
            lat: newData.current_location_lat,
            lng: newData.current_location_lng,
            lastUpdate: newData.last_gps_update,
            isOnline: isRecent,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverProfileId]);

  const refreshLocation = async () => {
    if (!driverProfileId) return;

    setIsLoading(true);
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
    setIsLoading(false);
  };

  return {
    currentLocation: location,
    isLoading,
    refreshLocation,
  };
};
