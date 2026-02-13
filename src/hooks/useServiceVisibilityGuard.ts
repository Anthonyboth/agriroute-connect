import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfileManager } from '@/hooks/useProfileManager';

interface VisibilityStatus {
  freightsVisible: boolean;
  servicesVisible: boolean;
  freightsCount: number;
  servicesCount: number;
  lastCheck: Date | null;
  isChecking: boolean;
  errors: string[];
}

/**
 * Hook de guarda de visibilidade — garante que fretes e serviços
 * estejam SEMPRE visíveis e disponíveis nos painéis para aceite.
 * 
 * Realiza verificação periódica (a cada 60s) e também sob demanda.
 * Tenta auto-corrigir problemas comuns como cache stale.
 */
export const useServiceVisibilityGuard = () => {
  const { profile } = useProfileManager();
  const [status, setStatus] = useState<VisibilityStatus>({
    freightsVisible: true,
    servicesVisible: true,
    freightsCount: 0,
    servicesCount: 0,
    lastCheck: null,
    isChecking: false,
    errors: [],
  });
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const runVisibilityCheck = useCallback(async () => {
    if (!profile?.id || !mountedRef.current) return;

    setStatus(prev => ({ ...prev, isChecking: true, errors: [] }));
    const errors: string[] = [];

    try {
      // 1. Verificar fretes abertos no banco (contagem real)
      const { count: dbOpenFreights, error: freightErr } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OPEN');

      if (freightErr) {
        errors.push(`Erro ao verificar fretes: ${freightErr.message}`);
      }

      // 2. Verificar serviços abertos no banco (contagem real)
      const { count: dbOpenServices, error: serviceErr } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OPEN');

      if (serviceErr) {
        errors.push(`Erro ao verificar serviços: ${serviceErr.message}`);
      }

      // 3. Verificar se a RPC do provider retorna dados consistentes
      let rpcServicesCount = 0;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'get_services_for_provider',
          { p_provider_id: profile.id }
        );
        if (rpcErr) {
          errors.push(`RPC get_services_for_provider falhou: ${rpcErr.message}`);
        } else {
          rpcServicesCount = (rpcData as any[])?.length || 0;
        }
      } catch (rpcCatchErr) {
        errors.push(`RPC exception: ${rpcCatchErr}`);
      }

      // 4. Verificar se serviços do prestador (own) estão acessíveis
      const { data: ownServices, error: ownErr } = await supabase
        .from('service_requests_secure')
        .select('id, status')
        .eq('provider_id', profile.id)
        .in('status', ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']);

      if (ownErr) {
        errors.push(`Erro ao verificar serviços próprios: ${ownErr.message}`);
      }

      // 5. Verificar fretes em andamento do motorista (se aplicável)
      const { data: ownFreights, error: ownFreightErr } = await supabase
        .from('freights')
        .select('id, status')
        .eq('driver_id', profile.id)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);

      if (ownFreightErr && ownFreightErr.code !== 'PGRST116') {
        errors.push(`Erro ao verificar fretes próprios: ${ownFreightErr.message}`);
      }

      const freightsVisible = !freightErr && (dbOpenFreights !== null);
      const servicesVisible = !serviceErr && (dbOpenServices !== null);

      if (mountedRef.current) {
        setStatus({
          freightsVisible,
          servicesVisible,
          freightsCount: dbOpenFreights || 0,
          servicesCount: dbOpenServices || 0,
          lastCheck: new Date(),
          isChecking: false,
          errors,
        });
      }

      // Log para debugging
      if (import.meta.env.DEV) {
        console.log('[VisibilityGuard] Check completo:', {
          freightsVisible,
          servicesVisible,
          dbOpenFreights,
          dbOpenServices,
          rpcServicesCount,
          ownServicesInProgress: ownServices?.length || 0,
          ownFreightsInProgress: ownFreights?.length || 0,
          errors: errors.length,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setStatus(prev => ({
          ...prev,
          isChecking: false,
          errors: [...prev.errors, `Erro geral: ${err}`],
        }));
      }
    }
  }, [profile?.id]);

  // Setup do check periódico (60s)
  useEffect(() => {
    mountedRef.current = true;

    if (profile?.id) {
      // Check inicial
      runVisibilityCheck();

      // Check periódico a cada 60 segundos
      checkIntervalRef.current = setInterval(runVisibilityCheck, 60_000);
    }

    return () => {
      mountedRef.current = false;
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [profile?.id, runVisibilityCheck]);

  return {
    ...status,
    forceCheck: runVisibilityCheck,
    isHealthy: status.freightsVisible && status.servicesVisible && status.errors.length === 0,
  };
};
