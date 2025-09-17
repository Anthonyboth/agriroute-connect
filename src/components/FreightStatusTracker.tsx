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
  { key: 'LOADING', label: 'Carregando', icon: Package },
  { key: 'LOADED', label: 'Carregado', icon: Truck },
  { key: 'IN_TRANSIT', label: 'Em Trânsito', icon: Navigation },
  { key: 'DELIVERED', label: 'Entregue', icon: MapPin }
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
}

export const FreightStatusTracker: React.FC<FreightStatusTrackerProps> = ({
  freightId,
  currentStatus,
  currentUserProfile,
  isDriver
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
      let location = null;
      
      // Tentar obter localização atual
      try {
        location = await getCurrentLocation();
      } catch (error) {
        // Silent location update - don't log errors
      }

      const { error } = await supabase
        .from('freight_status_history')
        .insert({
          freight_id: freightId,
          status: newStatus as any,
          changed_by: currentUserProfile.id,
          notes: notes.trim() || null,
          location_lat: location?.lat,
          location_lng: location?.lng
        });

      if (error) throw error;

      setNotes('');
      fetchStatusHistory();
      
      toast({
        title: "Status atualizado",
        description: `Frete marcado como: ${STATUS_FLOW.find(s => s.key === newStatus)?.label}`,
      });

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
        <CardContent>
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((status, index) => {
              const Icon = status.icon;
              const variant = getStatusVariant(status.key);
              const isActive = status.key === currentStatus;
              
              return (
                <div key={status.key} className="flex flex-col items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center mb-2
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : variant === 'default' 
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                    }
                  `}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <span className={`text-xs font-medium text-center ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {status.label}
                  </span>
                  
                  {index < STATUS_FLOW.length - 1 && (
                    <div className={`
                      h-1 w-full mt-2
                      ${variant === 'default' ? 'bg-success' : 'bg-muted'}
                    `} />
                  )}
                </div>
              );
            })}
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