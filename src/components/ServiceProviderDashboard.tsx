import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  TrendingUp,
  Brain,
  Play,
  DollarSign,
  Package,
  Eye,
  EyeOff,
  X,
  Banknote,
  Shield,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';
import { ServiceProviderPayouts } from '@/components/ServiceProviderPayouts';
import ServiceProviderHeroDashboard from '@/components/ServiceProviderHeroDashboard';
import { LocationManager } from '@/components/LocationManager';
import { RegionalFreightFilter } from '@/components/RegionalFreightFilter';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import heroLogistics from '@/assets/hero-logistics.jpg';

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
  profiles?: {
    full_name: string;
    profile_photo_url?: string;
    phone?: string;
  } | null;
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
  const [showEarnings, setShowEarnings] = useState(true);
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
  }, [user, profile]);

  const fetchServiceRequests = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          profiles (
            full_name,
            profile_photo_url,
            phone
          )
        `)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as any[] || []);
    } catch (error: any) {
      console.error('Error fetching service requests:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as solicitações",
        variant: "destructive"
      });
    }
  };

  const fetchStats = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('status, final_price')
        .eq('provider_id', providerId);

      if (error) throw error;

      const total = data.length;
      const pending = data.filter(r => r.status === 'OPEN' || r.status === 'PENDING').length;
      const accepted = data.filter(r => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS').length;
      const completed = data.filter(r => r.status === 'COMPLETED').length;
      const totalEarnings = data
        .filter(r => r.status === 'COMPLETED' && r.final_price)
        .reduce((sum, r) => sum + (r.final_price || 0), 0);

      setStats({
        total_requests: total,
        pending_requests: pending,
        accepted_requests: accepted,
        completed_requests: completed,
        average_rating: profile?.rating || 0,
        total_earnings: totalEarnings
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
          provider_id: getProviderProfileId()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação aceita com sucesso!"
      });
      
      fetchServiceRequests();
      fetchStats();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aceitar a solicitação",
        variant: "destructive"
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
        title: "Sucesso",
        description: "Serviço marcado como concluído!"
      });
      
      fetchServiceRequests();
      fetchStats();
    } catch (error: any) {
      console.error('Error completing request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar como concluído",
        variant: "destructive"
      });
    }
  };

  const serviceTypes = [
    { value: 'all', label: 'Todos os Serviços' },
    { value: 'MECANICO', label: 'Mecânico' },
    { value: 'ELETRICISTA_AUTOMOTIVO', label: 'Eletricista' },
    { value: 'BORRACHEIRO', label: 'Borracheiro' },
    { value: 'GUINCHO', label: 'Guincho' },
    { value: 'CHAVEIRO', label: 'Chaveiro' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'AR_CONDICIONADO', label: 'Ar Condicionado' },
    { value: 'FREIOS', label: 'Freios' },
    { value: 'SUSPENSAO', label: 'Suspensão' },
    { value: 'SOLDADOR', label: 'Soldador' },
    { value: 'PINTURA', label: 'Pintura' },
    { value: 'VIDRACEIRO', label: 'Vidraceiro' },
    { value: 'OUTROS', label: 'Outros' }
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  const filteredRequests = requests.filter(request => {
    if (serviceTypeFilter === 'all') return true;
    return request.service_type === serviceTypeFilter;
  }).filter(request => {
    if (activeTab === 'pending') return request.status === 'OPEN' || request.status === 'PENDING';
    if (activeTab === 'accepted') return request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS';
    if (activeTab === 'completed') return request.status === 'COMPLETED';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section Compacto */}
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-xl md:text-2xl font-bold mb-2">
              Olá, {profile?.full_name?.split(' ')[0] || 'Prestador'}
            </h1>
            <p className="text-sm md:text-base mb-4 opacity-90">
              Sistema IA conecta você com clientes
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('pending')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Brain className="mr-1 h-4 w-4" />
                Ver Solicitações
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setShowLocationManager(true)}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <MapPin className="mr-1 h-4 w-4" />
                Configurar Região
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('services')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Settings className="mr-1 h-4 w-4" />
                Configurar
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Pendentes
                  </p>
                  <p className="text-lg font-bold">{stats.pending_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Play className="h-6 w-6 text-orange-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Ativas
                  </p>
                  <p className="text-lg font-bold">{stats.accepted_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Concluídas
                  </p>
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
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Saldo
                    </p>
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
              <TabsTrigger value="services" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Serviços</span>
                <span className="sm:hidden">Serv</span>
              </TabsTrigger>
              <TabsTrigger value="payouts" className="text-xs">
                <Banknote className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Saldo</span>
                <span className="sm:hidden">Saldo</span>
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
                      
                      <div className="space-y-2 mb-3">
                        <p className="text-sm text-muted-foreground">
                          <strong>Problema:</strong> {request.problem_description}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {request.location_address}
                        </p>
                        {request.estimated_price && (
                          <p className="text-sm font-medium text-green-600">
                            Preço Estimado: R$ {request.estimated_price.toLocaleString('pt-BR')}
                          </p>
                        )}
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
              <Badge variant="secondary" className="text-xs">{requests.filter(r => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS').length}</Badge>
            </div>
            
            {requests.filter(r => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS').length > 0 ? (
              <div className="space-y-4">
                {requests.filter(r => r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS').map((request) => (
                  <Card key={request.id} className="shadow-sm border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">
                          {serviceTypes.find(t => t.value === request.service_type)?.label || request.service_type}
                        </h3>
                        <Badge variant="default" className="text-xs bg-orange-100 text-orange-800">
                          Em Andamento
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <p className="text-sm text-muted-foreground">
                          <strong>Cliente:</strong> {request.profiles?.full_name || 'Cliente'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {request.location_address}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
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

          <TabsContent value="services" className="space-y-4">
            <ServiceProviderServiceTypeManager />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <ServiceProviderPayouts providerId={getProviderProfileId() || ''} />
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