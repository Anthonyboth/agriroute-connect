/**
 * Hook para ETA inteligente de fretes
 * Calcula estimativa de chegada baseado em velocidade média e distância restante
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ETAData {
  eta: Date | null;
  remainingDistanceKm: number | null;
  averageSpeedKmh: number | null;
  etaHours: number | null;
  formattedETA: string;
  isCalculating: boolean;
  error: string | null;
}

interface UseFreightETAOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export function useFreightETA(
  freightId: string | null,
  currentLat?: number,
  currentLng?: number,
  currentSpeed?: number,
  options: UseFreightETAOptions = {}
): ETAData {
  const { autoRefresh = true, refreshIntervalMs = 60000 } = options;
  
  const [eta, setEta] = useState<Date | null>(null);
  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number | null>(null);
  const [averageSpeedKmh, setAverageSpeedKmh] = useState<number | null>(null);
  const [etaHours, setEtaHours] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateETA = useCallback(async () => {
    if (!freightId || currentLat === undefined || currentLng === undefined) {
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('calculate_freight_eta', {
        p_freight_id: freightId,
        p_current_lat: currentLat,
        p_current_lng: currentLng,
        p_current_speed_kmh: currentSpeed || null,
      });

      if (rpcError) {
        console.error('[useFreightETA] RPC error:', rpcError);
        setError('Erro ao calcular ETA');
        return;
      }

      const result = data as Record<string, any> | null;

      if (result?.error) {
        console.warn('[useFreightETA] Calculation error:', result.error);
        setError(result.error);
        return;
      }

      if (result) {
        setEta(result.eta ? new Date(result.eta) : null);
        setRemainingDistanceKm(result.remaining_distance_km || null);
        setAverageSpeedKmh(result.average_speed_kmh || null);
        setEtaHours(result.eta_hours || null);
      }

      console.log('[useFreightETA] ETA calculated:', result);
    } catch (err) {
      console.error('[useFreightETA] Unexpected error:', err);
      setError('Erro inesperado ao calcular ETA');
    } finally {
      setIsCalculating(false);
    }
  }, [freightId, currentLat, currentLng, currentSpeed]);

  // Calcular ETA quando coordenadas mudam
  useEffect(() => {
    calculateETA();
  }, [calculateETA]);

  // Auto-refresh periódico
  useEffect(() => {
    if (!autoRefresh || !freightId) return;

    intervalRef.current = setInterval(calculateETA, refreshIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, freightId, refreshIntervalMs, calculateETA]);

  // Formatar ETA para exibição
  const formattedETA = eta
    ? formatDistanceToNow(eta, { addSuffix: true, locale: ptBR })
    : remainingDistanceKm && averageSpeedKmh
      ? `~${Math.round(remainingDistanceKm / averageSpeedKmh)} horas`
      : 'Calculando...';

  return {
    eta,
    remainingDistanceKm,
    averageSpeedKmh,
    etaHours,
    formattedETA,
    isCalculating,
    error,
  };
}

/**
 * Hook para alertas de atraso do frete
 */
export function useFreightDelayAlerts(freightId: string | null) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAlerts = useCallback(async () => {
    if (!freightId) return;

    setIsLoading(true);
    try {
      // Detectar novos alertas
      await supabase.rpc('detect_freight_delay_alerts', {
        p_freight_id: freightId,
      });

      // Buscar alertas ativos
      const { data, error: fetchError } = await supabase
        .from('freight_delay_alerts')
        .select('*')
        .eq('freight_id', freightId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useFreightDelayAlerts] Fetch error:', fetchError);
        setError('Erro ao buscar alertas');
        return;
      }

      setAlerts(data || []);
    } catch (err) {
      console.error('[useFreightDelayAlerts] Error:', err);
      setError('Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  }, [freightId]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  // Subscription para alertas em tempo real
  useEffect(() => {
    if (!freightId) return;

    const channel = supabase
      .channel(`freight-alerts-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'freight_delay_alerts',
          filter: `freight_id=eq.${freightId}`,
        },
        (payload) => {
          console.log('[useFreightDelayAlerts] New alert:', payload);
          setAlerts((prev) => [payload.new as any, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  const resolveAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('freight_delay_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  return {
    alerts,
    isLoading,
    error,
    checkAlerts,
    resolveAlert,
    hasActiveAlerts: alerts.length > 0,
    criticalAlerts: alerts.filter((a) => a.severity === 'critical'),
  };
}
