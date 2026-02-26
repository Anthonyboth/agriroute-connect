import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StopEvent {
  id: string;
  freight_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  address?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  reason?: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  is_known_point: boolean;
  known_point_type?: string;
  created_at: string;
}

export interface RouteDeviation {
  id: string;
  freight_id: string;
  detected_at: string;
  deviation_km: number;
  lat: number;
  lng: number;
  expected_lat?: number;
  expected_lng?: number;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  notes?: string;
  created_at: string;
}

export interface OfflineIncident {
  id: string;
  freight_id: string;
  driver_id?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  last_known_lat?: number;
  last_known_lng?: number;
  first_return_lat?: number;
  first_return_lng?: number;
  distance_gap_km?: number;
  is_suspicious: boolean;
  notes?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  frete_id: string;
  tipo: string;
  codigo_regra: string;
  descricao: string;
  severidade: string;
  resolvido: boolean;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  type: 'stop' | 'offline' | 'deviation' | 'audit';
  timestamp: string;
  duration_minutes?: number;
  description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  lat?: number;
  lng?: number;
}

export interface AntifraudIndicators {
  totalStopTimeMinutes: number;
  stopsCount: number;
  routeDeviationMaxKm: number;
  offlinePercentage: number;
  etaDegraded: boolean;
  highRiskStops: number;
  suspiciousOfflineCount: number;
}

export interface AntifraudData {
  score: number;
  level: 'normal' | 'attention' | 'high_risk';
  stops: StopEvent[];
  offlineIncidents: OfflineIncident[];
  routeDeviations: RouteDeviation[];
  auditEvents: AuditEvent[];
  timeline: TimelineEvent[];
  indicators: AntifraudIndicators;
  analyzedAt?: string;
  trackingPoints: number;
}

interface UseAntifraudDataResult {
  data: AntifraudData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  recalculateScore: () => Promise<void>;
}

export function useAntifraudData(freightId: string): UseAntifraudDataResult {
  const [data, setData] = useState<AntifraudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!freightId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        { data: freightData, error: freightError },
        { data: stopsData, error: stopsError },
        { data: offlineData, error: offlineError },
        { data: deviationsData, error: deviationsError },
        { data: auditData, error: auditError },
        { count: trackingPointsCount, error: trackingCountError },
      ] = await Promise.all([
        supabase
          .from('freights')
          .select('antifraud_score, antifraud_level, total_stop_time_minutes, total_offline_time_minutes, route_deviation_max_km, antifraud_analyzed_at')
          .eq('id', freightId)
          .maybeSingle(),
        supabase
          .from('stop_events')
          .select('*')
          .eq('freight_id', freightId)
          .order('started_at', { ascending: false }),
        supabase
          .from('offline_incidents')
          .select('*')
          .eq('freight_id', freightId)
          .order('started_at', { ascending: false }),
        supabase
          .from('route_deviations')
          .select('*')
          .eq('freight_id', freightId)
          .order('detected_at', { ascending: false }),
        supabase
          .from('auditoria_eventos')
          .select('*')
          .eq('frete_id', freightId)
          .order('created_at', { ascending: false }),
        supabase
          .from('driver_location_history')
          .select('id', { count: 'exact', head: true })
          .eq('freight_id', freightId),
      ]);

      if (freightError) throw freightError;

      const stops = (stopsData || []) as StopEvent[];
      const offlineIncidents = (offlineData || []) as OfflineIncident[];
      const routeDeviations = (deviationsData || []) as RouteDeviation[];
      const auditEvents = (auditData || []) as AuditEvent[];

      // Build timeline
      const timeline: TimelineEvent[] = [];

      stops.forEach((stop) => {
        timeline.push({
          id: stop.id,
          type: 'stop',
          timestamp: stop.started_at,
          duration_minutes: stop.duration_minutes,
          description: stop.reason || 'Parada detectada',
          risk_level: stop.risk_level || 'low',
          lat: Number(stop.lat),
          lng: Number(stop.lng),
        });
      });

      offlineIncidents.forEach((incident) => {
        timeline.push({
          id: incident.id,
          type: 'offline',
          timestamp: incident.started_at,
          duration_minutes: incident.duration_minutes,
          description: incident.is_suspicious ? 'Offline suspeito' : 'Perda de sinal GPS',
          risk_level: incident.is_suspicious ? 'critical' : 'medium',
          lat: incident.last_known_lat ? Number(incident.last_known_lat) : undefined,
          lng: incident.last_known_lng ? Number(incident.last_known_lng) : undefined,
        });
      });

      routeDeviations.forEach((deviation) => {
        timeline.push({
          id: deviation.id,
          type: 'deviation',
          timestamp: deviation.detected_at,
          description: `Desvio de ${Number(deviation.deviation_km).toFixed(1)}km da rota`,
          risk_level: deviation.severity,
          lat: Number(deviation.lat),
          lng: Number(deviation.lng),
        });
      });

      auditEvents.forEach((event) => {
        timeline.push({
          id: event.id,
          type: 'audit',
          timestamp: event.created_at,
          description: event.descricao,
          risk_level: event.severidade === 'alta' ? 'high' : event.severidade === 'media' ? 'medium' : 'low',
        });
      });

      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Calculate indicators
      const totalStopTimeMinutes = stops.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const totalOfflineMinutes = offlineIncidents.reduce((sum, o) => sum + (o.duration_minutes || 0), 0);
      const highRiskStops = stops.filter((s) => s.risk_level === 'high' || s.risk_level === 'critical').length;
      const suspiciousOfflineCount = offlineIncidents.filter((o) => o.is_suspicious).length;
      const maxDeviation = routeDeviations.length > 0 
        ? Math.max(...routeDeviations.map((d) => Number(d.deviation_km))) 
        : 0;

      // Calculate offline percentage (assume 24h max for calculation)
      const offlinePercentage = totalOfflineMinutes > 0 ? Math.min((totalOfflineMinutes / (24 * 60)) * 100, 100) : 0;

      const indicators: AntifraudIndicators = {
        totalStopTimeMinutes,
        stopsCount: stops.length,
        routeDeviationMaxKm: maxDeviation,
        offlinePercentage,
        etaDegraded: false, // Could be calculated based on eta vs actual time
        highRiskStops,
        suspiciousOfflineCount,
      };

      setData({
        score: freightData?.antifraud_score ?? 0,
        level: (freightData?.antifraud_level as AntifraudData['level']) ?? 'normal',
        stops,
        offlineIncidents,
        routeDeviations,
        auditEvents,
        timeline,
        indicators,
        analyzedAt: freightData?.antifraud_analyzed_at,
        trackingPoints: trackingCountError ? 0 : (trackingPointsCount || 0),
      });
    } catch (err: any) {
      console.error('Error fetching antifraud data:', err);
      setError(err.message || 'Erro ao carregar dados de antifraude');
    } finally {
      setLoading(false);
    }
  }, [freightId]);

  const recalculateScore = useCallback(async () => {
    if (!freightId) return;

    try {
      setLoading(true);

      // 1) Executa regras antifraude para gerar eventos reais
      const { error: rulesError } = await supabase.rpc('run_antifraud_rules', {
        p_freight_id: freightId,
      });
      if (rulesError) throw rulesError;

      // 2) Recalcula score consolidado
      const { error: scoreError } = await supabase.rpc('calculate_freight_antifraud_score', {
        p_freight_id: freightId,
      });
      if (scoreError) throw scoreError;

      // Refetch data after recalculation
      await fetchData();
    } catch (err: any) {
      console.error('Error recalculating antifraud score:', err);
      setError(err.message || 'Erro ao recalcular score');
    } finally {
      setLoading(false);
    }
  }, [freightId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    recalculateScore,
  };
}
