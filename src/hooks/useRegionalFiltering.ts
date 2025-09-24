import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegionalFilteringParams {
  userType: 'MOTORISTA' | 'PRESTADOR_SERVICOS';
  profileId: string;
}

export const useRegionalFiltering = ({ userType, profileId }: RegionalFilteringParams) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [regionConfig, setRegionConfig] = useState<{
    city: string;
    state: string;
    radius: number;
    hasLocation: boolean;
  } | null>(null);

  // Verificar configuração de região do usuário
  const checkRegionConfig = useCallback(async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('base_city_name, base_state, base_lat, base_lng, service_radius_km')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      const hasLocation = !!(profile.base_lat && profile.base_lng && profile.base_city_name);
      setRegionConfig({
        city: profile.base_city_name || '',
        state: profile.base_state || '',
        radius: profile.service_radius_km || 100,
        hasLocation
      });

      return hasLocation;
    } catch (error) {
      console.error('Error checking region config:', error);
      return false;
    }
  }, [profileId]);

  // Buscar itens filtrados por região
  const loadRegionalItems = useCallback(async () => {
    if (!profileId) return [];

    setLoading(true);
    try {
      let result;

      if (userType === 'MOTORISTA') {
        // Buscar fretes no raio do motorista
        const { data, error } = await supabase
          .rpc('get_freights_in_radius', { 
            driver_profile_id: profileId 
          });
        
        if (error) throw error;
        result = data || [];
      } else {
        // Buscar solicitações de serviços no raio do prestador
        const { data, error } = await supabase
          .rpc('get_service_requests_in_radius', { 
            provider_profile_id: profileId 
          });
        
        if (error) throw error;
        result = data || [];
      }

      setItems(result);
      return result;
    } catch (error) {
      console.error('Error loading regional items:', error);
      toast.error('Erro ao carregar itens regionais');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userType, profileId]);

  // Calcular estatísticas dos itens regionais
  const getRegionalStats = useCallback(() => {
    if (items.length === 0) {
      return {
        total: 0,
        closestDistance: 0,
        averageDistance: 0,
        withinRadius: 0
      };
    }

    const distances = items.map(item => (item.distance_m || 0) / 1000).filter(d => d > 0); // converter metros para km
    const closestDistance = distances.length > 0 ? Math.min(...distances) : 0;
    const averageDistance = distances.length > 0 
      ? distances.reduce((sum, d) => sum + d, 0) / distances.length 
      : 0;
    const withinRadius = items.filter(item => 
      (item.distance_m || 0) <= (regionConfig?.radius || 100) * 1000 // comparar em metros
    ).length;

    return {
      total: items.length,
      closestDistance: Math.round(closestDistance * 10) / 10,
      averageDistance: Math.round(averageDistance * 10) / 10,
      withinRadius
    };
  }, [items, regionConfig?.radius]);

  return {
    loading,
    items,
    regionConfig,
    checkRegionConfig,
    loadRegionalItems,
    getRegionalStats
  };
};