import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  MessageSquare, 
  MapPin, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { ServiceChat } from './ServiceChat';

interface ServiceRequest {
  id: string;
  service_type: string;
  contact_name: string;
  contact_phone: string;
  location_address: string;
  location_city: string | null;
  location_state: string | null;
  problem_description: string;
  urgency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  client?: {
    id: string;
    full_name: string;
  };
  provider?: {
    id: string;
    full_name: string;
  };
}

export const ServiceHistory: React.FC = () => {
  const { profile } = useAuth();
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (profile?.id) {
      fetchServices();
    }
  }, [profile?.id]);

  const fetchServices = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          client:profiles!service_requests_client_id_fkey(id, full_name),
          provider:profiles!service_requests_provider_id_fkey(id, full_name)
        `)
        .or(`client_id.eq.${profile.id},provider_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match interface
      const transformedData = (data || []).map(item => ({
        ...item,
        client: Array.isArray(item.client) && item.client.length > 0 ? item.client[0] : undefined,
        provider: Array.isArray(item.provider) && item.provider.length > 0 ? item.provider[0] : undefined
      }));
      
      setServices(transformedData as ServiceRequest[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico de serviços');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      'OPEN': { label: 'Aberto', variant: 'default', icon: AlertCircle },
      'ACCEPTED': { label: 'Aceito', variant: 'secondary', icon: CheckCircle },
      'IN_PROGRESS': { label: 'Em Progresso', variant: 'secondary', icon: Clock },
      'COMPLETED': { label: 'Concluído', variant: 'outline', icon: CheckCircle },
      'CANCELLED': { label: 'Cancelado', variant: 'destructive', icon: XCircle }
    };
    return statusMap[status] || { label: status, variant: 'default', icon: AlertCircle };
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'LOW': { label: 'Baixa', variant: 'secondary' },
      'MEDIUM': { label: 'Média', variant: 'default' },
      'HIGH': { label: 'Alta', variant: 'destructive' }
    };
    return urgencyMap[urgency] || { label: urgency, variant: 'default' };
  };

  const getServiceTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'GUINCHO': 'Guincho',
      'MUDANCA': 'Mudança',
      'MECANICO': 'Mecânico',
      'BORRACHEIRO': 'Borracheiro',
      'ELETRICISTA_AUTOMOTIVO': 'Eletricista Automotivo',
      'COMBUSTIVEL': 'Entrega de Combustível',
      'CHAVEIRO': 'Chaveiro',
      'SOLDADOR': 'Soldador',
      'PINTURA': 'Pintura',
      'VIDRACEIRO': 'Vidraceiro',
      'AR_CONDICIONADO': 'Ar Condicionado',
      'FREIOS': 'Freios',
      'SUSPENSAO': 'Suspensão'
    };
    return typeMap[type] || type;
  };

  const filteredServices = services.filter(service => {
    if (activeTab === 'all') return true;
    if (activeTab === 'open') return ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(service.status);
    if (activeTab === 'completed') return service.status === 'COMPLETED';
    if (activeTab === 'cancelled') return service.status === 'CANCELLED';
    return true;
  });

  const openChatDialog = (service: ServiceRequest) => {
    setSelectedService(service);
    setShowChatDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Serviços
          </CardTitle>
          <CardDescription>
            Visualize todos os seus serviços solicitados ou prestados
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos ({services.length})</TabsTrigger>
              <TabsTrigger value="open">
                Ativos ({services.filter(s => ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(s.status)).length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Concluídos ({services.filter(s => s.status === 'COMPLETED').length})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelados ({services.filter(s => s.status === 'CANCELLED').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-4">
              {filteredServices.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum serviço encontrado</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' && 'Você ainda não solicitou ou prestou nenhum serviço.'}
                    {activeTab === 'open' && 'Não há serviços ativos no momento.'}
                    {activeTab === 'completed' && 'Nenhum serviço foi concluído ainda.'}
                    {activeTab === 'cancelled' && 'Nenhum serviço foi cancelado.'}
                  </p>
                </div>
              ) : (
                filteredServices.map((service) => {
                  const statusBadge = getStatusBadge(service.status);
                  const urgencyBadge = getUrgencyBadge(service.urgency);
                  const StatusIcon = statusBadge.icon;
                  const isClient = service.client?.id === profile?.id;

                  return (
                    <Card key={service.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">
                                {getServiceTypeLabel(service.service_type)}
                              </CardTitle>
                              <Badge variant={statusBadge.variant}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusBadge.label}
                              </Badge>
                              <Badge variant={urgencyBadge.variant}>
                                {urgencyBadge.label}
                              </Badge>
                            </div>
                            <CardDescription>
                              {isClient ? 'Serviço Solicitado' : 'Serviço Prestado'}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Local:</p>
                              <p className="text-muted-foreground">{service.location_address}</p>
                              {service.location_city && service.location_state && (
                                <p className="text-muted-foreground text-xs">
                                  {service.location_city}, {service.location_state}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Data:</p>
                              <p className="text-muted-foreground">
                                {format(new Date(service.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {service.completed_at && (
                                <p className="text-muted-foreground text-xs">
                                  Concluído: {format(new Date(service.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {service.problem_description && (
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium mb-1">Descrição:</p>
                            <p className="text-sm text-muted-foreground">{service.problem_description}</p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openChatDialog(service)}
                            className="flex-1"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de Chat */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedService && getServiceTypeLabel(selectedService.service_type)}
            </DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="h-[60vh]">
              <ServiceChat 
                serviceRequestId={selectedService.id}
                currentUserProfile={profile}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
