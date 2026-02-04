import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook exclusivo para PRESTADORES DE SERVIÇO
 * Retorna APENAS service_requests (nunca freights)
 * 
 * IMPORTANTE: A RPC get_services_for_provider já faz toda a filtragem
 * por tipo de serviço, localização e status. NÃO filtrar novamente no frontend!
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
      // Usar RPC exclusiva - ela já filtra por:
      // 1. Tipos de serviço do prestador
      // 2. Cidade/raio do prestador
      // 3. Status OPEN e sem provider_id
      // 4. Compatibilidade com tipos genéricos (SERVICO_AGRICOLA, etc.)
      const { data, error } = await supabase.rpc(
        'get_services_for_provider',
        { p_provider_id: profile.id }
      );

      if (error) throw error;

      // ✅ CONFIAR NA RPC - não re-filtrar no frontend!
      // A RPC já retorna apenas serviços válidos para este prestador
      setServices(data || []);
      
      if (import.meta.env.DEV && data) {
        console.log('[useServicesOnly] Serviços retornados pela RPC:', data.length);
      }
    } catch (error) {
      // ✅ Falha silenciosa - lista vazia sem assustar o usuário
      console.error('[useServicesOnly] Error:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, profile?.active_mode]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, refetch: fetchServices };
};
