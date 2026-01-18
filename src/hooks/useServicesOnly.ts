import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

      // Filtro de segurança: garantir que são apenas serviços técnicos + FRETE_MOTO (que também pode vir de service_requests)
      const validServices = (data || []).filter((s: any) => 
        s.service_type && 
        ['GUINCHO', 'MUDANCA', 'ELETRICISTA', 'MECANICO', 'BORRACHEIRO', 'INSTALACAO', 'FRETE_MOTO'].includes(s.service_type)
      );

      setServices(validServices);
    } catch (error) {
      console.error('[useServicesOnly] Error:', error);
      toast.error('Erro ao carregar serviços');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, refetch: fetchServices };
};
