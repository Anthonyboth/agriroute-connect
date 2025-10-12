import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserCityType = Database['public']['Enums']['user_city_type'];

interface UserCity {
  id: string;
  city_id: string;
  type: UserCityType;
  radius_km: number;
  is_active: boolean;
  city_name?: string;
  city_state?: string;
}

export function useUserCities() {
  const [cities, setCities] = useState<UserCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCities([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('user_cities')
        .select(`
          id,
          city_id,
          type,
          radius_km,
          is_active,
          cities (
            id,
            name,
            state,
            lat,
            lng
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const formattedCities = data.map((uc: any) => ({
        id: uc.id,
        city_id: uc.city_id,
        type: uc.type,
        radius_km: uc.radius_km,
        is_active: uc.is_active,
        city_name: uc.cities?.name,
        city_state: uc.cities?.state
      }));

      setCities(formattedCities);
    } catch (err: any) {
      console.error('Erro ao carregar cidades:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  return {
    cities,
    loading,
    error,
    refetch: fetchCities
  };
}
