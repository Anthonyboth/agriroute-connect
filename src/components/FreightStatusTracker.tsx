import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Package, Truck, CheckCircle, Clock, Navigation, Map, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { driverUpdateFreightStatus, FINAL_STATUSES } from '@/lib/freight-status-helpers';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFreightEffectiveStatus } from '@/hooks/useFreightEffectiveStatus';
import { FreightStatusHistory } from '@/components/FreightStatusHistory';
import { useDriverFreightStatus } from '@/hooks/useDriverFreightStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ✅ LAZY LOAD: MapLibre is heavy (~200KB), load only when needed
const FreightRealtimeMap = lazy(() => 
  import('@/components/freight/FreightRealtimeMapMapLibre').then(module => ({ 
    default: module.FreightRealtimeMapMapLibre 
  }))
);

// Loading fallback for map
const MapLoader = () => (
  <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Carregando mapa...</span>
  </div>
);

// Fallback para quando o mapa falha ao carregar
const MapErrorFallback = () => (
  <div className="flex flex-col items-center justify-center h-[300px] bg-muted/50 rounded-lg border border-dashed gap-2">
    <Map className="h-8 w-8 text-muted-foreground/50" />
    <span className="text-muted-foreground text-sm">Mapa indisponível no momento</span>
    <span className="text-muted-foreground text-xs">Tente recarregar a página</span>
  </div>
);

// ErrorBoundary para capturar falhas no lazy load do mapa
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[FreightStatusTracker] Map load error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <MapErrorFallback />;
    }
    return this.props.children;
  }
}
const DEFAULT_FLOW = [
  { key: 'ACCEPTED', label: 'Aceito', icon: CheckCircle },
  { key: 'LOADING', label: 'A caminho da coleta', icon: Package },
  { key: 'LOADED', label: 'Carregado', icon: Truck },
  { key: 'IN_TRANSIT', label: 'Em Trânsito', icon: Navigation },
  { key: 'DELIVERED_PENDING_CONFIRMATION', label: 'Entrega Reportada', icon: MapPin }
];

const MOTO_FLOW = [
  { key: 'ACCEPTED', label: 'Aceito', icon: CheckCircle },
  { key: 'LOADING', label: 'A caminho da coleta', icon: Package },
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
  freightServiceType?: string;
  onStatusUpdated?: (newStatus: string) => void;
  companyId?: string; // Allow company to update status
  assignmentId?: string; // Track which assignment is being updated
  // Props for realtime map
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
}

// Fallback para traduzir status quando não encontrado no fluxo - SEMPRE retorna português
const getStatusLabelFallback = (status: string): string => {
  const labels: Record<string, string> = {
    'OPEN': 'Aberto',
    'IN_NEGOTIATION': 'Em Negociação',
    'ACCEPTED': 'Aceito',
    'LOADING': 'A Caminho da Coleta',
    'LOADED': 'Carregado',
    'IN_TRANSIT': 'Em Transporte',
    'DELIVERED': 'Entregue',
    'DELIVERED_PENDING_CONFIRMATION': 'Aguardando Confirmação',
    'CANCELLED': 'Cancelado',
    'COMPLETED': 'Concluído',
    'REJECTED': 'Rejeitado',
    'PENDING': 'Pendente',
    'UNLOADING': 'Descarregando',
    'WAITING': 'Aguardando',
    'CONFIRMED': 'Confirmado'
  };
  // Retorna a tradução ou formata o status removendo underscores
  return labels[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const FreightStatusTracker: React.FC<FreightStatusTrackerProps> = ({
  freightId,
  currentStatus,
  currentUserProfile,
  isDriver,
  freightServiceType,
  onStatusUpdated,
  companyId,
  assignmentId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originCity,
  originState,
  destinationCity,
  destinationState,
}) => {
  const { toast } = useToast();
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeliveryPendingModal, setShowDeliveryPendingModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(freightServiceType || null);

  // ✅ NOVO: Usar hook para obter status efetivo (especialmente para fretes multi-carreta)
  const { 
    effectiveStatus: multiTruckEffectiveStatus, 
    isMultiTruck,
    isLoading: isLoadingEffectiveStatus
  } = useFreightEffectiveStatus(freightId);

  // ✅ Driver-specific effective status (critical for multi-truck: each driver progresses independently)
  const driverId = currentUserProfile?.id as string | undefined;
  const { status: driverEffectiveStatus } = useDriverFreightStatus(
    isDriver && isMultiTruck ? freightId : null,
    isDriver && isMultiTruck ? driverId : null,
  );

  // Selecionar fluxo baseado no tipo de serviço
  const statusFlow = useMemo(() => {
    // Fluxo simplificado (sem LOADED) para: Moto, Guincho, Mudança
    const simplifiedTypes = ['FRETE_MOTO', 'GUINCHO', 'MUDANCA'];
    return simplifiedTypes.includes(serviceType || '') ? MOTO_FLOW : DEFAULT_FLOW;
  }, [serviceType]);

  const fetchStatusHistory = async () => {
    try {
      let query = supabase
        .from('freight_status_history')
        .select(`
          *,
          changer:profiles!freight_status_history_changed_by_fkey(full_name, role)
        `)
        .eq('freight_id', freightId)
        .order('created_at', { ascending: true });

      // ✅ Multi-truck driver view: show ONLY this driver's history to avoid mixing other drivers
      if (isDriver && isMultiTruck && driverId) {
        query = query.eq('changed_by', driverId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStatusHistory(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  // ✅ Calcular status efetivo baseado no histórico OU status de assignments (multi-carreta)
  const effectiveCurrentStatus = useMemo(() => {
    // ✅ Driver view: NEVER use the "most advanced" multi-truck status.
    // Each driver must see/advance based on their own assignment/trip progress.
    if (isDriver) {
      if (isMultiTruck) {
        return driverEffectiveStatus || currentStatus;
      }
      // Single-truck driver: history fallback is ok
      if (statusHistory.length > 0) {
        const lastHistoryStatus = statusHistory[statusHistory.length - 1]?.status;
        return lastHistoryStatus || currentStatus;
      }
      return currentStatus;
    }

    // Para fretes multi-carreta, usar o status mais avançado das atribuições
    if (isMultiTruck && multiTruckEffectiveStatus) {
      console.log('[FreightStatusTracker] Using multi-truck effective status:', multiTruckEffectiveStatus);
      return multiTruckEffectiveStatus;
    }
    // Fallback para histórico ou currentStatus
    if (statusHistory.length > 0) {
      const lastHistoryStatus = statusHistory[statusHistory.length - 1]?.status;
      return lastHistoryStatus || currentStatus;
    }
    return currentStatus;
  }, [
    statusHistory,
    currentStatus,
    isMultiTruck,
    multiTruckEffectiveStatus,
    isDriver,
    driverEffectiveStatus,
  ]);

  // ✅ Verificar se é um status final (não pode ser alterado)
  const isFinalStatus = useMemo(() => {
    return FINAL_STATUSES.includes(effectiveCurrentStatus as any);
  }, [effectiveCurrentStatus]);

  const getCurrentLocation = async (): Promise<{lat: number, lng: number}> => {
    const { getCurrentPositionSafe } = await import('@/utils/location');
    const position = await getCurrentPositionSafe();
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
  };

  const updateStatus = async (newStatus: string) => {
    if (!currentUserProfile) return;

    // ✅ VALIDAÇÃO LOCAL: Bloquear se status efetivo já é final
    if (isFinalStatus) {
      toast({
        title: "Ação bloqueada",
        description: "Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    // ✅ CORREÇÃO BUG 2: Timeout de segurança para destravar botão após 30 segundos
    const loadingTimeout = setTimeout(() => {
      console.warn('[FreightStatusTracker] Timeout de 30s atingido - destravando botão');
      setLoading(false);
      toast({
        title: "Tempo esgotado",
        description: "A operação demorou muito. Verifique se o status foi atualizado e tente novamente.",
        variant: "destructive",
      });
    }, 30000);
    
    try {
      // ✅ Preflight check já é feito no helper, mas mantemos aqui para feedback imediato
      const { data: freightData } = await supabase
        .from('freights')
        .select('status')
        .eq('id', freightId)
        .maybeSingle();

      if (freightData && FINAL_STATUSES.includes(freightData.status as any)) {
        toast({
          title: "Frete finalizado",
          description: "Este frete já foi entregue ou está aguardando confirmação. Não é possível atualizar o status.",
          variant: "destructive",
        });
        clearTimeout(loadingTimeout);
        setLoading(false);
        return;
      }

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
        clearTimeout(loadingTimeout);
        setLoading(false);
        return;
      }

      let location: { lat: number; lng: number } | null = null;
      
      // Tentar obter localização atual
      try {
        location = await getCurrentLocation();
      } catch (_) {
        // Silent location failure
      }

      // ✅ Usar RPC segura (helper já faz preflight check adicional)
      const ok = await driverUpdateFreightStatus({
        freightId,
        newStatus,
        currentUserProfile,
        notes: notes.trim() || undefined,
        location: location || undefined,
        assignmentId // ✅ Passa assignmentId para sincronizar status
      });

      clearTimeout(loadingTimeout);

      if (!ok) {
        // Helper já mostrou toast e disparou eventos - apenas encerrar
        setLoading(false);
        return;
      }

      setNotes('');
      await fetchStatusHistory();
      
      // Toast de sucesso já é emitido centralmente em driverUpdateFreightStatus para evitar duplicação.

      // Exibir popup informativo quando motorista reporta entrega
      if (newStatus === 'DELIVERED_PENDING_CONFIRMATION') {
        setShowDeliveryPendingModal(true);
      }
      
      // Notificar o parent para atualizar UI sem recarregar tudo
      if (onStatusUpdated) {
        onStatusUpdated(newStatus);
      }

    } catch (error: any) {
      console.error('Error updating freight status:', error);
      clearTimeout(loadingTimeout);
      toast({
        title: "Erro ao atualizar status",
        description: error?.message || "Não foi possível atualizar o status. Verifique suas permissões e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextStatus = () => {
    const currentIndex = statusFlow.findIndex(status => status.key === effectiveCurrentStatus);
    return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;
  };

  const getStatusVariant = (status: string) => {
    const statusIndex = statusFlow.findIndex(s => s.key === status);
    const currentIndex = statusFlow.findIndex(s => s.key === effectiveCurrentStatus);
    
    if (statusIndex < currentIndex) return 'default';
    if (statusIndex === currentIndex) return 'destructive';
    return 'secondary';
  };

  useEffect(() => {
    fetchStatusHistory();

    // Buscar service_type se não foi passado
    if (!serviceType) {
      supabase
        .from('freights')
        .select('service_type')
        .eq('id', freightId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.service_type) {
            setServiceType(data.service_type);
          }
        });
    }

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

    // ✅ Listener para evento de status bloqueado
    const handleStatusBlocked = () => {
      fetchStatusHistory();
    };
    
    window.addEventListener('freight-status-blocked', handleStatusBlocked);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('freight-status-blocked', handleStatusBlocked);
    };
  }, [freightId, serviceType, isDriver, isMultiTruck, driverId]);

  const nextStatus = getNextStatus();
  
  // ✅ Bloquear botão de atualização se status efetivo já é final (usando effectiveCurrentStatus)
  const isCurrentStatusFinal = isFinalStatus;
  
  if (import.meta.env.DEV) {
    console.log('[FreightStatusTracker] Current:', currentStatus, 'Effective:', effectiveCurrentStatus, 'Next:', nextStatus?.key, 'Is final:', isCurrentStatusFinal);
  }

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
                  width: `${(statusFlow.findIndex(s => s.key === effectiveCurrentStatus) / (statusFlow.length - 1)) * 100}%` 
                }}
              />
            </div>
            
            {/* Status Items */}
            <div className="flex items-center justify-between relative z-10">
              {statusFlow.map((status, index) => {
                const Icon = status.icon;
                const variant = getStatusVariant(status.key);
                const isActive = status.key === effectiveCurrentStatus;
                const isCompleted = variant === 'default';
                
                return (
                  <div key={status.key} className="flex flex-col items-center" style={{ flex: index === 0 || index === statusFlow.length - 1 ? '0 0 auto' : '1' }}>
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

      {/* Realtime Map - Show when freight is in transit (using effective status for multi-truck) */}
      {['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'].includes(effectiveCurrentStatus) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Mapa de Acompanhamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapErrorBoundary>
              <Suspense fallback={<MapLoader />}>
                <FreightRealtimeMap
                  freightId={freightId}
                  originLat={originLat}
                  originLng={originLng}
                  destinationLat={destinationLat}
                  destinationLng={destinationLng}
                  originCity={originCity}
                  originState={originState}
                  destinationCity={destinationCity}
                  destinationState={destinationState}
                />
              </Suspense>
            </MapErrorBoundary>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              📍 Localização em tempo real do motorista
            </p>
          </CardContent>
        </Card>
      )}

      {/* Driver Controls */}
      {isDriver && nextStatus && !isCurrentStatusFinal && (
        <Card>
          <CardHeader>
            <CardTitle>Atualizar Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Status Atual: {statusFlow.find(s => s.key === effectiveCurrentStatus)?.label || getStatusLabelFallback(effectiveCurrentStatus)}</Badge>
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
              {loading ? 'Atualizando...' : `Atualizar para ${nextStatus.label}`}
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
          {statusHistory.length > 0 ? (
            <div className="space-y-4">
              {statusHistory.map((item) => {
                const status = statusFlow.find(s => s.key === item.status);
                const Icon = status?.icon || Clock;
                
                return (
                  <div key={item.id} className="flex gap-3 pb-4 border-b last:border-0">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{status?.label || getStatusLabelFallback(item.status)}</span>
                        <Badge variant="outline" className="text-xs">
                          {['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(item.changer?.role) ? 'Motorista' : 'Sistema'}
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
          ) : (
            <FreightStatusHistory
              freightId={freightId}
              driverId={isDriver ? currentUserProfile?.id : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal informativo: Aguardar confirmação do produtor */}
      <AlertDialog open={showDeliveryPendingModal} onOpenChange={setShowDeliveryPendingModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Entrega Reportada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Sua entrega foi registrada com sucesso! Agora é necessário aguardar o <strong>produtor confirmar o recebimento</strong> do frete para que ele seja finalizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDeliveryPendingModal(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};