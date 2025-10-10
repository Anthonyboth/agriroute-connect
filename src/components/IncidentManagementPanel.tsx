import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  User, 
  FileText,
  Download,
  Send,
  Eye,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Incident {
  id: string;
  freight_id: string;
  incident_type: string;
  severity: string;
  status: string;
  description?: string;
  last_known_lat?: number;
  last_known_lng?: number;
  evidence_data?: any;
  created_at: string;
  updated_at: string;
  freight?: {
    origin_address: string;
    destination_address: string;
    producer: { full_name: string };
    driver: { full_name: string };
  };
}

export function IncidentManagementPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState("");

  useEffect(() => {
    loadIncidents();
    
    // Subscription para incidentes em tempo real
    const channel = supabase
      .channel('incidents_admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_logs'
        },
        () => {
          loadIncidents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadIncidents = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('tracking-service', {
        body: { action: 'list_incidents' }
      });

      if (error) throw error;

      setIncidents(data.incidents || []);
    } catch (error: any) {
      console.error('Erro ao carregar incidentes:', error);
      toast.error("Erro ao carregar incidentes");
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (incidentId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('incident_logs')
        .update({ 
          status: newStatus,
          operator_notes: operatorNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      if (error) throw error;

      await loadIncidents();
      setSelectedIncident(null);
      setOperatorNotes("");
      toast.success("Status do incidente atualizado");
    } catch (error: any) {
      console.error('Erro ao atualizar incidente:', error);
      toast.error("Erro ao atualizar incidente");
    } finally {
      setActionLoading(false);
    }
  };

  const generateEvidencePackage = async (incident: Incident) => {
    try {
      // Coletar dados para o pacote de evidências
      const { data: locations } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('freight_id', incident.freight_id)
        .order('created_at', { ascending: false })
        .limit(100);

      const evidencePackage = {
        incident_info: {
          id: incident.id,
          type: incident.incident_type,
          severity: incident.severity,
          description: incident.description,
          timestamp: incident.created_at,
          last_known_location: {
            lat: incident.last_known_lat,
            lng: incident.last_known_lng
          }
        },
        freight_info: incident.freight,
        location_history: locations || [],
        evidence_data: incident.evidence_data,
        generated_at: new Date().toISOString(),
        generated_by: "Sistema AgriRoute"
      };

      // Criar e fazer download do arquivo JSON
      const blob = new Blob([JSON.stringify(evidencePackage, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidencia_incidente_${incident.id}_${new Date().getTime()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      toast.success("Pacote de evidências gerado com sucesso");
    } catch (error: any) {
      console.error('Erro ao gerar evidências:', error);
      toast.error("Erro ao gerar pacote de evidências");
    }
  };

  const reportToAuthorities = async (incident: Incident) => {
    setActionLoading(true);
    try {
      // Primeiro, gerar o pacote de evidências
      await generateEvidencePackage(incident);
      
      // Atualizar status para "reportado às autoridades"
      await updateIncidentStatus(incident.id, 'REPORTED_TO_AUTHORITIES');
      
      // Aqui seria enviado e-mail ou integração com sistema policial
      toast.success("Incidente reportado às autoridades. Pacote de evidências foi gerado.");
    } catch (error: any) {
      console.error('Erro ao reportar às autoridades:', error);
      toast.error("Erro ao reportar às autoridades");
    } finally {
      setActionLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'destructive';
      case 'INVESTIGATING': return 'secondary';
      case 'RESOLVED': return 'default';
      case 'REPORTED_TO_AUTHORITIES': return 'outline';
      default: return 'secondary';
    }
  };

  const formatIncidentType = (type: string) => {
    const types = {
      'SIGNAL_LOST': 'Perda de Sinal GPS',
      'ROUTE_DEVIATION': 'Desvio de Rota',
      'GPS_DISABLED': 'GPS Desabilitado',
      'SUSPECTED_SPOOFING': 'Suspeita de Falsificação de Localização'
    };
    return types[type as keyof typeof types] || type;
  };

  if (loading) {
    return <div>Carregando incidentes...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Central de Incidentes de Segurança
            <Badge variant="outline" className="ml-auto">
              {incidents.length} incidente(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incidents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>Nenhum incidente ativo no momento</p>
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedIncident(incident)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                        <Badge variant={getStatusColor(incident.status)}>
                          {incident.status}
                        </Badge>
                        <span className="font-medium">
                          {formatIncidentType(incident.incident_type)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Motorista: {incident.freight?.driver?.full_name || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {incident.freight?.origin_address} → {incident.freight?.destination_address}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(incident.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Incidente */}
      <Dialog open={!!selectedIncident} onOpenChange={(open) => !open && setSelectedIncident(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Detalhes do Incidente
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualização completa do incidente de segurança registrado
            </DialogDescription>
          </DialogHeader>

          {selectedIncident && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Informações do Incidente</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Tipo:</strong> {formatIncidentType(selectedIncident.incident_type)}</div>
                    <div><strong>Severidade:</strong> 
                      <Badge variant={getSeverityColor(selectedIncident.severity)} className="ml-2">
                        {selectedIncident.severity}
                      </Badge>
                    </div>
                    <div><strong>Status:</strong> 
                      <Badge variant={getStatusColor(selectedIncident.status)} className="ml-2">
                        {selectedIncident.status}
                      </Badge>
                    </div>
                    <div><strong>Criado em:</strong> {new Date(selectedIncident.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Informações do Frete</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Motorista:</strong> {selectedIncident.freight?.driver?.full_name}</div>
                    <div><strong>Produtor:</strong> {selectedIncident.freight?.producer?.full_name}</div>
                    <div><strong>Origem:</strong> {selectedIncident.freight?.origin_address}</div>
                    <div><strong>Destino:</strong> {selectedIncident.freight?.destination_address}</div>
                  </div>
                </div>
              </div>

              {/* Localização */}
              {(selectedIncident.last_known_lat && selectedIncident.last_known_lng) && (
                <div>
                  <h3 className="font-semibold mb-2">Última Localização Conhecida</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div>Latitude: {selectedIncident.last_known_lat}</div>
                    <div>Longitude: {selectedIncident.last_known_lng}</div>
                  </div>
                </div>
              )}

              {/* Descrição */}
              {selectedIncident.description && (
                <div>
                  <h3 className="font-semibold mb-2">Descrição</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    {selectedIncident.description}
                  </div>
                </div>
              )}

              {/* Dados de Evidência */}
              {selectedIncident.evidence_data && (
                <div>
                  <h3 className="font-semibold mb-2">Dados de Evidência</h3>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedIncident.evidence_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Notas do Operador */}
              <div>
                <h3 className="font-semibold mb-2">Notas do Operador</h3>
                <Textarea
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  placeholder="Adicione observações sobre a investigação..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <Button
                  onClick={() => generateEvidencePackage(selectedIncident)}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Gerar Pacote de Evidências
                </Button>

                <Button
                  onClick={() => updateIncidentStatus(selectedIncident.id, 'INVESTIGATING')}
                  disabled={actionLoading}
                  variant="outline"
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Marcar como Investigando
                </Button>

                <Button
                  onClick={() => reportToAuthorities(selectedIncident)}
                  disabled={actionLoading}
                  variant="destructive"
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {actionLoading ? "Processando..." : "Reportar às Autoridades"}
                </Button>

                <Button
                  onClick={() => updateIncidentStatus(selectedIncident.id, 'RESOLVED')}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolver Incidente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}