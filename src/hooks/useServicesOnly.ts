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
    // Validar role
    if (!profile?.id || profile.role !== 'PRESTADOR_SERVICOS') {
      console.warn('[useServicesOnly] Role inválido:', profile?.role);
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

      // Filtro de segurança: garantir que são apenas serviços (LAVAGEM foi removido - não é um tipo válido)
      const validServices = (data || []).filter((s: any) => 
        s.service_type && 
        ['GUINCHO', 'MUDANCA', 'ELETRICISTA', 'MECANICO', 'BORRACHEIRO', 'INSTALACAO'].includes(s.service_type)
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
