import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { canProviderHandleService } from '@/lib/service-types';

/**
 * Hook exclusivo para PRESTADORES DE SERVIÇO
 * Retorna APENAS service_requests (nunca freights)
 */
export const useServicesOnly = () => {
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    // Validar role - usar active_mode ao invés de role
    const activeMode = profile?.active_mode || profile?.role;
    if (!profile?.id || activeMode !== 'PRESTADOR_SERVICOS') {
      if (import.meta.env.DEV) {
        console.warn('[useServicesOnly] Role/mode inválido:', activeMode);
      }
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Usar RPC exclusiva
      const { data, error } = await supabase.rpc(
        'get_services_for_provider',
        { p_provider_id: profile.id }
      );

      if (error) throw error;

      // Obter tipos de serviço do prestador
      const providerServiceTypes: string[] = profile?.service_types || [];

      // Matching estrito: service_type precisa bater exatamente
      const validServices = (data || []).filter((s: any) => {
        if (!s.service_type) return false;
        
        // Se prestador não configurou tipos, mostrar todos os serviços
        if (providerServiceTypes.length === 0) return true;
        
        // service_type exato
        return canProviderHandleService(providerServiceTypes, s.service_type);
      });

      setServices(validServices);
    } catch (error) {
      // ✅ Falha silenciosa - lista vazia sem assustar o usuário
      console.error('[useServicesOnly] Error:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, profile?.service_types]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, refetch: fetchServices };
};
