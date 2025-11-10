import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/formatters';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { Clock, User } from 'lucide-react';

interface StatusHistoryItem {
  id: string;
  status: string;
  created_at: string;
  notes: string | null;
  changed_by_profile?: {
    full_name: string;
  } | null;
}

interface FreightStatusHistoryProps {
  freightId: string;
}

export const FreightStatusHistory: React.FC<FreightStatusHistoryProps> = ({ freightId }) => {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('freight_status_history')
        .select(`
          id,
          status,
          created_at,
          notes,
          changed_by_profile:profiles!freight_status_history_changed_by_fkey(full_name)
        `)
        .eq('freight_id', freightId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setHistory(data as any);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [freightId]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  if (history.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-3">
      <p className="text-sm font-semibold mb-2">Histórico de Status:</p>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {history.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{getFreightStatusLabel(item.status)}</p>
              <p className="text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.changed_by_profile?.full_name || 'Sistema'}
              </p>
              <p className="text-muted-foreground">{formatDateTime(item.created_at)}</p>
              {item.notes && <p className="text-muted-foreground italic mt-1">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
