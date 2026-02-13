/**
 * Hook para histórico de rota do frete
 * Permite replay visual da rota percorrida
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  capturedAt: Date;
  distanceFromStartKm: number | null;
  distanceToDestinationKm: number | null;
}

interface RouteHistoryData {
  points: RoutePoint[];
  totalDistanceKm: number;
  averageSpeedKmh: number;
  duration: {
    start: Date | null;
    end: Date | null;
    totalMinutes: number;
  };
  isLoading: boolean;
  error: string | null;
}

interface UseRouteHistoryOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export function useRouteHistory(
  freightId: string | null,
  options: UseRouteHistoryOptions = {}
): RouteHistoryData & {
  refetch: () => Promise<void>;
  insertPoint: (lat: number, lng: number, speed?: number, heading?: number, accuracy?: number) => Promise<void>;
} {
  const { autoRefresh = false, refreshIntervalMs = 30000 } = options;

  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!freightId) {
      setPoints([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('freight_route_history')
        .select('*')
        .eq('freight_id', freightId)
        .order('captured_at', { ascending: true });

      if (fetchError) {
        console.error('[useRouteHistory] Fetch error:', fetchError);
        setError('Erro ao buscar histórico de rota');
        return;
      }

      const mappedPoints: RoutePoint[] = (data || []).map((p: any) => ({
        id: p.id,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng),
        speed: p.speed ? parseFloat(p.speed) : null,
        accuracy: p.accuracy ? parseFloat(p.accuracy) : null,
        heading: p.heading ? parseFloat(p.heading) : null,
        capturedAt: new Date(p.captured_at),
        distanceFromStartKm: p.distance_from_start_km ? parseFloat(p.distance_from_start_km) : null,
        distanceToDestinationKm: p.distance_to_destination_km ? parseFloat(p.distance_to_destination_km) : null,
      }));

      setPoints(mappedPoints);
      if (import.meta.env.DEV) console.log(`[useRouteHistory] Loaded ${mappedPoints.length} points`);
    } catch (err) {
      console.error('[useRouteHistory] Unexpected error:', err);
      setError('Erro inesperado');
    } finally {
      setIsLoading(false);
    }
  }, [freightId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !freightId) return;

    intervalRef.current = setInterval(fetchHistory, refreshIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, freightId, refreshIntervalMs, fetchHistory]);

  // Subscription para novos pontos em tempo real
  useEffect(() => {
    if (!freightId) return;

    const channel = supabase
      .channel(`route-history-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'freight_route_history',
          filter: `freight_id=eq.${freightId}`,
        },
        (payload) => {
          const p = payload.new as any;
          const newPoint: RoutePoint = {
            id: p.id,
            lat: parseFloat(p.lat),
            lng: parseFloat(p.lng),
            speed: p.speed ? parseFloat(p.speed) : null,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : null,
            heading: p.heading ? parseFloat(p.heading) : null,
            capturedAt: new Date(p.captured_at),
            distanceFromStartKm: p.distance_from_start_km ? parseFloat(p.distance_from_start_km) : null,
            distanceToDestinationKm: p.distance_to_destination_km ? parseFloat(p.distance_to_destination_km) : null,
          };
          setPoints((prev) => [...prev, newPoint]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  // Função para inserir novo ponto (usado pelo motorista)
  const insertPoint = async (
    lat: number,
    lng: number,
    speed?: number,
    heading?: number,
    accuracy?: number
  ) => {
    if (!freightId) return;

    try {
      const { data, error } = await supabase.rpc('insert_route_point', {
        p_freight_id: freightId,
        p_lat: lat,
        p_lng: lng,
        p_speed: speed || null,
        p_heading: heading || null,
        p_accuracy: accuracy || null,
      });

      if (error) {
        console.error('[useRouteHistory] Insert error:', error);
        return;
      }

      if (import.meta.env.DEV) console.log('[useRouteHistory] Point inserted:', data);
    } catch (err) {
      console.error('[useRouteHistory] Insert unexpected error:', err);
    }
  };

  // Calcular estatísticas
  const totalDistanceKm =
    points.length > 0 && points[points.length - 1].distanceFromStartKm
      ? points[points.length - 1].distanceFromStartKm!
      : 0;

  const validSpeeds = points.filter((p) => p.speed && p.speed > 0).map((p) => p.speed!);
  const averageSpeedKmh =
    validSpeeds.length > 0 ? validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length : 0;

  const duration = {
    start: points.length > 0 ? points[0].capturedAt : null,
    end: points.length > 0 ? points[points.length - 1].capturedAt : null,
    totalMinutes:
      points.length > 1
        ? Math.round(
            (points[points.length - 1].capturedAt.getTime() - points[0].capturedAt.getTime()) /
              60000
          )
        : 0,
  };

  return {
    points,
    totalDistanceKm,
    averageSpeedKmh,
    duration,
    isLoading,
    error,
    refetch: fetchHistory,
    insertPoint,
  };
}

/**
 * Hook para replay visual da rota
 */
export function useRouteReplay(points: RoutePoint[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPoint = points[currentIndex] || null;
  const progress = points.length > 0 ? (currentIndex / (points.length - 1)) * 100 : 0;

  const play = () => {
    if (currentIndex >= points.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const seekTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, points.length - 1)));
  };

  useEffect(() => {
    if (!isPlaying || points.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const baseInterval = 500; // ms entre frames
    const interval = baseInterval / playbackSpeed;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= points.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, points.length]);

  return {
    currentPoint,
    currentIndex,
    progress,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    reset,
    seekTo,
    setPlaybackSpeed,
    totalPoints: points.length,
  };
}
