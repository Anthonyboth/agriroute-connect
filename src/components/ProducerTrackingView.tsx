import { useState, useEffect } from "react";
import { Eye, AlertTriangle, CheckCircle, MapPin, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProducerTrackingViewProps {
  freightId: string;
}

// ✅ Status que devem mostrar mapa de rastreamento (logística real)
const TRACKING_ACTIVE_STATUSES = [
  'LOADING',           // A caminho da coleta
  'LOADED',            // Carregado
  'IN_TRANSIT',        // Em Trânsito
  'DELIVERED_PENDING_CONFIRMATION', // Entrega reportada
];

// ✅ Status que permitem visualização do mapa (mesmo que offline)
const MAP_VISIBLE_STATUSES = [
  'ACCEPTED',          // Aceito (mostra rota planejada)
  'LOADING',           // A caminho da coleta
  'LOADED',            // Carregado
  'IN_TRANSIT',        // Em Trânsito
  'DELIVERED_PENDING_CONFIRMATION', // Entrega reportada
];

export function ProducerTrackingView({ freightId }: ProducerTrackingViewProps) {
  const [canTrack, setCanTrack] = useState(false);
  const [canShowMap, setCanShowMap] = useState(false);
  const [freightStatus, setFreightStatus] = useState<string>('');
  const [trackingStatus, setTrackingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTrackingPermission = async () => {
      try {
        // Buscar o status atual do frete
        const { data: freight } = await supabase
          .from('freights')
          .select('status, tracking_status, required_trucks, driver_id')
          .eq('id', freightId)
          .single();

        if (!freight) return;

        setFreightStatus(freight.status);
        setTrackingStatus(freight.tracking_status);
        
        const isMultiTruck = (freight.required_trucks ?? 1) > 1 && !freight.driver_id;
        
        // ✅ Para fretes multi-carreta, verificar status das atribuições
        if (isMultiTruck) {
          const { data: assignments } = await supabase
            .from('freight_assignments')
            .select('status')
            .eq('freight_id', freightId)
            .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'])
            .limit(1);

          if (assignments && assignments.length > 0) {
            const assignmentStatus = assignments[0].status;
            
            // Usar status da assignment para determinar tracking
            const isTrackingActive = TRACKING_ACTIVE_STATUSES.includes(assignmentStatus);
            const mapVisible = MAP_VISIBLE_STATUSES.includes(assignmentStatus);
            
            setCanTrack(isTrackingActive);
            setCanShowMap(mapVisible);
            
            // Atualizar freightStatus para exibição
            setFreightStatus(assignmentStatus);
            
            console.log('[ProducerTrackingView] Multi-truck freight:', {
              freightStatus: freight.status,
              assignmentStatus,
              canTrack: isTrackingActive,
              canShowMap: mapVisible
            });
            return;
          }
        }
        
        // Lógica original para fretes de carreta única
        const isTrackingActive = 
          TRACKING_ACTIVE_STATUSES.includes(freight.status) || 
          freight.tracking_status === 'ACTIVE';
        
        setCanTrack(isTrackingActive);
        setCanShowMap(MAP_VISIBLE_STATUSES.includes(freight.status));
      } catch (error) {
        console.error('Erro ao verificar permissões de rastreamento:', error);
      } finally {
        setLoading(false);
      }
    };

    checkTrackingPermission();

    // Subscription para mudanças no frete
    const freightChannel = supabase
      .channel(`freight_tracking_status_${freightId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'freights',
          filter: `id=eq.${freightId}`
        },
        () => {
          checkTrackingPermission();
        }
      )
      .subscribe();

    // ✅ NOVO: Subscription para mudanças nas atribuições (fretes multi-carreta)
    const assignmentChannel = supabase
      .channel(`assignment_tracking_status_${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `freight_id=eq.${freightId}`
        },
        () => {
          checkTrackingPermission();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(freightChannel);
      supabase.removeChannel(assignmentChannel);
    };
  }, [freightId]);

  if (loading) {
    return (
      <div className="p-4 bg-muted/30 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground animate-pulse" />
          <span className="text-muted-foreground">Verificando status de rastreamento...</span>
        </div>
      </div>
    );
  }

  // ✅ Status ACEITO: Mostra que o motorista foi designado, mapa com rota planejada
  if (freightStatus === 'ACCEPTED' && !canTrack) {
    return (
      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Truck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-foreground mb-2">Motorista Designado</div>
            <p className="text-sm text-muted-foreground mb-3">
              O motorista aceitou o frete e está se preparando para a coleta.
              O rastreamento em tempo real será ativado quando ele iniciar o trajeto.
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Status atual:</strong> {getStatusLabel(freightStatus)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canTrack) {
    return (
      <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-foreground mb-2">Rastreamento Não Disponível</div>
            <p className="text-sm text-muted-foreground mb-3">
              O rastreamento em tempo real será disponibilizado após o motorista
              iniciar a viagem de coleta.
            </p>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                <strong>Status atual:</strong> {getStatusLabel(freightStatus)}
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Próximos passos:</strong>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>• Aguarde o motorista iniciar a viagem</li>
                <li>• O rastreamento será ativado automaticamente</li>
                <li>• Você receberá notificações de progresso</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-foreground mb-2">Rastreamento Ativo</div>
          <p className="text-sm text-muted-foreground mb-3">
            Você pode acompanhar a localização do seu frete em tempo real
            através do mapa abaixo.
          </p>
          
          <div className="mt-3 p-2 bg-background rounded border border-border">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-3 w-3 text-success" />
              <span className="text-xs font-medium text-foreground">Status Atual</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {getStatusLabel(freightStatus)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'ACCEPTED': 'Aceito',
    'LOADING': 'A Caminho da Coleta', 
    'LOADED': 'Carregado',
    'IN_TRANSIT': 'Em Transporte',
    'DELIVERED': 'Entregue',
    'DELIVERED_PENDING_CONFIRMATION': 'Entrega Reportada',
    'OPEN': 'Aberto',
    'IN_NEGOTIATION': 'Em Negociação',
    'CANCELLED': 'Cancelado',
    'COMPLETED': 'Concluído'
  };
  return statusLabels[status] || status;
}