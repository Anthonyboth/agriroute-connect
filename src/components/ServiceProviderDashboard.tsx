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
import { useServiceRequestCounts } from '@/hooks/useServiceRequestCounts';
import { ContactInfoCard } from '@/components/ContactInfoCard';
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';
import { ServiceProviderPayouts } from '@/components/ServiceProviderPayouts';
import ServiceProviderHeroDashboard from '@/components/ServiceProviderHeroDashboard';
import { LocationManager } from '@/components/LocationManager';
import { RegionalFreightFilter } from '@/components/RegionalFreightFilter';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import { ProviderCityManager } from '@/components/ProviderCityManager';
import heroLogistics from '@/assets/hero-logistics.jpg';

interface ServiceRequest {
  id: string;
  client_id: string | null;
  provider_id: string | null;
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
  final_price?: number;
  status: string;
  created_at: string;
  updated_at?: string;
  accepted_at?: string;
  completed_at?: string;
  request_source?: string;
  profiles?: {
    id: string;
    full_name: string;
    profile_photo_url?: string;
    phone?: string;
    user_id?: string;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showEarnings, setShowEarnings] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [totalEarnings, setTotalEarnings] = useState(0);

  const getProviderProfileId = () => {
    if (profile?.role === 'PRESTADOR_SERVICOS') return profile.id;
    const alt = (profiles || []).find((p: any) => p.role === 'PRESTADOR_SERVICOS');
    return alt?.id as string | undefined;
  };
  
  const providerId = getProviderProfileId();
  const { counts, refreshCounts } = useServiceRequestCounts(providerId);

  useEffect(() => {
    if (!profile?.id || profile.role !== 'PRESTADOR_SERVICOS') return;

    // Buscar dados iniciais
    fetchServiceRequests();
    fetchTotalEarnings();

    // Configurar realtime para service_requests
    const channel = supabase
      .channel('service-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'service_requests'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Recarregar dados quando houver mudanças
          fetchServiceRequests();
          refreshCounts();
        }
      )
      .subscribe();

    // Refresh automático a cada 10 segundos como fallback
    const interval = setInterval(() => {
      fetchServiceRequests();
      refreshCounts();
      fetchTotalEarnings();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, profile]);

  const fetchServiceRequests = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) return;

    try {
      // Buscar tipos de serviço do prestador (preferir profiles.service_types; fallback para service_providers.service_type)
      // IMPORTANTE: Filtrar apenas serviços não relacionados a transporte (freight)
      let providerServiceTypes: string[] | null = null;
      // Tentar via profiles
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('service_types')
        .eq('id', providerId)
        .single();
      if (!profileErr && profileData?.service_types && Array.isArray(profileData.service_types)) {
        const allTypes = profileData.service_types as unknown as string[];
        console.log('🔧 PRESTADOR - Tipos de serviço brutos:', allTypes);
        // Filtrar apenas serviços que não são de transporte/freight
        providerServiceTypes = allTypes.filter(type => !['CARGA', 'GUINCHO', 'MUDANCA'].includes(type));
        console.log('🔧 PRESTADOR - Tipos filtrados (sem transporte):', providerServiceTypes);
      } else {
        // Fallback legado: tabela service_providers com único service_type
        const { data: providerData, error: providerDataError } = await supabase
          .from('service_providers')
          .select('service_type')
          .eq('profile_id', providerId)
          .single();
        if (!providerDataError && providerData?.service_type) {
          console.log('🔧 PRESTADOR - Service type legado:', providerData.service_type);
          // Filtrar apenas se não for serviço de transporte
          if (!['CARGA', 'GUINCHO', 'MUDANCA'].includes(providerData.service_type)) {
            providerServiceTypes = [providerData.service_type];
            console.log('🔧 PRESTADOR - Service type aceito:', providerServiceTypes);
          } else {
            providerServiceTypes = []; // Não mostrar serviços de transporte
            console.log('🔧 PRESTADOR - Service type rejeitado (é transporte)');
          }
        }
      }
      // Se não houver tipos configurados ou todos foram filtrados, usar apenas serviços técnicos/agrícolas/logística
      const hasTypeFilter = Array.isArray(providerServiceTypes) && providerServiceTypes.length > 0;

      // Buscar solicitações do prestador (aceitas/em andamento/concluídas)
      const { data: providerRequests, error: providerError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (providerError) throw providerError;

      // Buscar solicitações pendentes por cidade usando a nova função
      const { data: cityBasedRequests, error: cityError } = await supabase
        .rpc('get_service_requests_by_city', {
          provider_profile_id: providerId
        });

      if (cityError) {
        console.warn('City-based search failed, falling back to direct search:', cityError);
        
        // Fallback: busca direta por solicitações pendentes (filtra por tipo se houver)
        let directQuery = supabase
          .from('service_requests')
          .select('*') 
          .is('provider_id', null)
          .eq('status', 'OPEN')
          // Sempre excluir serviços de transporte do painel de prestadores
          .not('service_type', 'in', '(CARGA,GUINCHO,MUDANCA)');
        if (hasTypeFilter && providerServiceTypes && providerServiceTypes.length > 0) {
          directQuery = directQuery.in('service_type', providerServiceTypes);
        }
        const { data: directPendingRequests, error: directPendingError } = await directQuery
          .order('created_at', { ascending: true }); // Mais antigas primeiro

        console.log('🔧 PRESTADOR - Busca direta excluindo transporte:', directPendingRequests?.length || 0);
        console.log('🔧 PRESTADOR - Tipos encontrados na busca direta:', directPendingRequests?.map(r => r.service_type));

        if (directPendingError) throw directPendingError;

        // Combinar resultados
        const byId = new Map<string, ServiceRequest>();
        (providerRequests || []).forEach((r: any) => byId.set(r.id, r as ServiceRequest));
        
        (directPendingRequests || []).forEach((r: any) => {
          const serviceRequest: ServiceRequest = {
            ...r,
            provider_id: null,
            profiles: null
          };
          byId.set(r.id, serviceRequest);
        });
        
        const allRequests = Array.from(byId.values());
        setRequests(allRequests);
        setLastRefresh(new Date());
        setLoading(false);
        
        console.log(`Loaded ${allRequests.length} service requests (fallback mode + service type filtered)`, {
          providerRequests: (providerRequests || []).length,
          directPending: (directPendingRequests || []).length,
          providerServiceTypes: providerServiceTypes
        });
        
        return;
      }

      // Usar resultados da busca por cidade, filtrando pelos tipos do prestador (se houver)
      const pendingCityRequests = (cityBasedRequests || [])
        .filter((r: any) => !hasTypeFilter || (providerServiceTypes as string[]).includes(r.service_type))
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Mais antigas primeiro

      // Combinar e deduplicar por id
      const byId = new Map<string, ServiceRequest>();
      
      // Adicionar solicitações do prestador
      (providerRequests || []).forEach((r: any) => byId.set(r.id, r as ServiceRequest));
      
      // Adicionar solicitações pendentes baseadas em cidade
      pendingCityRequests.forEach((r: any) => {
        const serviceRequest: ServiceRequest = {
          ...r,
          provider_id: null,
          profiles: null // Dados de contato só ficam disponíveis após aceitar
        };
        byId.set(r.id, serviceRequest);
      });
      
      const allRequests = Array.from(byId.values());
      setRequests(allRequests);
      setLastRefresh(new Date());
      setLoading(false);
      
      console.log(`Loaded ${allRequests.length} service requests (city-based + service type filtered)`, {
        providerRequests: (providerRequests || []).length,
        cityBasedPending: pendingCityRequests.length,
        providerServiceTypes: providerServiceTypes
      });
      
    } catch (error: any) {
      console.error('Error fetching service requests:', error);
      setLoading(false);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as solicitações",
        variant: "destructive"
      });
    }
  };

  const fetchTotalEarnings = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('final_price')
        .eq('provider_id', providerId)
        .eq('status', 'COMPLETED');

      if (error) throw error;

      const total = (data || [])
        .filter(r => r.final_price)
        .reduce((sum, r) => sum + (r.final_price || 0), 0);

      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const providerId = getProviderProfileId();
      if (!providerId) {
        toast({
          title: "Erro",
          description: "Perfil de prestador não encontrado.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: providerId,
        p_request_id: requestId,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Solicitação indisponível ou já aceita.');
      }

      toast({
        title: "Sucesso",
        description: "Solicitação aceita com sucesso!",
      });

      fetchServiceRequests();
      refreshCounts();
      fetchTotalEarnings();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível aceitar a solicitação",
        variant: "destructive",
      });
    }
  };

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) throw new Error('Solicitação não encontrada');

      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          final_price: request.estimated_price // Definir o preço final como o estimado
        })
        .eq('id', requestId);

      if (error) throw error;

      // Simular pagamento para o prestador
      await simulatePayment(requestId, request.estimated_price || 0);

      toast({
        title: "Sucesso",
        description: `Serviço concluído! Você receberá R$ ${(request.estimated_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });
      
      fetchServiceRequests();
      refreshCounts();
      fetchTotalEarnings();
    } catch (error: any) {
      console.error('Error completing request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar como concluído",
        variant: "destructive"
      });
    }
  };

  const simulatePayment = async (requestId: string, amount: number) => {
    try {
      // Em um sistema real, aqui seria integrado com Stripe ou outro gateway de pagamento
      // Por enquanto, vamos apenas log da simulação
      console.log(`Pagamento simulado: R$ ${amount} para solicitação ${requestId}`);
      
      // TODO: Integrar com sistema de pagamentos real
      // await processPaymentToProvider(providerId, amount, requestId);
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
    }
  };

  const serviceTypes = [
    { value: 'all', label: 'Todos os Serviços' },
    { value: 'MECANICO', label: 'Mecânico' },
    { value: 'ELETRICISTA_AUTOMOTIVO', label: 'Eletricista' },
    { value: 'BORRACHEIRO', label: 'Borracheiro' },
    { value: 'CHAVEIRO', label: 'Chaveiro' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'AR_CONDICIONADO', label: 'Ar Condicionado' },
    { value: 'FREIOS', label: 'Freios' },
    { value: 'SUSPENSAO', label: 'Suspensão' },
    { value: 'SOLDADOR', label: 'Soldador' },
    { value: 'PINTURA', label: 'Pintura' },
    { value: 'VIDRACEIRO', label: 'Vidraceiro' },
    { value: 'ASSISTENCIA_TECNICA', label: 'Assistência Técnica' },
    { value: 'MANUTENCAO_EQUIPAMENTOS', label: 'Manutenção de Equipamentos' },
    { value: 'CONSULTORIA_RURAL', label: 'Consultoria Rural' },
    { value: 'SERVICOS_VETERINARIOS', label: 'Serviços Veterinários' },
    { value: 'ANALISE_SOLO', label: 'Análise de Solo' },
    { value: 'PULVERIZACAO', label: 'Pulverização' },
    { value: 'PULVERIZACAO_DRONE', label: 'Pulverização por Drone' },
    { value: 'COLHEITA_PLANTIO', label: 'Colheita e Plantio' },
    { value: 'ADUBACAO_CALCARIO', label: 'Adubação e Calagem' },
    { value: 'OPERADOR_MAQUINAS', label: 'Operador de Máquinas' },
    { value: 'SECAGEM_GRAOS', label: 'Secador / Secagem de Grãos' },
    { value: 'GUINDASTE', label: 'Guindaste' },
    { value: 'ARMAZENAGEM', label: 'Armazenagem' },
    { value: 'OUTROS', label: 'Outros' }
    // NOTA: Removidos CARGA, GUINCHO, MUDANCA pois estes são para motoristas
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
    // Filtro por tipo de serviço
    if (serviceTypeFilter !== 'all' && request.service_type !== serviceTypeFilter) {
      return false;
    }
    
    // Filtro por termo de pesquisa (buscar na descrição do problema e no tipo de serviço)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const problemDescription = (request.problem_description || '').toLowerCase();
      const serviceTypeName = serviceTypes.find(t => t.value === request.service_type)?.label.toLowerCase() || request.service_type.toLowerCase();
      
      if (!problemDescription.includes(searchLower) && !serviceTypeName.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  }).filter(request => {
    if (activeTab === 'pending') return !request.provider_id && request.status === 'OPEN';
    if (activeTab === 'accepted') return request.provider_id && (request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS');
    if (activeTab === 'completed') return request.provider_id && request.status === 'COMPLETED';
    return true;
  }).sort((a, b) => {
    // Para pendentes, ordenar pelas mais antigas primeiro
    if (activeTab === 'pending') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // Para outras abas, manter ordem mais recente primeiro
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      <section className="relative min-h-[200px] flex items-center justify-center overflow-hidden">
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
            <div className="flex items-center justify-center gap-3">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('cities')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2"
              >
                <MapPin className="mr-1 h-4 w-4" />
                Configurar Região
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => window.location.href = '/services'}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2"
              >
                🛠️ Solicitar Serviços
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Button 
            variant="ghost" 
            className="p-0 h-auto shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setActiveTab('pending')}
          >
            <Card className="w-full shadow-sm border-2 hover:border-primary/20 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center">
                  <Clock className="h-6 w-6 text-primary flex-shrink-0" />
                  <div className="ml-2 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Pendentes
                    </p>
                    <p className="text-lg font-bold">{counts.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Button>

          <Button 
            variant="ghost" 
            className="p-0 h-auto shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setActiveTab('active')}
          >
            <Card className="w-full shadow-sm border-2 hover:border-primary/20 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center">
                  <Play className="h-6 w-6 text-orange-500 flex-shrink-0" />
                  <div className="ml-2 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Ativas
                    </p>
                    <p className="text-lg font-bold">{counts.accepted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Button>

          <Button 
            variant="ghost" 
            className="p-0 h-auto shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setActiveTab('completed')}
          >
            <Card className="w-full shadow-sm border-2 hover:border-primary/20 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div className="ml-2 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Concluídas
                    </p>
                    <p className="text-lg font-bold">{counts.completed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Button>

          <Button 
            variant="ghost" 
            className="p-0 h-auto shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setActiveTab('earnings')}
          >
            <Card className="w-full shadow-sm border-2 hover:border-primary/20 transition-colors">
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
                             }).format(totalEarnings)
                          : '****'
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEarnings(!showEarnings);
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Button>
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
              <TabsTrigger value="cities" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Cidades</span>
                <span className="sm:hidden">Cid</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Solicitações Pendentes</h3>
                <p className="text-xs text-muted-foreground">
                  Atualizado há {Math.floor((new Date().getTime() - lastRefresh.getTime()) / 60000)} min • 
                  Auto-refresh a cada 30s
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredRequests.length}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    fetchServiceRequests();
                    refreshCounts();
                    fetchTotalEarnings();
                  }}
                  className="text-xs h-7"
                >
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Barra de Pesquisa */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar serviços por descrição ou tipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchTerm && (
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredRequests.length} {filteredRequests.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} para "{searchTerm}"
                </p>
              )}
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
                             <DollarSign className="inline h-3 w-3 mr-1" />
                             Valor: R$ {request.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         )}
                         <p className="text-xs text-muted-foreground">
                           <Clock className="inline h-3 w-3 mr-1" />
                           Solicitado em: {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                         </p>
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
              <Badge variant="secondary" className="text-xs">
                {requests.filter(r => r.provider_id && (r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS')).length}
              </Badge>
            </div>
            
            {requests.filter(r => r.provider_id && (r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS')).length > 0 ? (
              <div className="space-y-4">
                {requests.filter(r => r.provider_id && (r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS')).map((request) => (
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
                           <strong>Problema:</strong> {request.problem_description}
                         </p>
                         <p className="text-sm text-muted-foreground">
                           <MapPin className="inline h-3 w-3 mr-1" />
                           {request.location_address}
                         </p>
                         {/* DADOS DE CONTATO - Apenas para solicitações aceitas pelo prestador */}
                         {request.provider_id && (request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS') && (
                           <ContactInfoCard
                             requesterName={request.profiles?.full_name || request.contact_name}
                             contactPhone={request.contact_phone}
                             requesterPhone={request.profiles?.phone}
                             showWhatsApp={true}
                           />
                         )}
                         {request.estimated_price && (
                           <p className="text-sm font-medium text-green-600">
                             Valor: R$ {request.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         )}
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
              <Badge variant="secondary" className="text-xs">
                {requests.filter(r => r.provider_id && r.status === 'COMPLETED').length}
              </Badge>
            </div>
            
            {requests.filter(r => r.provider_id && r.status === 'COMPLETED').length > 0 ? (
              <div className="space-y-4">
                {requests.filter(r => r.provider_id && r.status === 'COMPLETED').map((request) => (
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
                       
                       <div className="space-y-2 mb-3">
                         <p className="text-sm text-muted-foreground">
                           <strong>Cliente:</strong> {request.profiles?.full_name || request.contact_name || 'Cliente'}
                         </p>
                         <p className="text-sm text-muted-foreground">
                           <MapPin className="inline h-3 w-3 mr-1" />
                           {request.location_address}
                         </p>
                         {request.final_price && (
                           <p className="text-sm font-medium text-green-600">
                             <DollarSign className="inline h-3 w-3 mr-1" />
                             Pago: R$ {request.final_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         )}
                         <p className="text-xs text-muted-foreground">
                           <Clock className="inline h-3 w-3 mr-1" />
                           Concluído em: {new Date(request.completed_at || request.updated_at).toLocaleDateString('pt-BR')}
                         </p>
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

          <TabsContent value="services" className="space-y-4">
            <ServiceProviderServiceTypeManager />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <ServiceProviderPayouts providerId={getProviderProfileId() || ''} />
          </TabsContent>

          <TabsContent value="cities" className="space-y-4">
            <ProviderCityManager 
              providerId={getProviderProfileId() || ''} 
              onCitiesUpdate={(cities) => {
                console.log('Provider cities updated:', cities);
                // Recarregar solicitações quando cidades forem atualizadas
                fetchServiceRequests();
                refreshCounts();
              }}
            />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};