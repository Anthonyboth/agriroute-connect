import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime, formatDate } from '@/lib/formatters';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { Clock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatusHistoryItem {
  id: string;
  status: string;
  created_at: string;
  notes: string | null;
  changed_by_profile?: {
    full_name: string;
  } | null;
}

interface TripProgressData {
  id: string;
  driver_id: string;
  current_status: string;
  accepted_at: string | null;
  loading_at: string | null;
  loaded_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  driver_name?: string;
}

interface FreightStatusHistoryProps {
  freightId: string;
  driverId?: string; // Optional: para filtrar por motorista específico
}

// Labels amigáveis para cada status
const STATUS_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  'ACCEPTED': { label: 'Aceito', icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> },
  'LOADING': { label: 'A caminho da coleta', icon: <ArrowRight className="h-3 w-3 text-blue-500" /> },
  'LOADED': { label: 'Carregado', icon: <CheckCircle2 className="h-3 w-3 text-amber-500" /> },
  'IN_TRANSIT': { label: 'Em trânsito', icon: <ArrowRight className="h-3 w-3 text-purple-500" /> },
  'DELIVERED_PENDING_CONFIRMATION': { label: 'Entrega reportada', icon: <CheckCircle2 className="h-3 w-3 text-orange-500" /> },
  'DELIVERED': { label: 'Entregue', icon: <CheckCircle2 className="h-3 w-3 text-green-600" /> },
  'COMPLETED': { label: 'Concluído', icon: <CheckCircle2 className="h-3 w-3 text-emerald-600" /> },
};

// Formatar data/hora de forma amigável
const formatTimestamp = (timestamp: string | null): string => {
  if (!timestamp) return 'Não registrado';
  try {
    const date = new Date(timestamp);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
};

export const FreightStatusHistory: React.FC<FreightStatusHistoryProps> = ({ freightId, driverId }) => {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [tripProgress, setTripProgress] = useState<TripProgressData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Buscar histórico de status (freight_status_history)
      const { data: historyData, error: historyError } = await supabase
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
        .limit(20);

      if (!historyError && historyData) {
        setHistory(historyData as any);
      }
      
      // Buscar progresso da viagem (driver_trip_progress) - fonte primária com timestamps
      let progressQuery = supabase
        .from('driver_trip_progress')
        .select(`
          id,
          driver_id,
          current_status,
          accepted_at,
          loading_at,
          loaded_at,
          in_transit_at,
          delivered_at
        `)
        .eq('freight_id', freightId);
      
      if (driverId) {
        progressQuery = progressQuery.eq('driver_id', driverId);
      }
      
      const { data: progressData, error: progressError } = await progressQuery;

      if (!progressError && progressData && progressData.length > 0) {
        // Buscar nomes dos motoristas
        const driverIds = progressData.map(p => p.driver_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', driverIds);
        
        const progressWithNames = progressData.map(p => ({
          ...p,
          driver_name: profiles?.find(pr => pr.id === p.driver_id)?.full_name || 'Motorista'
        }));
        
        setTripProgress(progressWithNames);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [freightId, driverId]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  
  // Se não há dados de progresso nem histórico
  if (tripProgress.length === 0 && history.length === 0) {
    return (
      <div className="mt-4 border-t pt-3">
        <p className="text-sm font-semibold mb-2">Histórico de Status:</p>
        <p className="text-xs text-muted-foreground italic">Nenhum registro de progresso encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t pt-3">
      <p className="text-sm font-semibold mb-3">Progresso da Viagem:</p>
      
      {/* Mostrar progresso por motorista com timestamps */}
      {tripProgress.length > 0 && (
        <div className="space-y-4 mb-4">
          {tripProgress.map((progress) => (
            <div key={progress.id} className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                <User className="h-3 w-3" />
                {progress.driver_name}
              </p>
              
              {/* Timeline de status com timestamps */}
              <div className="space-y-2">
                {/* Aceito */}
                <TimelineItem 
                  status="ACCEPTED" 
                  timestamp={progress.accepted_at}
                  isCompleted={!!progress.accepted_at}
                  isCurrent={progress.current_status === 'ACCEPTED'}
                />
                
                {/* A caminho da coleta */}
                <TimelineItem 
                  status="LOADING" 
                  timestamp={progress.loading_at}
                  isCompleted={!!progress.loading_at}
                  isCurrent={progress.current_status === 'LOADING'}
                />
                
                {/* Carregado */}
                <TimelineItem 
                  status="LOADED" 
                  timestamp={progress.loaded_at}
                  isCompleted={!!progress.loaded_at}
                  isCurrent={progress.current_status === 'LOADED'}
                />
                
                {/* Em trânsito */}
                <TimelineItem 
                  status="IN_TRANSIT" 
                  timestamp={progress.in_transit_at}
                  isCompleted={!!progress.in_transit_at}
                  isCurrent={progress.current_status === 'IN_TRANSIT'}
                />
                
                {/* Entrega reportada */}
                <TimelineItem 
                  status="DELIVERED_PENDING_CONFIRMATION" 
                  timestamp={progress.delivered_at}
                  isCompleted={!!progress.delivered_at && ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(progress.current_status)}
                  isCurrent={progress.current_status === 'DELIVERED_PENDING_CONFIRMATION'}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Histórico adicional (da tabela freight_status_history) */}
      {history.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico Detalhado:</p>
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
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {formatTimestamp(item.created_at)}
                  </p>
                  {item.notes && <p className="text-muted-foreground italic mt-1">{item.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para item da timeline
interface TimelineItemProps {
  status: string;
  timestamp: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ status, timestamp, isCompleted, isCurrent }) => {
  const info = STATUS_INFO[status] || { label: status, icon: <Clock className="h-3 w-3" /> };
  
  return (
    <div className={`flex items-center gap-2 text-xs ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
      <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
        isCompleted ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-muted'
      }`}>
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>
          {info.label}
        </span>
      </div>
      <div className="text-right">
        {isCompleted ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatTimestamp(timestamp)}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Pendente</span>
        )}
      </div>
    </div>
  );
};