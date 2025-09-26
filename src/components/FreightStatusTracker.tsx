import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Package, Truck, CheckCircle, Clock, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { format } from 'date-fns';

const STATUS_FLOW = [
  { key: 'ACCEPTED', label: 'Aceito', icon: CheckCircle },
  { key: 'LOADING', label: 'A caminho da coleta', icon: Package },
  { key: 'LOADED', label: 'Carregado', icon: Truck },
  { key: 'IN_TRANSIT', label: 'Em Trânsito', icon: Navigation },
  { key: 'DELIVERED_PENDING_CONFIRMATION', label: 'Entrega Reportada', icon: MapPin }
];

interface StatusHistory {
  id: string;
  status: string;
  notes: string;
  created_at: string;
  changed_by: string;
  location_lat?: number;
  location_lng?: number;
  changer?: {
    full_name: string;
    role: string;
  };
}

interface FreightStatusTrackerProps {
  freightId: string;
  currentStatus: string;
  currentUserProfile: any;
  isDriver: boolean;
  onStatusUpdated?: (newStatus: string) => void;
}

export const FreightStatusTracker: React.FC<FreightStatusTrackerProps> = ({
  freightId,
  currentStatus,
  currentUserProfile,
  isDriver,
  onStatusUpdated
}) => {
  const { toast } = useToast();
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const fetchStatusHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('freight_status_history')
        .select(`
          *,
          changer:profiles!changed_by(full_name, role)
        `)
        .eq('freight_id', freightId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setStatusHistory(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const updateStatus = async (newStatus: string) => {
    if (!currentUserProfile) return;

    setLoading(true);
    try {
      // Verificar se já existe esse status no histórico recente (últimos 5 minutos)
      const { data: recentHistory } = await supabase
        .from('freight_status_history')
        .select('*')
        .eq('freight_id', freightId)
        .eq('status', newStatus as any)
        .eq('changed_by', currentUserProfile.id)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentHistory && recentHistory.length > 0) {
        toast({
          title: "Status já atualizado",
          description: "Este status já foi registrado recentemente.",
          variant: "destructive",
        });
        return;
      }

      let location = null;
      
      // Tentar obter localização atual
      try {
        location = await getCurrentLocation();
      } catch (error) {
        // Silent location update - don't log errors
      }

      // Atualizar o status do frete na tabela principal
      const { error: freightError } = await supabase
        .from('freights')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', freightId);

      if (freightError) throw freightError;

      // Inserir no histórico
      const { error: historyError } = await supabase
        .from('freight_status_history')
        .insert({
          freight_id: freightId,
          status: newStatus as any,
          changed_by: currentUserProfile.id,
          notes: notes.trim() || null,
          location_lat: location?.lat,
          location_lng: location?.lng
        });

      if (historyError) throw historyError;

      setNotes('');
      fetchStatusHistory();
      
      toast({
        title: "Status atualizado",
        description: `Frete marcado como: ${STATUS_FLOW.find(s => s.key === newStatus)?.label}`,
      });

      // Notificar o parent para atualizar UI sem recarregar tudo
      if (onStatusUpdated) {
        onStatusUpdated(newStatus);
      } else {
        // Fallback suave: re-fetcha histórico local
        fetchStatusHistory();
      }

    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextStatus = () => {
    const currentIndex = STATUS_FLOW.findIndex(status => status.key === currentStatus);
    return currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;
  };

  const getStatusVariant = (status: string) => {
    const statusIndex = STATUS_FLOW.findIndex(s => s.key === status);
    const currentIndex = STATUS_FLOW.findIndex(s => s.key === currentStatus);
    
    if (statusIndex < currentIndex) return 'default';
    if (statusIndex === currentIndex) return 'destructive';
    return 'secondary';
  };

  useEffect(() => {
    fetchStatusHistory();

    // Real-time subscription
    const channel = supabase
      .channel('freight-status')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'freight_status_history',
          filter: `freight_id=eq.${freightId}` 
        }, 
        () => {
          fetchStatusHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  const nextStatus = getNextStatus();

  return (
    <div className="space-y-6">
      {/* Status Flow Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Progresso da Viagem
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted mx-8">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out" 
                style={{ 
                  width: `${(STATUS_FLOW.findIndex(s => s.key === currentStatus) / (STATUS_FLOW.length - 1)) * 100}%` 
                }}
              />
            </div>
            
            {/* Status Items */}
            <div className="flex items-center justify-between relative z-10">
              {STATUS_FLOW.map((status, index) => {
                const Icon = status.icon;
                const variant = getStatusVariant(status.key);
                const isActive = status.key === currentStatus;
                const isCompleted = variant === 'default';
                
                return (
                  <div key={status.key} className="flex flex-col items-center" style={{ flex: index === 0 || index === STATUS_FLOW.length - 1 ? '0 0 auto' : '1' }}>
                    <div className={`
                      relative w-10 h-10 rounded-full flex items-center justify-center mb-3 border-2 transition-all duration-300
                      ${isActive 
                        ? 'bg-primary text-primary-foreground border-primary shadow-md scale-110' 
                        : isCompleted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-muted-foreground/30'
                      }
                    `}>
                      <Icon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
                    </div>
                    
                    <span className={`text-xs font-medium text-center leading-tight max-w-[80px] ${
                      isActive 
                        ? 'text-primary font-semibold' 
                        : isCompleted 
                          ? 'text-foreground' 
                          : 'text-muted-foreground'
                    }`}>
                      {status.label}
                    </span>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Controls */}
      {isDriver && nextStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Atualizar Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Status Atual: {STATUS_FLOW.find(s => s.key === currentStatus)?.label}</Badge>
              <span>→</span>
              <Badge>Próximo: {nextStatus.label}</Badge>
            </div>

            <Textarea
              placeholder="Adicione observações sobre esta etapa (opcional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <Button 
              onClick={() => updateStatus(nextStatus.key)}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Atualizando...' : `Marcar como ${nextStatus.label}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statusHistory.map((item) => {
              const status = STATUS_FLOW.find(s => s.key === item.status);
              const Icon = status?.icon || Clock;
              
              return (
                <div key={item.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{status?.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.changer?.role === 'MOTORISTA' ? 'Motorista' : 'Sistema'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                      {item.changer && ` • ${item.changer.full_name}`}
                    </p>
                    
                    {item.notes && (
                      <p className="text-sm bg-muted p-2 rounded">
                        {item.notes}
                      </p>
                    )}
                    
                    {item.location_lat && item.location_lng && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>Localização: {item.location_lat.toFixed(4)}, {item.location_lng.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};