import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { normalizeServiceType, CANONICAL_SERVICE_TYPES } from '@/lib/service-type-normalization';

/**
 * Hook exclusivo para MOTORISTAS e TRANSPORTADORAS
 * Retorna APENAS fretes (nunca service_requests)
 */
export const useFreightsOnly = (companyId?: string) => {
  const { profile } = useAuth();
  const [freights, setFreights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFreights = useCallback(async () => {
    // Validar role
    if (!profile?.id || !['MOTORISTA', 'TRANSPORTADORA'].includes(profile.role)) {
      console.warn('[useFreightsOnly] Role inválido:', profile?.role);
      setFreights([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (companyId) {
        // Fretes da transportadora
        const { data, error } = await supabase
          .from('freights')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'OPEN')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setFreights(data || []);
      } else {
        // Usar RPC para motoristas independentes
        const { data, error } = await supabase.rpc(
          'get_freights_for_driver',
          { p_driver_id: profile.id }
        );

        if (error) throw error;

        // Normalizar e filtrar apenas tipos de frete válidos (excluir serviços técnicos)
        const validFreights = (data || [])
          .map((f: any) => ({
            ...f,
            service_type: normalizeServiceType(f.service_type)
          }))
          .filter((f: any) => 
            f.service_type && 
            CANONICAL_SERVICE_TYPES.includes(f.service_type)
          );

        setFreights(validFreights);
      }
    } catch (error) {
      console.error('[useFreightsOnly] Error:', error);
      toast.error('Erro ao carregar fretes');
      setFreights([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, companyId]);

  useEffect(() => {
    fetchFreights();
  }, [fetchFreights]);

  return { freights, loading, refetch: fetchFreights };
};
