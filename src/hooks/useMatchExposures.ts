import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ExposureItem {
  item_type: 'FREIGHT' | 'SERVICE';
  item_id: string;
  city_id?: string | null;
  distance_km?: number | null;
}

/**
 * Hook para registrar exposições de match (dedupe).
 * 
 * Registra itens exibidos no feed para evitar repetição dentro do TTL.
 * Usa batch para eficiência e debounce para evitar spam.
 */
export function useMatchExposures() {
  const { user } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ExposureItem[]>([]);

  const flushExposures = useCallback(async () => {
    if (!user?.id || pendingRef.current.length === 0) return;

    const items = [...pendingRef.current];
    pendingRef.current = [];

    try {
      const payload = items.map(item => ({
        item_type: item.item_type,
        item_id: item.item_id,
        city_id: item.city_id || null,
        distance_km: item.distance_km || null,
      }));

      await supabase.rpc('register_match_exposures_batch', {
        p_items: payload as any,
        p_ttl_minutes: 10,
      });

      if (import.meta.env.DEV) {
        console.log('[useMatchExposures] Registered', items.length, 'exposures');
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useMatchExposures] Failed to register exposures:', err);
      }
    }
  }, [user?.id]);

  /**
   * Registra itens exibidos no feed com debounce de 2s.
   * Chamado após renderização do feed.
   */
  const registerExposures = useCallback((items: ExposureItem[]) => {
    if (!user?.id || items.length === 0) return;

    pendingRef.current.push(...items);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      flushExposures();
    }, 2000);
  }, [user?.id, flushExposures]);

  /**
   * Limpa exposures expiráveis (botão "Atualizar").
   * Retorna quantidade de exposures limpas.
   */
  const clearExpiredExposures = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;

    try {
      const { data, error } = await supabase.rpc('clear_expired_exposures');
      if (error) throw error;
      return data || 0;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useMatchExposures] Failed to clear exposures:', err);
      }
      return 0;
    }
  }, [user?.id]);

  /**
   * Marca item como ACCEPTED (nunca mais aparece no feed).
   */
  const acceptExposure = useCallback(async (itemType: 'FREIGHT' | 'SERVICE', itemId: string) => {
    if (!user?.id) return;

    try {
      await supabase.rpc('accept_match_exposure', {
        p_item_type: itemType,
        p_item_id: itemId,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useMatchExposures] Failed to accept exposure:', err);
      }
    }
  }, [user?.id]);

  /**
   * Marca item como DISMISSED (some por 24h).
   */
  const dismissExposure = useCallback(async (itemType: 'FREIGHT' | 'SERVICE', itemId: string) => {
    if (!user?.id) return;

    try {
      await supabase.rpc('dismiss_match_exposure', {
        p_item_type: itemType,
        p_item_id: itemId,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useMatchExposures] Failed to dismiss exposure:', err);
      }
    }
  }, [user?.id]);

  return {
    registerExposures,
    clearExpiredExposures,
    acceptExposure,
    dismissExposure,
  };
}
