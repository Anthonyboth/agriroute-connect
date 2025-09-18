import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Shield,
  Eye
} from "lucide-react";
import { useFreightTracking } from "@/hooks/useFreightTracking";
import { TrackingConsentModal } from "./TrackingConsentModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FreightTrackingPanelProps {
  freightId: string;
  isDriver: boolean;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
}

export function FreightTrackingPanel({ 
  freightId, 
  isDriver, 
  onTrackingStart,
  onTrackingStop 
}: FreightTrackingPanelProps) {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState<any[]>([]);

  const { 
    trackingState, 
    startTracking, 
    stopTracking, 
    settings 
  } = useFreightTracking(freightId, consentGiven);

  // Verificar se já existe consentimento
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('tracking_consents')
          .select('consent_given')
          .eq('freight_id', freightId)
          .eq('user_id', user.id)
          .single();

        if (data?.consent_given) {
          setConsentGiven(true);
        }
      } catch (error) {
        console.error('Erro ao verificar consentimento:', error);
      }
    };

    if (isDriver) {
      checkConsent();
    }
  }, [freightId, isDriver]);

  // Carregar incidentes
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const { data } = await supabase
          .from('incident_logs')
          .select('*')
          .eq('freight_id', freightId)
          .order('created_at', { ascending: false });

        setIncidents(data || []);
      } catch (error) {
        console.error('Erro ao carregar incidentes:', error);
      }
    };

    loadIncidents();

    // Subscription para incidentes em tempo real
    const channel = supabase
      .channel('incident_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incident_logs',
          filter: `freight_id=eq.${freightId}`
        },
        (payload) => {
          setIncidents(prev => [payload.new, ...prev]);
          if (payload.new.incident_type === 'SIGNAL_LOST') {
            toast.error("Perda de sinal detectada!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  const handleStartTracking = async () => {
    if (!consentGiven) {
      setShowConsentModal(true);
      return;
    }

    setLoading(true);
    try {
      const success = await startTracking();
      if (success) {
        onTrackingStart?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStopTracking = async () => {
    setLoading(true);
    try {
      await stopTracking();
      onTrackingStop?.();
    } finally {
      setLoading(false);
    }
  };

  const handleConsent = (agreed: boolean) => {
    setShowConsentModal(false);
    if (agreed) {
      setConsentGiven(true);
      handleStartTracking();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'secondary';
      case 'ERROR':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getIncidentColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'secondary';
      case 'LOW':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatIncidentType = (type: string) => {
    const types = {
      'SIGNAL_LOST': 'Perda de Sinal',
      'ROUTE_DEVIATION': 'Desvio de Rota',
      'GPS_DISABLED': 'GPS Desabilitado',
      'SUSPECTED_SPOOFING': 'Suspeita de Falsificação'
    };
    return types[type as keyof typeof types] || type;
  };

  return (
    <div className="space-y-6">
      {/* Painel Principal de Rastreamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sistema de Rastreamento e Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status do Rastreamento */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {trackingState.isActive ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
              <span className="font-medium">Status:</span>
              <Badge variant={trackingState.isActive ? 'default' : 'secondary'}>
                {trackingState.isActive ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            
            {trackingState.signalLost && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Sinal Perdido
              </Badge>
            )}
          </div>

          {/* Métricas de Rastreamento */}
          {trackingState.isActive && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-700">
                  {trackingState.locationCount}
                </div>
                <div className="text-xs text-green-600">Updates Enviados</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-green-700">
                  {Math.floor(settings.updateInterval / 1000)}s
                </div>
                <div className="text-xs text-green-600">Intervalo</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-green-700">
                  {trackingState.lastUpdate ? 
                    new Date(trackingState.lastUpdate).toLocaleTimeString('pt-BR') 
                    : '-'
                  }
                </div>
                <div className="text-xs text-green-600">Última Atualização</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-green-700">
                  {Math.floor(settings.signalLossThreshold / 1000)}s
                </div>
                <div className="text-xs text-green-600">Limite Perda Sinal</div>
              </div>
            </div>
          )}

          {/* Controles do Motorista */}
          {isDriver && (
            <div className="flex gap-3">
              {!trackingState.isActive ? (
                <Button 
                  onClick={handleStartTracking}
                  disabled={loading}
                  className="flex-1"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {loading ? "Ativando..." : "Ativar Rastreamento"}
                </Button>
              ) : (
                <Button 
                  onClick={handleStopTracking}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {loading ? "Desativando..." : "Parar Rastreamento"}
                </Button>
              )}
            </div>
          )}

          {/* Avisos de Segurança */}
          {isDriver && trackingState.isActive && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-amber-800">Importante:</div>
                  <ul className="text-amber-700 mt-1 space-y-1 list-disc list-inside text-xs">
                    <li>Mantenha o GPS sempre ativo</li>
                    <li>Não use ferramentas de falsificação de localização</li>
                    <li>Responda aos alertas do sistema imediatamente</li>
                    <li>O desligamento pode resultar em suspensão da conta</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Visualização para Produtores */}
          {!isDriver && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Monitoramento do Frete</span>
              </div>
              <p className="text-sm text-blue-700">
                Você pode acompanhar a localização do seu frete em tempo real quando o rastreamento estiver ativo.
              </p>
            </div>
          )}

          {/* Erro de Rastreamento */}
          {trackingState.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">Erro:</span>
                <span className="text-red-700 text-sm">{trackingState.error}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incidentes de Segurança */}
      {incidents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Incidentes de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incidents.slice(0, 5).map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={getIncidentColor(incident.severity)}>
                      {incident.severity}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">
                        {formatIncidentType(incident.incident_type)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(incident.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  
                  <Badge variant="outline">
                    {incident.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Consentimento */}
      <TrackingConsentModal
        isOpen={showConsentModal}
        onConsent={handleConsent}
        freightId={freightId}
      />
    </div>
  );
}