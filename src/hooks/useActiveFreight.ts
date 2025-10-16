import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ActiveFreightInfo {
  hasActiveFreight: boolean;
  activeFreightId: string | null;
  activeFreightType: 'freight' | 'assignment' | 'service' | null;
  isLoading: boolean;
}

export const useActiveFreight = (): ActiveFreightInfo => {
  const { profile } = useAuth();
  const [info, setInfo] = useState<ActiveFreightInfo>({
    hasActiveFreight: false,
    activeFreightId: null,
    activeFreightType: null,
    isLoading: true
  });

  useEffect(() => {
    if (!profile?.id) {
      setInfo({
        hasActiveFreight: false,
        activeFreightId: null,
        activeFreightType: null,
        isLoading: false
      });
      return;
    }

    const checkActiveFreights = async () => {
      try {
        // Verificar fretes diretos do motorista
        const { data: directFreights } = await supabase
          .from('freights')
          .select('id, status')
          .eq('driver_id', profile.id)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
          .limit(1)
          .maybeSingle();

        if (directFreights) {
          setInfo({
            hasActiveFreight: true,
            activeFreightId: directFreights.id,
            activeFreightType: 'freight',
            isLoading: false
          });
          return;
        }

        // Verificar assignments de transportadora
        const { data: assignments } = await supabase
          .from('freight_assignments')
          .select('id, freight_id, status')
          .eq('driver_id', profile.id)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
          .limit(1)
          .maybeSingle();

        if (assignments) {
          setInfo({
            hasActiveFreight: true,
            activeFreightId: assignments.freight_id,
            activeFreightType: 'assignment',
            isLoading: false
          });
          return;
        }

        // Verificar serviços urbanos (GUINCHO/MUDANCA)
        const { data: services } = await supabase
          .from('service_requests')
          .select('id, status')
          .eq('provider_id', profile.id)
          .in('status', ['ACCEPTED', 'IN_PROGRESS'])
          .limit(1)
          .maybeSingle();

        if (services) {
          setInfo({
            hasActiveFreight: true,
            activeFreightId: services.id,
            activeFreightType: 'service',
            isLoading: false
          });
          return;
        }

        // Nenhum frete ativo
        setInfo({
          hasActiveFreight: false,
          activeFreightId: null,
          activeFreightType: null,
          isLoading: false
        });

      } catch (error) {
        console.error('Erro ao verificar fretes ativos:', error);
        setInfo({
          hasActiveFreight: false,
          activeFreightId: null,
          activeFreightType: null,
          isLoading: false
        });
      }
    };

    checkActiveFreights();

    // Subscrever a atualizações em tempo real
    const freightsChannel = supabase
      .channel('active-freights-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `driver_id=eq.${profile.id}`
        },
        () => checkActiveFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `driver_id=eq.${profile.id}`
        },
        () => checkActiveFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `provider_id=eq.${profile.id}`
        },
        () => checkActiveFreights()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(freightsChannel);
    };
  }, [profile?.id]);

  return info;
};
