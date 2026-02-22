import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
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
import { normalizeServiceType } from '@/lib/pt-br-validator';
import { isFreightType } from '@/lib/item-classification';

interface ServiceRequest {
  id: string;
  service_type: string;
  contact_name: string;
  contact_phone: string;
  location_address: string;
  location_city: string | null;
  location_state: string | null;
  city_name?: string;
  state?: string;
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

// Helper para sempre mostrar a cidade, não o endereço específico
const getDisplayLocation = (service: ServiceRequest): string => {
  // Prioridade 1: city_name + state
  if (service.city_name && service.state) {
    return `${service.city_name}, ${service.state}`;
  }
  
  // Prioridade 2: location_city + location_state
  if (service.location_city && service.location_state) {
    return `${service.location_city}, ${service.location_state}`;
  }
  
  // Prioridade 3: city_name ou location_city sozinho
  if (service.city_name) return service.city_name;
  if (service.location_city) return service.location_city;
  
  // Prioridade 4: Tentar extrair do location_address
  if (service.location_address?.includes(',')) {
    const match = service.location_address.match(/([^,]+),\s*([A-Z]{2})/);
    if (match) {
      return `${match[1].trim()}, ${match[2]}`;
    }
  }
  
  return service.location_address || 'Localização não especificada';
};

export const ServiceHistory: React.FC = () => {
  const { profile } = useAuth();
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [mainTab, setMainTab] = useState<'provided' | 'requested'>('provided'); // Para prestadores

  useEffect(() => {
    if (profile?.id) {
      fetchServices();
    }
  }, [profile?.id, mainTab]);

  const fetchServices = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // ✅ SEGURANÇA: Usar view segura para proteção de PII
      let query = supabase
        .from('service_requests_secure')
        .select('*')
        .order('created_at', { ascending: false });

      // Para MOTORISTA: mostrar apenas serviços que ELE SOLICITOU (client_id)
      // Serviços prestados (provider_id + GUINCHO/MUDANCA) vão para FreightHistory
      if (profile.role === 'MOTORISTA') {
        query = query.eq('client_id', profile.id);
      } else if (profile.role === 'PRESTADOR_SERVICOS') {
        if (mainTab === 'provided') {
          query = query.eq('provider_id', profile.id);
        } else {
          query = query.eq('client_id', profile.id);
        }
      } else {
        // Para outros roles (PRODUTOR), mostrar serviços que solicitou
        query = query.eq('client_id', profile.id);
      }

      const { data: serviceRequests, error } = await query;

      if (error) throw error;

      // ✅ P0 FIX: FILTRAR tipos de FRETE - eles NÃO devem aparecer no histórico de SERVIÇOS
      // Apenas serviços NÃO-frete devem aparecer aqui
      const filteredRequests = (serviceRequests || []).filter(
        item => !isFreightType(item.service_type)
      );
      
      if (import.meta.env.DEV) {
        const removedCount = (serviceRequests?.length || 0) - filteredRequests.length;
        if (removedCount > 0) {
          console.log('[ServiceHistory] ✅ Removidos', removedCount, 'itens de FRETE do histórico de serviços');
        }
      }

      // Buscar dados dos clientes e prestadores separadamente
      const clientIds = [...new Set(filteredRequests.map(s => s.client_id).filter(Boolean))];
      const providerIds = [...new Set(filteredRequests.map(s => s.provider_id).filter(Boolean))];

      const { data: clientProfiles } = await supabase
        .from('profiles_secure')
        .select('id, full_name')
        .in('id', clientIds);

      const { data: providerProfiles } = await supabase
        .from('profiles_secure')
        .select('id, full_name')
        .in('id', providerIds);

      // Mapear profiles por ID
      const clientMap = new Map(clientProfiles?.map(p => [p.id, p]) || []);
      const providerMap = new Map(providerProfiles?.map(p => [p.id, p]) || []);
      
      // Combinar dados
      const transformedData = filteredRequests.map(item => ({
        ...item,
        client: item.client_id ? clientMap.get(item.client_id) : undefined,
        provider: item.provider_id ? providerMap.get(item.provider_id) : undefined
      }));
      
      setServices(transformedData as ServiceRequest[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico de serviços');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelService = async (serviceId: string) => {
    const confirmed = window.confirm(
      '⚠️ Tem certeza que deseja cancelar esta solicitação de serviço?\n\n' +
      'Esta ação não pode ser desfeita.'
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId)
        .eq('client_id', profile?.id);

      if (error) throw error;

      toast.success('Serviço cancelado com sucesso');
      fetchServices();
    } catch (error) {
      console.error('Erro ao cancelar serviço:', error);
      toast.error('Erro ao cancelar serviço');
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
    return <CenteredSpinner size="lg" />;
  }

  const isPrestador = profile?.role === 'PRESTADOR_SERVICOS';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Serviços
          </CardTitle>
          <CardDescription>
            {isPrestador 
              ? 'Visualize os serviços que você forneceu e solicitou'
              : 'Visualize todos os seus serviços solicitados'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Tabs principais para prestador de serviços */}
          {isPrestador && (
            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'provided' | 'requested')} className="mb-4">
              <div className="w-full overflow-x-auto pb-2">
                <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
                  <TabsTrigger 
                    value="provided"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                  >
                    Serviços Fornecidos
                  </TabsTrigger>
                  <TabsTrigger 
                    value="requested"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                  >
                    Serviços Solicitados
                  </TabsTrigger>
                </TabsList>
              </div>
            </Tabs>
          )}

          {/* Tabs de filtro por status */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="w-full overflow-x-auto pb-2">
              <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
                <TabsTrigger 
                  value="all"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                >
                  Todos ({services.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="open"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                >
                  Ativos ({services.filter(s => ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(s.status)).length})
                </TabsTrigger>
                <TabsTrigger 
                  value="completed"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                >
                  Concluídos ({services.filter(s => s.status === 'COMPLETED').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="cancelled"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
                >
                  Cancelados ({services.filter(s => s.status === 'CANCELLED').length})
                </TabsTrigger>
              </TabsList>
            </div>

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
                    <Card key={service.id} className="hover:shadow-md transition-shadow overflow-x-auto">
                      <CardHeader className="pb-3">
                        {/* LINHA 1: Título e Badges */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
                          <CardTitle className="text-lg whitespace-nowrap">
                            {normalizeServiceType(service.service_type)}
                          </CardTitle>
                          <Badge variant={statusBadge.variant} className="shrink-0">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusBadge.label}
                          </Badge>
                          <Badge variant={urgencyBadge.variant} className="shrink-0">
                            {urgencyBadge.label}
                          </Badge>
                        </div>

                        {/* LINHA 2: Descrição e Botão CANCELAR */}
                        <div className="flex items-center justify-between gap-3">
                          <CardDescription className="flex-1 min-w-0">
                            {isClient ? 'Serviço Solicitado' : 'Serviço Prestado'}
                          </CardDescription>
                          
                          {/* Botão Cancelar - sempre visível, sem sobreposição */}
                          {isClient && ['OPEN', 'ACCEPTED'].includes(service.status) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelService(service.id)}
                              className="shrink-0 min-w-[120px]"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              CANCELAR
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 overflow-x-auto">
                        <div className="min-w-fit">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="font-medium">Local:</p>
                                <p className="text-muted-foreground">{getDisplayLocation(service)}</p>
                                {service.location_address && 
                                 service.location_address !== getDisplayLocation(service) && (
                                  <p className="text-muted-foreground text-xs">
                                    Local específico: {service.location_address}
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
              {selectedService && normalizeServiceType(selectedService.service_type)}
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
