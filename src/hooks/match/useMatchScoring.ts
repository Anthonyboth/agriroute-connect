import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Score breakdown for audit/debug
 */
export interface ScoreBreakdown {
  distanceScore: number;   // 0-30
  recencyScore: number;    // 0-20
  typeMatchScore: number;  // 0-10
  historyBoost: number;    // 0-15
  urgencyBoost: number;    // 0-10
  qualityBoost: number;    // 0-5
  diversityPenalty: number; // 0 to -10
  total: number;           // 0-100
}

export interface ScoredItem {
  id: string;
  kind: 'FREIGHT' | 'SERVICE';
  score: number;
  breakdown: ScoreBreakdown;
}

interface InteractionSummary {
  [key: string]: number; // e.g. "FREIGHT_accepted": 5
}

/**
 * Scoring engine for match feed items (0-100).
 * 
 * Components:
 * - Distance (0-30): closer = higher
 * - Recency (0-20): newer = higher
 * - Type match (0-10): exact match with user preferences
 * - History boost (0-15): based on past acceptance patterns
 * - Urgency boost (0-10): HIGH=10, MEDIUM=6, LOW=3
 * - Quality boost (0-5): has precise coords
 * - Diversity penalty (0 to -10): penalizes sequences of same type/city
 */
export function useMatchScoring() {
  const { user } = useAuth();
  const interactionCacheRef = useRef<{ data: InteractionSummary; ts: number } | null>(null);
  const CACHE_TTL = 5 * 60 * 1000; // 5 min cache for interaction summary

  const fetchInteractionSummary = useCallback(async (): Promise<InteractionSummary> => {
    if (!user?.id) return {};

    // Use cache if fresh
    const cached = interactionCacheRef.current;
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_interaction_summary', {
        p_user_id: user.id,
        p_days: 30,
      });
      if (error) throw error;
      const summary = (data as InteractionSummary) || {};
      interactionCacheRef.current = { data: summary, ts: Date.now() };
      return summary;
    } catch {
      return interactionCacheRef.current?.data || {};
    }
  }, [user?.id]);

  /**
   * Calculate distance score: 0km=30, 300km=0 (linear)
   */
  const calcDistanceScore = (distanceKm: number | null | undefined): number => {
    if (distanceKm == null || distanceKm < 0) return 15; // unknown = middle
    const clamped = Math.min(distanceKm, 300);
    return Math.round(30 * (1 - clamped / 300));
  };

  /**
   * Calculate recency score: <1h=20, 24h=10, 72h+=0
   */
  const calcRecencyScore = (createdAt: string | null | undefined): number => {
    if (!createdAt) return 0;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours <= 1) return 20;
    if (ageHours >= 72) return 0;
    // Linear interpolation: 1h=20, 72h=0
    return Math.round(20 * (1 - (ageHours - 1) / 71));
  };

  /**
   * Calculate type match score against user preferences
   */
  const calcTypeMatchScore = (
    itemType: string | undefined,
    userServiceTypes: string[] | undefined
  ): number => {
    if (!itemType || !userServiceTypes?.length) return 5; // neutral
    if (userServiceTypes.includes(itemType)) return 10; // exact match
    return 0;
  };

  /**
   * Calculate history boost based on past interactions
   */
  const calcHistoryBoost = (
    kind: 'FREIGHT' | 'SERVICE',
    summary: InteractionSummary
  ): number => {
    const acceptedKey = `${kind}_accepted`;
    const rejectedKey = `${kind}_rejected`;
    const accepted = summary[acceptedKey] || 0;
    const rejected = summary[rejectedKey] || 0;
    const total = accepted + rejected;
    if (total === 0) return 0;
    // Higher ratio of accepted = more boost
    const ratio = accepted / total;
    return Math.round(ratio * 15);
  };

  /**
   * Calculate urgency boost
   */
  const calcUrgencyBoost = (urgency: string | undefined): number => {
    switch (urgency?.toUpperCase()) {
      case 'HIGH': return 10;
      case 'MEDIUM': return 6;
      case 'LOW': return 3;
      default: return 3;
    }
  };

  /**
   * Calculate quality boost (has precise coordinates)
   */
  const calcQualityBoost = (payload: any): number => {
    const hasLat = payload?.origin_lat != null || payload?.location_lat != null;
    const hasLng = payload?.origin_lng != null || payload?.location_lng != null;
    return (hasLat && hasLng) ? 5 : 0;
  };

  /**
   * Score all items and sort by score DESC, with diversity penalty
   */
  const scoreItems = useCallback(async <T extends {
    id: string;
    kind: 'FREIGHT' | 'SERVICE';
    distance_km?: number | null;
    created_at?: string | null;
    service_type?: string | null;
    freight_type?: string | null;
    urgency?: string | null;
    city_id?: string | null;
    payload?: any;
  }>(
    items: T[],
    userServiceTypes?: string[]
  ): Promise<(T & { score: number; scoreBreakdown: ScoreBreakdown })[]> => {
    if (items.length === 0) return [];

    const summary = await fetchInteractionSummary();

    // First pass: calculate base scores
    const scored = items.map(item => {
      const distanceScore = calcDistanceScore(item.distance_km);
      const recencyScore = calcRecencyScore(item.created_at);
      const typeMatchScore = calcTypeMatchScore(
        item.service_type || item.freight_type || undefined,
        userServiceTypes
      );
      const historyBoost = calcHistoryBoost(item.kind, summary);
      const urgencyBoost = calcUrgencyBoost(item.urgency || undefined);
      const qualityBoost = calcQualityBoost(item.payload || item);

      const rawTotal = distanceScore + recencyScore + typeMatchScore +
        historyBoost + urgencyBoost + qualityBoost;

      return {
        ...item,
        _distanceScore: distanceScore,
        _recencyScore: recencyScore,
        _typeMatchScore: typeMatchScore,
        _historyBoost: historyBoost,
        _urgencyBoost: urgencyBoost,
        _qualityBoost: qualityBoost,
        _rawTotal: rawTotal,
      };
    });

    // Sort by raw total first
    scored.sort((a, b) => b._rawTotal - a._rawTotal);

    // Second pass: apply diversity penalty (consecutive same type/city)
    const result: (T & { score: number; scoreBreakdown: ScoreBreakdown })[] = [];
    const recentTypes: string[] = [];
    const recentCities: string[] = [];

    for (const item of scored) {
      let diversityPenalty = 0;
      const itemType = item.service_type || item.freight_type || '';
      const itemCity = item.city_id || '';

      // Check last 3 items for same type
      const sameTypeCount = recentTypes.slice(-3).filter(t => t === itemType).length;
      if (sameTypeCount >= 2) diversityPenalty -= 5;
      else if (sameTypeCount >= 1) diversityPenalty -= 2;

      // Check last 3 items for same city
      const sameCityCount = recentCities.slice(-3).filter(c => c === itemCity).length;
      if (sameCityCount >= 2) diversityPenalty -= 5;
      else if (sameCityCount >= 1) diversityPenalty -= 2;

      // Cap diversity penalty at -10
      diversityPenalty = Math.max(diversityPenalty, -10);

      const total = Math.max(0, Math.min(100, item._rawTotal + diversityPenalty));

      const breakdown: ScoreBreakdown = {
        distanceScore: item._distanceScore,
        recencyScore: item._recencyScore,
        typeMatchScore: item._typeMatchScore,
        historyBoost: item._historyBoost,
        urgencyBoost: item._urgencyBoost,
        qualityBoost: item._qualityBoost,
        diversityPenalty,
        total,
      };

      result.push({
        ...item,
        score: total,
        scoreBreakdown: breakdown,
      });

      recentTypes.push(itemType);
      recentCities.push(itemCity);
    }

    // Final sort by score DESC, fallback by created_at DESC
    result.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [fetchInteractionSummary]);

  return { scoreItems };
}
