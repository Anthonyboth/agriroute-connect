/**
 * src/hooks/useFreightEffectiveStatus.ts
 * 
 * Hook para buscar o status efetivo de um frete, considerando:
 * - Fretes de carreta única: usa status do frete
 * - Fretes multi-carreta: usa status mais avançado das atribuições
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseFreightEffectiveStatusResult {
  effectiveStatus: string;
  freightStatus: string;
  assignmentStatuses: string[];
  isMultiTruck: boolean;
  isLoading: boolean;
}

// Ordem de prioridade dos status (do mais avançado para o menos)
const STATUS_PRIORITY: Record<string, number> = {
  'DELIVERED': 7,
  'COMPLETED': 7,
  'DELIVERED_PENDING_CONFIRMATION': 6,
  'IN_TRANSIT': 5,
  'LOADED': 4,
  'LOADING': 3,
  'ACCEPTED': 2,
  'OPEN': 1,
  'CANCELLED': 0,
};

export function useFreightEffectiveStatus(freightId: string | null): UseFreightEffectiveStatusResult {
  const [effectiveStatus, setEffectiveStatus] = useState<string>('OPEN');
  const [freightStatus, setFreightStatus] = useState<string>('OPEN');
  const [assignmentStatuses, setAssignmentStatuses] = useState<string[]>([]);
  const [isMultiTruck, setIsMultiTruck] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!freightId) {
      setIsLoading(false);
      return;
    }

    const fetchEffectiveStatus = async () => {
      try {
        setIsLoading(true);

        // Buscar dados do frete
        const { data: freight, error: freightError } = await supabase
          .from('freights')
          .select('status, required_trucks, driver_id')
          .eq('id', freightId)
          .single();

        if (freightError) {
          console.error('[useFreightEffectiveStatus] Error fetching freight:', freightError);
          return;
        }

        setFreightStatus(freight.status);
        const multiTruck = (freight.required_trucks ?? 1) > 1 && !freight.driver_id;
        setIsMultiTruck(multiTruck);

        // Para fretes multi-carreta, buscar status das atribuições
        if (multiTruck) {
          const { data: assignments } = await supabase
            .from('freight_assignments')
            .select('status')
            .eq('freight_id', freightId)
            .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION']);

          const statuses = assignments?.map(a => a.status).filter(Boolean) || [];
          setAssignmentStatuses(statuses);

          // Encontrar o status mais avançado
          if (statuses.length > 0) {
            const mostAdvanced = statuses.reduce((max, current) => {
              return (STATUS_PRIORITY[current] || 0) > (STATUS_PRIORITY[max] || 0) ? current : max;
            }, statuses[0]);

            setEffectiveStatus(mostAdvanced);
            if (import.meta.env.DEV) console.log('[useFreightEffectiveStatus] Multi-truck freight:', {
              freightStatus: freight.status,
              assignmentStatuses: statuses,
              effectiveStatus: mostAdvanced
            });
          } else {
            setEffectiveStatus(freight.status);
          }
        } else {
          // Frete de carreta única - usar status do frete diretamente
          setEffectiveStatus(freight.status);
        }

      } catch (err) {
        console.error('[useFreightEffectiveStatus] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEffectiveStatus();

    // Subscription para mudanças no frete
    const freightChannel = supabase
      .channel(`freight-effective-status-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'freights',
          filter: `id=eq.${freightId}`
        },
        () => {
          fetchEffectiveStatus();
        }
      )
      .subscribe();

    // Subscription para mudanças nas atribuições
    const assignmentChannel = supabase
      .channel(`assignment-effective-status-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `freight_id=eq.${freightId}`
        },
        () => {
          fetchEffectiveStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(freightChannel);
      supabase.removeChannel(assignmentChannel);
    };
  }, [freightId]);

  return {
    effectiveStatus,
    freightStatus,
    assignmentStatuses,
    isMultiTruck,
    isLoading,
  };
}
