/**
 * useOperationHistory.ts
 * 
 * Hook para consultar o histórico imutável de operações concluídas.
 * Dados vêm da tabela `operation_history` (preenchida por trigger DB).
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OperationHistoryItem {
  id: string;
  entity_type: 'FREIGHT' | 'SERVICE';
  original_id: string;
  user_id: string | null;
  user_role: string;
  guest_contact_name: string | null;
  guest_contact_phone: string | null;
  origin_location: string | null;
  destination_location: string | null;
  service_or_cargo_type: string | null;
  final_price: number;
  truck_count: number;
  operation_created_at: string;
  completed_at: string;
  final_status: string;
  rating_completed: boolean;
  snapshot_data: Record<string, any>;
  recorded_at: string;
}

interface UseOperationHistoryOptions {
  entityType?: 'FREIGHT' | 'SERVICE' | null;
  limit?: number;
}

export const useOperationHistory = (options: UseOperationHistoryOptions = {}) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<OperationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { entityType = null, limit = 100 } = options;

  const fetchHistory = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('operation_history')
        .select('*')
        .eq('user_id', profile.id)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error('[useOperationHistory] Erro:', queryError);
        setError(queryError.message);
        setItems([]);
        return;
      }

      setItems((data || []) as OperationHistoryItem[]);
    } catch (err: any) {
      console.error('[useOperationHistory] Erro inesperado:', err);
      setError(err.message || 'Erro ao carregar histórico');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, entityType, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Estatísticas calculadas
  const stats = {
    total: items.length,
    totalRevenue: items.reduce((sum, item) => sum + (item.final_price || 0), 0),
    avgPrice: items.length > 0 
      ? items.reduce((sum, item) => sum + (item.final_price || 0), 0) / items.length 
      : 0,
    freightCount: items.filter(i => i.entity_type === 'FREIGHT').length,
    serviceCount: items.filter(i => i.entity_type === 'SERVICE').length,
    ratedCount: items.filter(i => i.rating_completed).length,
    byType: items.reduce((acc, item) => {
      const type = item.service_or_cargo_type || 'OUTROS';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    items,
    loading,
    error,
    stats,
    refetch: fetchHistory,
  };
};
