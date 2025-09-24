import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

interface LocationFilteringParams {
  userType: 'MOTORISTA' | 'PRESTADOR_SERVICOS';
}

interface RegionalItem {
  id: string;
  distance_m: number; // Mudado para number para corresponder ao DOUBLE PRECISION do SQL
  [key: string]: any;
}

interface LocationStats {
  total: number;
  withinRadius: number;
  averageDistance: number;
  closestDistance: number;
}

export const useLocationFiltering = ({ userType }: LocationFilteringParams) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RegionalItem[]>([]);
  const { user } = useAuth();

  // Carregar itens filtrados por localização
  const loadLocationFilteredItems = useCallback(async () => {
    if (!user) return [];

    setLoading(true);
    try {
      let result: RegionalItem[] = [];

      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (userType === 'MOTORISTA') {
        // Buscar fretes no raio do motorista usando a função melhorada
        const { data, error } = await supabase
          .rpc('get_freights_in_radius', { 
            driver_profile_id: profile.id 
          });
        
        if (error) throw error;
        result = data || [];
      } else {
        // Buscar solicitações de serviços no raio do prestador usando a função melhorada
        const { data, error } = await supabase
          .rpc('get_service_requests_in_radius', { 
            provider_profile_id: profile.id 
          });
        
        if (error) throw error;
        result = data || [];
      }

      setItems(result);
      return result;
    } catch (error) {
      console.error('Erro ao carregar itens regionais:', error);
      toast.error('Erro ao carregar solicitações próximas');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userType, user]);

  // Calcular estatísticas dos itens regionais
  const getLocationStats = useCallback((): LocationStats => {
    if (items.length === 0) {
      return {
        total: 0,
        withinRadius: 0,
        averageDistance: 0,
        closestDistance: 0
      };
    }

    const distances = items
      .map(item => item.distance_m || 0)
      .filter(d => d > 0);

    const closestDistance = distances.length > 0 ? Math.min(...distances) / 1000 : 0; // converter para km
    const averageDistance = distances.length > 0 
      ? distances.reduce((sum, d) => sum + d, 0) / distances.length / 1000 // converter para km
      : 0;

    // Considerar "dentro do raio" se distância for menor que 100km por padrão
    const withinRadius = items.filter(item => 
      (item.distance_m || 0) <= 100000 // 100km em metros
    ).length;

    return {
      total: items.length,
      withinRadius,
      averageDistance: Math.round(averageDistance * 10) / 10,
      closestDistance: Math.round(closestDistance * 10) / 10
    };
  }, [items]);

  // Filtrar itens por distância máxima
  const filterByMaxDistance = useCallback((maxDistanceKm: number) => {
    return items.filter(item => 
      (item.distance_m || 0) <= maxDistanceKm * 1000
    );
  }, [items]);

  // Obter configuração de região do usuário
  const getUserLocationConfig = useCallback(async () => {
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('base_city_name, base_state, base_lat, base_lng, service_radius_km')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        city: profile.base_city_name || '',
        state: profile.base_state || '',
        lat: profile.base_lat,
        lng: profile.base_lng,
        radius: profile.service_radius_km || 50,
        hasLocation: !!(profile.base_lat && profile.base_lng && profile.base_city_name)
      };
    } catch (error) {
      console.error('Erro ao obter configuração de localização:', error);
      return null;
    }
  }, [user]);

  // Auto-carregar quando o hook é inicializado
  useEffect(() => {
    if (user) {
      loadLocationFilteredItems();
    }
  }, [user, loadLocationFilteredItems]);

  return {
    loading,
    items,
    stats: getLocationStats(),
    loadLocationFilteredItems,
    filterByMaxDistance,
    getUserLocationConfig
  };
};