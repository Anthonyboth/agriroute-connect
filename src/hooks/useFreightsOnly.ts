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
    // Validar role - usar active_mode ao invés de role
    const activeMode = profile?.active_mode || profile?.role;
    if (!profile?.id || !['MOTORISTA', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'].includes(activeMode || '')) {
      if (import.meta.env.DEV) {
        console.warn('[useFreightsOnly] Role/mode inválido:', activeMode);
      }
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

        // CORREÇÃO MOTO: Buscar fretes FRETE_MOTO diretamente (RPC pode não retorná-los)
        let motoFreights: any[] = [];
        try {
          const { data: motoData } = await supabase
            .from('freights')
            .select('*')
            .eq('status', 'OPEN')
            .eq('service_type', 'FRETE_MOTO')
            .order('created_at', { ascending: false });
          motoFreights = motoData || [];
        } catch (e) {
          console.warn('[useFreightsOnly] Erro ao buscar fretes MOTO:', e);
        }

        // Combinar resultados da RPC + fretes MOTO, removendo duplicatas
        const allFreights = [...(data || []), ...motoFreights];
        const uniqueMap = new Map(allFreights.map(f => [f.id, f]));
        const uniqueFreights = Array.from(uniqueMap.values());

        // Normalizar e filtrar apenas tipos de frete válidos (excluir serviços técnicos)
        const validFreights = uniqueFreights
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
      // ✅ CORREÇÃO CRÍTICA: NÃO exibir toast automático no login
      // Falha silenciosa - evita "erro falso" quando não há fretes
      console.error('[useFreightsOnly] Error:', error);
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
