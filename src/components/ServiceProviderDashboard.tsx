import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

import { LocationManager } from '@/components/LocationManager';
import { RegionalFreightFilter } from '@/components/RegionalFreightFilter';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import { ProviderCityManager } from '@/components/ProviderCityManager';
import { ServiceHistory } from '@/components/ServiceHistory';
import heroLogistics from '@/assets/hero-logistics.jpg';
import { ServicesModal } from '@/components/ServicesModal';

interface ServiceRequest {
  id: string;
  client_id: string | null;
  provider_id: string | null;
  service_type: string;
  location_address: string;
  location_address_safe?: string;
  city_name?: string;
  state?: string;
  location_lat?: number;
  location_lng?: number;
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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showEarnings, setShowEarnings] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);

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
          
          // Se for UPDATE e envolver o serviço selecionado no modal
          if (payload.eventType === 'UPDATE' && 
              selectedRequest?.id === payload.new.id &&
              showRequestModal) {
            
            // Verificar se foi aceito por outro prestador
            if (payload.new.provider_id !== null && 
                payload.new.provider_id !== getProviderProfileId()) {
              toast({
                title: "Serviço Não Disponível",
                description: "Este serviço foi aceito por outro prestador.",
                variant: "destructive",
              });
              setShowRequestModal(false);
              setSelectedRequest(null);
            }
          }
          
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

  // Monitorar disponibilidade do serviço em tempo real enquanto modal está aberto
  useEffect(() => {
    if (!showRequestModal || !selectedRequest) return;

    const checkInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('provider_id, status')
          .eq('id', selectedRequest.id)
          .single();

        if (error) throw error;

        // Se foi aceito por outro prestador, notificar e fechar modal
        if (data.provider_id !== null || data.status !== 'OPEN') {
          toast({
            title: "Serviço Não Disponível",
            description: "Este serviço foi aceito por outro prestador.",
            variant: "destructive",
          });
          
          setShowRequestModal(false);
          setSelectedRequest(null);
          fetchServiceRequests();
          refreshCounts();
        }
      } catch (error) {
        console.error('Error checking service availability:', error);
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => clearInterval(checkInterval);
  }, [showRequestModal, selectedRequest]);

  const fetchServiceRequests = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) {
      console.warn('⚠️ Provider ID not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Execute spatial matching (não crítico se falhar)
      console.log('🔍 Executing spatial matching for provider...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: spatialData, error: spatialError } = await supabase.functions.invoke(
          'provider-spatial-matching',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
            }
          }
        );

        if (spatialError) {
          console.warn('⚠️ Spatial matching warning:', spatialError);
        } else {
          console.log('✅ Spatial matching completed:', spatialData);
        }
      } catch (spatialError) {
        console.warn('⚠️ Spatial matching failed (non-critical):', spatialError);
      }

      // 2. Fetch compatible requests using RPC
      console.log('🔍 Fetching compatible service requests...');
      let compatibleRequests: any[] = [];
      try {
        const { data, error: compatibleError } = await supabase.rpc(
          'get_compatible_service_requests_for_provider',
          { p_provider_id: providerId }
        );

        if (compatibleError) {
          console.warn('⚠️ Error fetching compatible requests:', compatibleError);
        } else {
          compatibleRequests = data || [];
          console.log('✅ Compatible requests found:', compatibleRequests.length);
        }
      } catch (compatibleError) {
        console.warn('⚠️ Compatible requests query failed:', compatibleError);
      }

      // 2b. Fetch city-based fallback requests
      console.log('🔍 Fetching city-based fallback requests...');
      let cityRequests: any[] = [];
      try {
        const { data, error: cityError } = await supabase.rpc(
          'get_service_requests_by_city',
          { provider_profile_id: providerId }
        );
        if (cityError) {
          console.warn('⚠️ Error fetching city-based requests:', cityError);
        } else {
          cityRequests = data || [];
          console.log('✅ City-based requests found:', cityRequests.length);
        }
      } catch (cityErr) {
        console.warn('⚠️ City-based query failed:', cityErr);
      }

      // 3. Fetch provider's accepted requests (sem join problemático)
      const { data: providerRequests, error: providerError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (providerError) {
        console.error('❌ Error fetching provider requests:', providerError);
        throw providerError;
      }

      // 4. Buscar perfis dos clientes separadamente
      const clientIds = [...new Set([
        ...(providerRequests || []).map(r => r.client_id),
        ...(compatibleRequests || []).map(r => r.client_id),
        ...(cityRequests || []).map((r: any) => r.client_id)
      ].filter(Boolean))];

      const clientsMap = new Map();
      if (clientIds.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', clientIds);

        if (!clientsError && clients) {
          clients.forEach(client => {
            clientsMap.set(client.id, client);
          });
        }
      }

      // 5. Combinar e deduplicar por ID
      const byId = new Map<string, ServiceRequest>();
      // Tipos de serviço do prestador (se definido no perfil)
      const allowedTypes = Array.isArray(profile?.service_types)
        ? (profile?.service_types as unknown as string[])
        : undefined;
      
      // Adicionar solicitações aceitas pelo prestador
      (providerRequests || []).forEach((r: any) => {
        const client = clientsMap.get(r.client_id);
        byId.set(r.id, {
          ...r,
          profiles: client ? {
            id: client.id,
            full_name: client.full_name,
            phone: client.phone
          } : null
        } as ServiceRequest);
      });
      
      // Adicionar solicitações compatíveis (pendentes)
      (compatibleRequests || []).forEach((r: any) => {
        if (!byId.has(r.request_id)) {
          const client = clientsMap.get(r.client_id);
          const serviceRequest: ServiceRequest = {
            id: r.request_id,
            service_type: r.service_type,
            location_address: r.location_address,
            city_name: r.city_name,
            state: r.state,
            problem_description: r.problem_description,
            urgency: r.urgency,
            contact_phone: r.contact_phone,
            contact_name: r.contact_name,
            status: r.status,
            created_at: r.created_at,
            location_lat: r.location_lat,
            location_lng: r.location_lng,
            vehicle_info: r.vehicle_info,
            additional_info: r.additional_info,
            is_emergency: r.is_emergency,
            estimated_price: r.estimated_price,
            provider_id: null,
            client_id: r.client_id,
            profiles: client ? {
              id: client.id,
              full_name: client.full_name,
              phone: client.phone
            } : null
          };
          byId.set(r.request_id, serviceRequest);
        }
      });

      // Adicionar fallback por cidade (apenas OPEN, sem prestador e respeitando tipos)
      let cityFallbackAdded = 0;
      (cityRequests || []).forEach((r: any) => {
        const typeOk = !allowedTypes || allowedTypes.includes(r.service_type);
        const statusOk = r.status === 'OPEN';
        if (!byId.has(r.id) && typeOk && statusOk) {
          const client = clientsMap.get(r.client_id);
          const serviceRequest: ServiceRequest = {
            id: r.id,
            service_type: r.service_type,
            location_address: r.location_address,
            city_name: r.city_name,
            state: r.state,
            problem_description: r.problem_description,
            urgency: r.urgency,
            contact_phone: r.contact_phone,
            contact_name: r.contact_name,
            status: r.status,
            created_at: r.created_at,
            location_lat: r.location_lat,
            location_lng: r.location_lng,
            vehicle_info: r.vehicle_info,
            additional_info: r.additional_info,
            is_emergency: r.is_emergency,
            estimated_price: (r as any).estimated_price,
            provider_id: null,
            client_id: r.client_id,
            profiles: client ? {
              id: client.id,
              full_name: client.full_name,
              phone: client.phone
            } : null
          };
          byId.set(r.id, serviceRequest);
          cityFallbackAdded += 1;
        }
      });
      
      const allRequests = Array.from(byId.values());
      setRequests(allRequests);
      setLastRefresh(new Date());
      setLoading(false);
      
      console.log(`✅ Total requests loaded: ${allRequests.length}`, {
        acceptedByProvider: (providerRequests || []).length,
        compatiblePending: compatibleRequests.length,
        cityFallbackPending: cityFallbackAdded,
        total: allRequests.length
      });
      
    } catch (error: any) {
      console.error('❌ Error fetching service requests:', error);
      setLoading(false);
      toast({
        title: "Erro ao carregar solicitações",
        description: "Não foi possível carregar as solicitações. Tente novamente.",
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

  const handleAcceptFromModal = async (requestId: string) => {
    setIsAccepting(true);
    
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

      // VERIFICAÇÃO EM TEMPO REAL: Buscar estado atual do serviço
      const { data: currentRequest, error: checkError } = await supabase
        .from('service_requests')
        .select('provider_id, status')
        .eq('id', requestId)
        .single();

      if (checkError) {
        throw new Error('Erro ao verificar disponibilidade do serviço');
      }

      // Verificar se já foi aceito por outro prestador
      if (currentRequest.provider_id !== null || currentRequest.status !== 'OPEN') {
        toast({
          title: "Serviço Indisponível",
          description: "Este serviço já foi aceito por outro prestador.",
          variant: "destructive",
        });
        
        // Fechar modal e atualizar lista
        setShowRequestModal(false);
        fetchServiceRequests();
        refreshCounts();
        return;
      }

      // Tentar aceitar usando a função RPC
      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: providerId,
        p_request_id: requestId,
      });

      if (error) {
        // Verificar se é erro de concorrência
        if (error.message.includes('indisponível') || error.message.includes('aceita')) {
          toast({
            title: "Serviço Indisponível",
            description: "Este serviço foi aceito por outro prestador no momento.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        
        setShowRequestModal(false);
        fetchServiceRequests();
        refreshCounts();
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Serviço Indisponível",
          description: "Este serviço já foi aceito por outro prestador.",
          variant: "destructive",
        });
        
        setShowRequestModal(false);
        fetchServiceRequests();
        refreshCounts();
        return;
      }

      // Sucesso!
      toast({
        title: "Sucesso! 🎉",
        description: "Serviço aceito com sucesso! Confira na aba 'Ativas'.",
      });

      // Fechar modal e atualizar
      setShowRequestModal(false);
      fetchServiceRequests();
      refreshCounts();
      fetchTotalEarnings();
      
      // Mudar para a aba de serviços ativos
      setActiveTab('accepted');

    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível aceitar a solicitação",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
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
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('cities')}
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
                <Wrench className="mr-1 h-4 w-4" />
                Configurar Serviços
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Package className="mr-1 h-4 w-4" />
                Solicitar Serviço
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-primary"
            label="Disponíveis"
            value={counts.pending}
            onClick={() => setActiveTab('pending')}
          />

          <StatsCard
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Ativas"
            value={counts.accepted}
            onClick={() => setActiveTab('accepted')}
          />

          <StatsCard
            icon={<CheckCircle className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Concluídas"
            value={counts.completed}
            onClick={() => setActiveTab('completed')}
          />

          <StatsCard
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Saldo"
            value={showEarnings 
              ? new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL',
                  notation: 'compact',
                  maximumFractionDigits: 0
                }).format(totalEarnings)
              : '****'
            }
            onClick={() => setActiveTab('earnings')}
            actionButton={
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEarnings(!showEarnings);
                }}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              >
                {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            }
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="pending" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Brain className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Disponível</span>
                <span className="sm:hidden">Disp</span>
              </TabsTrigger>
              <TabsTrigger 
                value="accepted" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Concluídos</span>
                <span className="sm:hidden">Ok</span>
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Settings className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Serviços</span>
                <span className="sm:hidden">Serv</span>
              </TabsTrigger>
              <TabsTrigger 
                value="payouts" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Banknote className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Saldo</span>
                <span className="sm:hidden">Saldo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cities" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Cidades</span>
                <span className="sm:hidden">Cid</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Hist</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Solicitações Disponíveis</h3>
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
                  <Button
                    key={request.id}
                    variant="ghost"
                    className="w-full p-0 h-auto text-left hover:bg-accent"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRequestModal(true);
                    }}
                  >
                    <Card className="w-full shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-green-500">
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
                          <p className="text-sm text-muted-foreground line-clamp-2">
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
                             {new Date(request.created_at).toLocaleTimeString('pt-BR')}
                           </p>
                        </div>
                        
                        <div className="mt-3 text-xs text-primary font-medium">
                          Clique para ver detalhes →
                        </div>
                      </CardContent>
                    </Card>
                  </Button>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center space-y-4">
                {counts.pending === 0 ? (
                  <>
                    <Settings className="w-16 h-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Configure seu perfil</h3>
                      <p className="text-muted-foreground mb-4">
                        Para começar a receber solicitações, você precisa:
                      </p>
                      <ul className="text-left max-w-md mx-auto space-y-2 mb-6 text-sm">
                        <li className="flex items-start">
                          <span className="mr-2">✓</span>
                          <span>Configurar as regiões onde você atende</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">✓</span>
                          <span>Definir os tipos de serviço que oferece</span>
                        </li>
                      </ul>
                      <div className="flex gap-3 justify-center flex-wrap">
                        <Button onClick={() => setActiveTab('cities')}>
                          <MapPin className="w-4 h-4 mr-2" />
                          Configurar Regiões
                        </Button>
                        <Button onClick={() => setActiveTab('services')} variant="outline">
                          <Wrench className="w-4 h-4 mr-2" />
                          Configurar Serviços
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhuma solicitação disponível no momento</p>
                  </div>
                )}
              </Card>
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

          <TabsContent value="history" className="space-y-4">
            <ServiceHistory />
          </TabsContent>

        </Tabs>

        {/* Modal de Detalhes da Solicitação */}
        <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-green-600" />
                Detalhes da Solicitação
              </DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-6">
                {/* Tipo de Serviço e Urgência */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {serviceTypes.find(t => t.value === selectedRequest.service_type)?.label || selectedRequest.service_type}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Solicitado em {new Date(selectedRequest.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant={getUrgencyColor(selectedRequest.urgency)} className="text-sm">
                    {selectedRequest.urgency === 'URGENT' ? 'Urgente' : 
                     selectedRequest.urgency === 'HIGH' ? 'Alto' :
                     selectedRequest.urgency === 'MEDIUM' ? 'Médio' : 'Baixo'}
                  </Badge>
                </div>

                <div className="h-px bg-border" />

                {/* Informações do Cliente (se disponível) */}
                {selectedRequest.contact_name && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Cliente
                    </h4>
                    <p className="text-sm">{selectedRequest.contact_name}</p>
                  </div>
                )}

                {/* Descrição do Problema */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Descrição do Problema
                  </h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedRequest.problem_description}
                  </p>
                </div>

                {/* Localização */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedRequest.location_address}
                  </p>
                </div>

                {/* Informações do Veículo (se houver) */}
                {selectedRequest.vehicle_info && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Informações do Veículo
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedRequest.vehicle_info}
                    </p>
                  </div>
                )}

                {/* Valor Estimado */}
                {selectedRequest.estimated_price && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor
                    </h4>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {selectedRequest.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {/* Informações Adicionais */}
                {selectedRequest.additional_info && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Informações Adicionais</h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedRequest.additional_info}
                    </p>
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRequestModal(false)}
                    disabled={isAccepting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleAcceptFromModal(selectedRequest.id)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Aceitando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aceitar Serviço
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Solicitar Serviços */}
        <ServicesModal 
          isOpen={servicesModalOpen}
          onClose={() => setServicesModalOpen(false)}
        />
      </div>
    </div>
  );
};