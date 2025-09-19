import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  Clock, 
  Phone, 
  User, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  Star,
  AlertCircle,
  Calendar,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ServiceRequest {
  id: string;
  client_id: string;
  service_type: string;
  location_address: string;
  problem_description: string;
  vehicle_info?: string;
  urgency: string;
  contact_phone: string;
  contact_name?: string;
  preferred_datetime?: string;
  additional_info?: string;
  is_emergency: boolean;
  estimated_price?: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    profile_photo_url?: string;
    phone?: string;
  };
}

interface ServiceProviderStats {
  total_requests: number;
  pending_requests: number;
  accepted_requests: number;
  completed_requests: number;
  average_rating: number;
  total_earnings: number;
}

export const ServiceProviderDashboard: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [stats, setStats] = useState<ServiceProviderStats>({
    total_requests: 0,
    pending_requests: 0,
    accepted_requests: 0,
    completed_requests: 0,
    average_rating: 0,
    total_earnings: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchServiceRequests();
      fetchStats();
    }
  }, [user]);

  const fetchServiceRequests = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Usar a nova função segura que protege dados sensíveis
      const { data: secureRequests, error } = await supabase
        .rpc('get_provider_service_requests', {
          provider_profile_id: profile.id
        });

      if (error) throw error;

      // Buscar os dados dos clientes separadamente (dados não sensíveis)
      const requestsWithProfiles = await Promise.all(
        (secureRequests || []).map(async (request) => {
          const { data: clientProfile } = await supabase
            .from('profiles')
            .select('full_name, profile_photo_url')
            .eq('id', request.client_id)
            .single();

          return {
            ...request,
            // Usar dados seguros da função RPC
            contact_phone: request.contact_phone_safe,
            location_address: request.location_address_safe,
            profiles: clientProfile || {
              full_name: 'Cliente',
              profile_photo_url: null,
              phone: null
            }
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar solicitações de serviços.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Buscar estatísticas das solicitações com timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      const fetchPromise = supabase
        .from('service_requests')
        .select('status, final_price')
        .eq('provider_id', profile.id);

      const { data: requestStats, error: statsError } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      if (statsError) throw statsError;

      const totalRequests = requestStats?.length || 0;
      const pendingRequests = requestStats?.filter(r => r.status === 'PENDING').length || 0;
      const acceptedRequests = requestStats?.filter(r => r.status === 'ACCEPTED').length || 0;
      const completedRequests = requestStats?.filter(r => r.status === 'COMPLETED').length || 0;
      const totalEarnings = requestStats?.filter(r => r.final_price).reduce((sum, r) => sum + (r.final_price || 0), 0) || 0;

      setStats({
        total_requests: totalRequests,
        pending_requests: pendingRequests,
        accepted_requests: acceptedRequests,
        completed_requests: completedRequests,
        average_rating: 0, // TODO: Implementar sistema de avaliações
        total_earnings: totalEarnings
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      // Definir stats padrão em caso de erro
      setStats({
        total_requests: 0,
        pending_requests: 0,
        accepted_requests: 0,
        completed_requests: 0,
        average_rating: 0,
        total_earnings: 0
      });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Solicitação aceita!",
        description: "Você aceitou a solicitação de serviço. Entre em contato com o cliente.",
      });

      fetchServiceRequests();
      fetchStats();
    } catch (error) {
      console.error('Erro ao aceitar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao aceitar solicitação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Serviço concluído!",
        description: "O serviço foi marcado como concluído.",
      });

      fetchServiceRequests();
      fetchStats();
    } catch (error) {
      console.error('Erro ao concluir serviço:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir serviço. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'ACCEPTED': return 'default';
      case 'COMPLETED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'secondary';
    }
  };

  const serviceTypes = [
    { value: 'all', label: 'Todos os Serviços' },
    { value: 'BORRACHEIRO', label: 'Borracheiro' },
    { value: 'CHAVEIRO', label: 'Chaveiro' },
    { value: 'AUTO_ELETRICA', label: 'Auto Elétrica' },
    { value: 'MECANICO', label: 'Mecânico' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'GUINCHO', label: 'Guincho' },
    { value: 'ELETRICISTA_AUTOMOTIVO', label: 'Eletricista Automotivo' },
    { value: 'SOLDADOR', label: 'Soldador' },
    { value: 'PINTURA', label: 'Pintura' },
    { value: 'VIDRACEIRO', label: 'Vidraceiro' },
    { value: 'AR_CONDICIONADO', label: 'Ar Condicionado' },
    { value: 'FREIOS', label: 'Freios' },
    { value: 'SUSPENSAO', label: 'Suspensão' }
  ];

  const filteredRequests = requests.filter(request => {
    // Filtro por status
    let statusMatch = false;
    switch (activeTab) {
      case 'pending': statusMatch = request.status === 'PENDING'; break;
      case 'accepted': statusMatch = request.status === 'ACCEPTED'; break;
      case 'completed': statusMatch = request.status === 'COMPLETED'; break;
      case 'all': statusMatch = true; break;
      default: statusMatch = true;
    }
    
    // Filtro por tipo de serviço
    const serviceMatch = serviceTypeFilter === 'all' || request.service_type === serviceTypeFilter;
    
    return statusMatch && serviceMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500 rounded-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total de Solicitações</p>
                <p className="text-2xl font-bold">{stats.total_requests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pending_requests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">{stats.completed_requests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Star className="h-5 w-5 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Ganhos Totais</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.total_earnings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Solicitações */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Serviço</CardTitle>
          <CardDescription>
            Gerencie suas solicitações de serviços
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtro por Tipo de Serviço */}
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por tipo de serviço" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((serviceType) => (
                  <SelectItem key={serviceType.value} value={serviceType.value}>
                    {serviceType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes ({stats.pending_requests})</TabsTrigger>
              <TabsTrigger value="accepted">Aceitas ({stats.accepted_requests})</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((request) => (
                    <Card key={request.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.profiles.profile_photo_url} />
                              <AvatarFallback>
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{request.profiles.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDateTime(request.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getUrgencyColor(request.urgency)}>
                              {request.urgency}
                            </Badge>
                            <Badge variant={getStatusColor(request.status)}>
                              {request.status}
                            </Badge>
                            {request.is_emergency && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                EMERGÊNCIA
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Serviço:</p>
                            <p className="text-sm text-muted-foreground">
                              {request.service_type.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Local:</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {request.location_address}
                            </p>
                          </div>
                          {request.vehicle_info && (
                            <div>
                              <p className="text-sm font-medium mb-1">Veículo:</p>
                              <p className="text-sm text-muted-foreground">{request.vehicle_info}</p>
                            </div>
                          )}
                          {request.preferred_datetime && (
                            <div>
                              <p className="text-sm font-medium mb-1">Data preferida:</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDateTime(request.preferred_datetime)}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium mb-1">Descrição do problema:</p>
                          <p className="text-sm text-muted-foreground">{request.problem_description}</p>
                        </div>

                        {request.additional_info && (
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-1">Informações adicionais:</p>
                            <p className="text-sm text-muted-foreground">{request.additional_info}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const phone = request.contact_phone.replace(/\D/g, '');
                                const message = encodeURIComponent(
                                  `Olá ${request.contact_name || request.profiles.full_name}! Sou prestador de serviços do AgriRoute e recebi sua solicitação de ${request.service_type.replace(/_/g, ' ').toLowerCase()}. Vamos conversar sobre os detalhes?`
                                );
                                window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                              }}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Ligar/WhatsApp
                            </Button>
                          </div>

                           <div className="flex gap-2">
                             {request.status === 'PENDING' && (
                               <Button 
                                 size="sm"
                                 onClick={() => handleAcceptRequest(request.id)}
                               >
                                 <CheckCircle className="h-4 w-4 mr-2" />
                                 Aceitar
                               </Button>
                             )}
                             {request.status === 'ACCEPTED' && (
                               <Button 
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleCompleteRequest(request.id)}
                               >
                                 <CheckCircle className="h-4 w-4 mr-2" />
                                 Marcar como Concluído
                               </Button>
                             )}
                              {/* Mostrar indicador de dados protegidos */}
                              {request.contact_phone?.includes('***') && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                  🔒 Dados protegidos
                                </Badge>
                              )}
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};