import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import * as Dialog from '@radix-ui/react-dialog';
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Filter,
  Settings,
  Sparkles,
  Wrench,
  Truck,
  Circle,
  Zap,
  Key,
  Droplets,
  Paintbrush2,
  Snowflake,
  Target,
  TrendingUp,
  Banknote,
  Play,
  Eye,
  EyeOff,
  Brain
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ServiceRegionSelector } from '@/components/ServiceRegionSelector';
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';
import { ServiceProviderPayouts } from '@/components/ServiceProviderPayouts';
import ServiceProviderHeroDashboard from '@/components/ServiceProviderHeroDashboard';
import { LocationManager } from '@/components/LocationManager';
import { RegionalFreightFilter } from '@/components/RegionalFreightFilter';

interface ServiceRequest {
  id: string;
  client_id: string | null;
  service_type: string;
  location_address: string;
  location_address_safe?: string;
  problem_description: string;
  vehicle_info?: string;
  urgency: string;
  contact_phone: string;
  contact_phone_safe?: string;
  contact_name?: string;
  preferred_datetime?: string;
  additional_info?: string;
  is_emergency: boolean;
  estimated_price?: number;
  status: string;
  created_at: string;
  request_source?: string;
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
  const { user, profile, profiles } = useAuth();
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
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showSpecialtiesModal, setShowSpecialtiesModal] = useState(false);
  const [showAIServicesModal, setShowAIServicesModal] = useState(false);
  const [showSpatialAreasModal, setShowSpatialAreasModal] = useState(false);
  const [showEarnings, setShowEarnings] = useState(true);
  const [showHeroDashboard, setShowHeroDashboard] = useState(true);
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [regionalRequests, setRegionalRequests] = useState<ServiceRequest[]>([]);

  const getProviderProfileId = () => {
    if (profile?.role === 'PRESTADOR_SERVICOS') return profile.id;
    const alt = (profiles || []).find((p: any) => p.role === 'PRESTADOR_SERVICOS');
    return alt?.id as string | undefined;
  };

  useEffect(() => {
    if (user) {
      fetchServiceRequests();
      fetchStats();
    }
  }, [user, profile, profiles]);

  const fetchServiceRequests = async () => {
    const providerProfileId = getProviderProfileId();
    if (!user || !providerProfileId) {
      setRequests([]);
      return;
    }

    try {
      setLoading(true);
      
      // Primeiro, tentar buscar solicitações regionais se localização estiver configurada
      if ((profile as any)?.base_lat && (profile as any)?.base_lng) {
        // Usar filtro regional - priorizar solicitações na região
        setRegionalRequests(regionalRequests);
      }
      
      // Buscar solicitações de serviço para este prestador (backup/complemento)
      const { data: serviceRequests, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('provider_id', providerProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar perfis dos clientes separadamente
      const requestsWithProfiles = await Promise.all(
        (serviceRequests || []).map(async (request) => {
          let clientProfile = { full_name: 'Cliente', profile_photo_url: null };
          
          if (request.client_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, profile_photo_url')
              .eq('id', request.client_id)
              .single();
            
            if (profile) {
              clientProfile = profile;
            }
          }

          return {
            ...request,
            profiles: clientProfile
          };
        })
      );

      setRequests(requestsWithProfiles as ServiceRequest[]);
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
    const providerProfileId = getProviderProfileId();
    if (!user || !providerProfileId) {
      setStats({
        total_requests: 0,
        pending_requests: 0,
        accepted_requests: 0,
        completed_requests: 0,
        average_rating: 0,
        total_earnings: 0
      });
      return;
    }

    try {
      // Buscar estatísticas das solicitações
      const { data: requestStats, error: statsError } = await supabase
        .from('service_requests')
        .select('status, final_price')
        .eq('provider_id', providerProfileId);

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
      const providerProfileId = getProviderProfileId();
      if (!providerProfileId) return;

      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'ACCEPTED',
          provider_id: providerProfileId,
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
    { value: 'all', label: 'Todos os Serviços', icon: null },
    { value: 'GUINCHO', label: 'Guincho', icon: Truck },
    { value: 'MECANICO', label: 'Mecânico', icon: Wrench },
    { value: 'BORRACHEIRO', label: 'Borracheiro', icon: Circle },
    { value: 'AUTO_ELETRICA', label: 'Auto Elétrica', icon: Zap },
    { value: 'CHAVEIRO', label: 'Chaveiro', icon: Key },
    { value: 'COMBUSTIVEL', label: 'Combustível', icon: Droplets },
    { value: 'PINTURA', label: 'Pintura', icon: Paintbrush2 },
    { value: 'AR_CONDICIONADO', label: 'Ar Condicionado', icon: Snowflake },
    { value: 'PULVERIZACAO_DRONE', label: 'Pulverização por Drone', icon: Target }
  ];

  const filteredRequests = requests.filter(request => {
    let statusMatch = false;
    switch (activeTab) {
      case 'pending': statusMatch = request.status === 'PENDING'; break;
      case 'accepted': statusMatch = request.status === 'ACCEPTED'; break;
      case 'completed': statusMatch = request.status === 'COMPLETED'; break;
      case 'all': statusMatch = true; break;
      default: statusMatch = true;
    }
    
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

  // Show hero dashboard by default, toggle to detailed view
  if (showHeroDashboard) {
    return (
      <div>
        <ServiceProviderHeroDashboard />
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowHeroDashboard(false)}
              className="mb-4"
            >
              Ver Detalhes das Solicitações
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Back to Hero Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Detalhes das Solicitações</h2>
          <Button
            variant="outline"
            onClick={() => setShowHeroDashboard(true)}
          >
            Voltar ao Dashboard
          </Button>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <MessageSquare className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">Total</p>
                  <p className="text-lg font-bold">{stats.total_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-orange-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">Pendentes</p>
                  <p className="text-lg font-bold">{stats.pending_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">Completos</p>
                  <p className="text-lg font-bold">{stats.completed_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  <div className="ml-2 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">Ganhos</p>
                    <p className="text-sm font-bold">
                      {showEarnings 
                        ? new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL',
                            notation: 'compact',
                            maximumFractionDigits: 0
                          }).format(stats.total_earnings)
                        : '****'
                      }
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEarnings(!showEarnings)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger value="pending" className="text-xs">
                <Brain className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Pendentes</span>
                <span className="sm:hidden">Pend</span>
              </TabsTrigger>
              <TabsTrigger value="accepted" className="text-xs">
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Concluídos</span>
                <span className="sm:hidden">Ok</span>
              </TabsTrigger>
              <TabsTrigger value="areas" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Áreas</span>
                <span className="sm:hidden">Áreas</span>
              </TabsTrigger>
              <TabsTrigger value="payouts" className="text-xs">
                <Banknote className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Saldo</span>
                <span className="sm:hidden">Saldo</span>
              </TabsTrigger>
              <TabsTrigger value="regional" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Regional</span>
                <span className="sm:hidden">Região</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Solicitações Pendentes</h3>
              <Badge variant="secondary" className="text-xs">{filteredRequests.length}</Badge>
            </div>
            
            {filteredRequests.length > 0 ? (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">
                          {serviceTypes.find(t => t.value === request.service_type)?.label || request.service_type}
                        </h3>
                        <Badge variant={getUrgencyColor(request.urgency)} className="text-xs">
                          {request.urgency === 'URGENT' ? 'Urgente' : 
                           request.urgency === 'HIGH' ? 'Alto' :
                           request.urgency === 'MEDIUM' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleAcceptRequest(request.id)}
                        >
                          Aceitar Serviço
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma solicitação pendente.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Serviços em Andamento</h3>
              <Badge variant="secondary" className="text-xs">{requests.filter(r => r.status === 'ACCEPTED').length}</Badge>
            </div>
            
            {requests.filter(r => r.status === 'ACCEPTED').length > 0 ? (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'ACCEPTED').map((request) => (
                  <Card key={request.id} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">
                          {serviceTypes.find(t => t.value === request.service_type)?.label || request.service_type}
                        </h3>
                        <Badge variant="default" className="text-xs bg-green-600 text-white">
                          Em Andamento
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleCompleteRequest(request.id)}
                        >
                          Concluir Serviço
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum serviço em andamento.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Serviços Concluídos</h3>
              <Badge variant="secondary" className="text-xs">{requests.filter(r => r.status === 'COMPLETED').length}</Badge>
            </div>
            
            {requests.filter(r => r.status === 'COMPLETED').length > 0 ? (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'COMPLETED').map((request) => (
                  <Card key={request.id} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">
                          {serviceTypes.find(t => t.value === request.service_type)?.label || request.service_type}
                        </h3>
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          Concluído
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum serviço concluído ainda.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="areas" className="space-y-4">
            <ServiceProviderAreasManager />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <ServiceProviderPayouts providerId={getProviderProfileId() || ''} />
          </TabsContent>

          <TabsContent value="regional" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Solicitações Regionais</h3>
                <p className="text-sm text-muted-foreground">
                  Sistema de filtro inteligente por proximidade
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowLocationManager(true)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Configurar Região
              </Button>
            </div>
            
            <RegionalFreightFilter 
              userType="PRESTADOR_SERVICOS" 
              onFreightsLoaded={setRegionalRequests}
            />
          </TabsContent>
        </Tabs>

        {/* Modal de Configuração de Localização */}
        {showLocationManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <LocationManager onClose={() => setShowLocationManager(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};