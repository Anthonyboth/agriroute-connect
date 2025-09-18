import { useState, useEffect } from "react";
import { Eye, AlertTriangle, CheckCircle, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProducerTrackingViewProps {
  freightId: string;
}

export function ProducerTrackingView({ freightId }: ProducerTrackingViewProps) {
  const [canTrack, setCanTrack] = useState(false);
  const [freightStatus, setFreightStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTrackingPermission = async () => {
      try {
        // Buscar o status atual do frete
        const { data: freight } = await supabase
          .from('freights')
          .select('status, tracking_status')
          .eq('id', freightId)
          .single();

        if (freight) {
          setFreightStatus(freight.status);
          // Permitir rastreamento se o frete está em status "LOADED" ou superior
          // e se o rastreamento está ativo
          const allowedStatuses = ['LOADED', 'IN_TRANSIT', 'DELIVERED'];
          setCanTrack(
            allowedStatuses.includes(freight.status) || 
            freight.tracking_status === 'ACTIVE'
          );
        }
      } catch (error) {
        console.error('Erro ao verificar permissões de rastreamento:', error);
      } finally {
        setLoading(false);
      }
    };

    checkTrackingPermission();

    // Subscription para mudanças no frete
    const channel = supabase
      .channel('freight_tracking_status')
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-600 animate-pulse" />
          <span className="text-gray-700">Verificando status de rastreamento...</span>
        </div>
      </div>
    );
  }

  if (!canTrack) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-amber-800 mb-2">Rastreamento Não Disponível</div>
            <p className="text-sm text-amber-700 mb-3">
              O rastreamento em tempo real será disponibilizado após ambas as partes 
              confirmarem que a carga foi carregada ("Carregado").
            </p>
            <div className="space-y-2">
              <div className="text-xs text-amber-600">
                <strong>Status atual:</strong> {getStatusLabel(freightStatus)}
              </div>
              <div className="text-xs text-amber-600">
                <strong>Próximos passos:</strong>
              </div>
              <ul className="text-xs text-amber-600 space-y-1 ml-4">
                <li>• Aguarde o motorista chegar ao local de coleta</li>
                <li>• Acompanhe o processo de carregamento</li>
                <li>• Confirme quando a carga estiver carregada</li>
                <li>• O rastreamento será ativado automaticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-green-800 mb-2">Rastreamento Ativo</div>
          <p className="text-sm text-green-700 mb-3">
            A carga foi carregada e confirmada por ambas as partes. 
            Você pode acompanhar a localização do seu frete em tempo real.
          </p>
          
          <div className="mt-3 p-2 bg-white rounded border">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-800">Status Atual</span>
            </div>
            <div className="text-xs text-gray-600">
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
    'LOADING': 'A caminho da coleta', 
    'LOADED': 'Carregado',
    'IN_TRANSIT': 'Em Trânsito',
    'DELIVERED': 'Entregue'
  };
  return statusLabels[status] || status;
}