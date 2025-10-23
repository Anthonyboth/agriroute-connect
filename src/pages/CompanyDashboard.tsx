import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyDashboard as CompanyDashboardComponent } from '@/components/CompanyDashboard';
import { CompanyDriverManager } from '@/components/CompanyDriverManager';
import { AdvancedVehicleManager } from '@/components/AdvancedVehicleManager';
import { CompanyFleetVehicleList } from '@/components/CompanyFleetVehicleList';
import { CompanyVehicleAssignments } from '@/components/CompanyVehicleAssignments';
import { FreightCard } from '@/components/FreightCard';
import { VehicleManager } from '@/components/VehicleManager';
import { FreightDetails } from '@/components/FreightDetails';
import { DriverAvailabilityCalendar } from '@/components/DriverAvailabilityCalendar';
import { UserCityManager } from '@/components/UserCityManager';
import { DriverAvailabilityAreasManager } from '@/components/DriverAvailabilityAreasManager';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SmartFreightMatcher } from '@/components/SmartFreightMatcher';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { AdvancedFreightSearch } from '@/components/AdvancedFreightSearch';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { DriverPayouts } from '@/components/DriverPayouts';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { toast } from 'sonner';
import { 
  MapPin, 
  TrendingUp, 
  Truck, 
  Clock, 
  CheckCircle, 
  Settings, 
  DollarSign, 
  Package, 
  Calendar, 
  Eye, 
  EyeOff, 
  Banknote, 
  Star, 
  MessageSquare, 
  AlertTriangle, 
  Users, 
  Building2, 
  BarChart, 
  Link2, 
  UserPlus, 
  Wrench,
  Brain,
  Navigation,
  FileText,
  Target
} from 'lucide-react';
import { SystemAnnouncementModal } from '@/components/SystemAnnouncementModal';
import { useGPSMonitoring } from '@/hooks/useGPSMonitoring';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { TrackingConsentModal } from '@/components/TrackingConsentModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServiceRegionSelector } from '@/components/ServiceRegionSelector';
import { DriverRegionManager } from '@/components/DriverRegionManager';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import heroLogistics from '@/assets/hero-logistics.jpg';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';
import { ServicesModal } from '@/components/ServicesModal';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import { CompanyInviteModal } from '@/components/CompanyInviteModal';
import { CompanyBalance } from '@/components/CompanyBalance';
import { CompanyInternalChat } from '@/components/CompanyInternalChat';
import { CompanyReports } from '@/components/CompanyReports';
import { ResponsiveTabNavigation } from '@/components/ui/responsive-tab-navigation';
import { ScrollIndicators } from '@/components/ui/scroll-indicators';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Definição centralizada de todas as tabs
const COMPANY_TABS = [
  { value: 'overview', label: 'Visão Geral', shortLabel: 'Visão', icon: Building2 },
  { value: 'ai-freights', label: 'Fretes IA', shortLabel: 'IA', icon: Brain },
  { value: 'drivers', label: 'Motoristas', shortLabel: 'Mot', icon: Users },
  { value: 'fleet', label: 'Frota', shortLabel: 'Frota', icon: Truck },
  { value: 'assignments', label: 'Vínculos', shortLabel: 'Vínc', icon: Link2 },
  { value: 'freights', label: 'Fretes', shortLabel: 'Fretes', icon: Package },
  { value: 'scheduled', label: 'Agendamentos', shortLabel: 'Agend', icon: Calendar },
  { value: 'active', label: 'Em Andamento', shortLabel: 'Ativo', icon: Navigation },
  { value: 'proposals', label: 'Propostas', shortLabel: 'Prop', icon: FileText },
  { value: 'payments', label: 'Pagamentos', shortLabel: 'Pag', icon: DollarSign },
  { value: 'areas-ai', label: 'Áreas IA', shortLabel: 'Áreas', icon: Target },
  { value: 'cities', label: 'Cidades', shortLabel: 'Cid', icon: MapPin },
  { value: 'balance', label: 'Saldo', shortLabel: '$', icon: Banknote },
  { value: 'history', label: 'Histórico', shortLabel: 'Hist', icon: Clock },
  { value: 'chat', label: 'Chat Interno', shortLabel: 'Chat', icon: MessageSquare },
  { value: 'reports', label: 'Relatórios', shortLabel: 'Rel', icon: BarChart }
] as const;

const CompanyDashboard = () => {
  const { profile, profiles, switchProfile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const tabsScrollRef = React.useRef<HTMLDivElement>(null);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const { company, isLoadingCompany } = useTransportCompany();
  
  const refetchCompany = async () => {
    // Força re-fetch buscando company novamente
    await fetchActiveFreights();
  };

  const handleAddVehicle = async (vehicleData: any) => {
    if (!company?.id || !profile?.id) {
      toast.error('Informações da empresa não encontradas. Recarregue a página.');
      return;
    }

    try {
      console.log('[CompanyDashboard] Salvando veículo da frota:', {
        company_id: company.id,
        driver_id: profile.id,
        vehicle_type: vehicleData.vehicle_type,
        license_plate: vehicleData.license_plate
      });
      
      const vehicleToInsert = {
        company_id: company.id,
        driver_id: profile.id,
        is_company_vehicle: true,
        vehicle_type: vehicleData.vehicle_type,
        license_plate: vehicleData.license_plate,
        axle_count: vehicleData.axle_count || 2,
        max_capacity_tons: vehicleData.max_capacity_tons || 0,
        vehicle_specifications: vehicleData.vehicle_specifications || null,
        vehicle_documents: vehicleData.vehicle_documents || [],
        vehicle_photos: vehicleData.vehicle_photos || [],
        crlv_url: vehicleData.crlv_url || null
      };

      const { data, error } = await supabase
        .from('vehicles')
        .insert(vehicleToInsert)
        .select()
        .single();

      if (error) {
        console.error('[CompanyDashboard] Erro ao salvar veículo:', error);
        throw error;
      }

      console.log('[CompanyDashboard] Veículo salvo com sucesso:', data);
      
      toast.success('✅ Veículo cadastrado e aprovado automaticamente!');
      
      // Recarregar lista da frota
      refetchCompany();
    } catch (error: any) {
      console.error('[CompanyDashboard] Erro fatal ao cadastrar veículo:', error);
      toast.error(error?.message || 'Erro ao cadastrar veículo. Tente novamente.');
    }
  };
  
  // Estados para funcionalidades do motorista
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<any | null>(null);
  
  // Estados para dados
  const [activeFreights, setActiveFreights] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);

  // GPS Monitoring para fretes em andamento
  const activeFreight = activeFreights.find(f =>
    f.status === 'IN_TRANSIT' || f.status === 'ACCEPTED'
  );
  useGPSMonitoring(activeFreight?.id || null, !!activeFreight);

  // Fetch fretes ativos da empresa
  const fetchActiveFreights = React.useCallback(async () => {
    if (!company?.id || !profile?.id) return;

    try {
      setIsLoadingActive(true);

      // Buscar assignments ativos da empresa
      const { data: assignments, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*,
            producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
          ),
          driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      setMyAssignments(assignments || []);

      // Buscar também fretes diretos da empresa
      const { data: directFreights } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone),
          driver:profiles!freights_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('created_at', { ascending: false });

      setActiveFreights(directFreights || []);
    } catch (error) {
      console.error('Erro ao buscar fretes ativos:', error);
      toast.error('Erro ao carregar fretes ativos');
    } finally {
      setIsLoadingActive(false);
    }
  }, [company?.id, profile?.id]);

  React.useEffect(() => {
    fetchActiveFreights();
  }, [fetchActiveFreights]);

  // Realtime updates
  React.useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel('company-active-freights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchActiveFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchActiveFreights()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchActiveFreights]);

  // Auto-switch para perfil TRANSPORTADORA se necessário
  useEffect(() => {
    if (isLoadingCompany) return;

    const handleProfileSwitch = async () => {
      // Se não há empresa, procurar perfil TRANSPORTADORA
      if (!company) {
        const transportProfile = profiles.find(p => p.role === 'TRANSPORTADORA');
        
        // Se existe perfil TRANSPORTADORA mas não é o ativo, fazer switch
        if (transportProfile && profile?.id !== transportProfile.id) {
          setIsSwitchingProfile(true);
          await switchProfile(transportProfile.id);
          // O useTransportCompany vai recarregar automaticamente
          return;
        }
        
        // Se não existe perfil TRANSPORTADORA, não redirecionar
        // Mostraremos um CTA para criar a transportadora
      }
      setIsSwitchingProfile(false);
    };

    handleProfileSwitch();
  }, [company, isLoadingCompany, profile?.id, profiles, switchProfile]);

  // Show loading state without Header to avoid user=undefined error
  if (isLoadingCompany || isSwitchingProfile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Building2 className="h-12 w-12 text-primary mx-auto animate-pulse" />
            <p className="text-muted-foreground">Carregando painel da Transportadora...</p>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have a valid profile before rendering
  if (!profile) return null;

  // Se não há empresa e não há perfil TRANSPORTADORA, mostrar CTA
  if (!company && !profiles.find(p => p.role === 'TRANSPORTADORA')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} onLogout={signOut} />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Crie sua Transportadora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Para acessar o painel da transportadora, você precisa criar ou ativar sua conta de transportadora.
              </p>
              <Button 
                onClick={() => navigate('/transport-company/registration')}
                className="w-full"
              >
                Criar Transportadora
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SystemAnnouncementModal />
      <Header
        user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} 
        onLogout={signOut}
        userProfile={profile ? { ...profile, active_mode: 'TRANSPORTADORA' } : undefined}
      />
      
      {/* Hero Section - Transportadora */}
      <section className="relative py-12 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <Badge variant="default" className="mb-2">
              <Building2 className="h-3 w-3 mr-1" />
              Transportadora
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Painel de Gerenciamento
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {company?.company_name || 'Transportadora'}
            </p>

            {company?.status === 'APPROVED' && (
              <Alert className="max-w-2xl mx-auto bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Cadastro Aprovado!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Sua transportadora está ativa e pronta para gerenciar fretes e motoristas.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex flex-wrap justify-center gap-3">
              <Button 
                onClick={() => setInviteModalOpen(true)}
                className="gradient-primary text-primary-foreground font-semibold rounded-full px-6 py-2.5 w-full sm:w-auto shadow-glow hover:scale-105 transition-bounce"
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Convidar Motoristas
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('overview')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Building2 className="mr-1 h-4 w-4" />
                Visão Geral
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('drivers')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Users className="mr-1 h-4 w-4" />
                Motoristas
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('fleet')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Truck className="mr-1 h-4 w-4" />
                Frota
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
            </Button>
          </div>
        </div>
      </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        <SubscriptionExpiryNotification />
        <FreightLimitTracker hideForAffiliatedDriver={true} />
        
        <div className="mb-6">
          <PendingRatingsPanel userRole="MOTORISTA" userProfileId={profile?.id || ''} />
        </div>

        {/* Navegação Responsiva por Tabs */}
        {isMobile || isTablet ? (
          <ResponsiveTabNavigation
            tabs={COMPANY_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <div className="relative mb-6">
            <ScrollIndicators targetRef={tabsScrollRef} />
            <div 
              ref={tabsScrollRef}
              className="flex gap-2 overflow-x-auto overflow-y-hidden scroll-smooth pb-2 px-1"
            >
              {COMPANY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.value === activeTab;
                
                return (
                  <Button
                    key={tab.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium min-w-[120px] flex-shrink-0 gap-2 transition-all duration-200",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md border-2 border-primary" 
                        : "bg-card hover:bg-muted border border-border hover:scale-105"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          <TabsContent value="overview" className="mt-6">
            <CompanyDashboardComponent />
          </TabsContent>

          <TabsContent value="drivers" className="mt-6">
            <CompanyDriverManager />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            {company?.id && <CompanyVehicleAssignments companyId={company.id} />}
          </TabsContent>

          <TabsContent value="fleet" className="mt-6">
              <AdvancedVehicleManager onVehicleAdd={handleAddVehicle} />
              
              <div className="mt-6">
                {company?.id && <CompanyFleetVehicleList companyId={company.id} onRefresh={refetchCompany} />}
              </div>
          </TabsContent>

          <TabsContent value="ai-freights" className="mt-6">
            <SmartFreightMatcher 
              onFreightAction={(freightId) => {
                setSelectedFreightId(freightId);
                setShowDetails(true);
              }}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-6">
              {/* GPS Tracking Alert */}
              {activeFreight && (
                <Alert className="mb-4">
                  <Navigation className="h-4 w-4 animate-pulse" />
                  <AlertTitle className="flex items-center gap-2">
                    Rastreamento Automático Ativo
                  </AlertTitle>
                  <AlertDescription>
                    O GPS está rastreando automaticamente fretes em andamento para segurança.
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    Fretes em Andamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingActive ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p>Carregando fretes ativos...</p>
                    </div>
                  ) : myAssignments.length === 0 && activeFreights.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum frete em andamento</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Assignments */}
                      {myAssignments.map((assignment) => (
                        <MyAssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          onAction={() => {
                            setSelectedFreightId(assignment.freight_id);
                            setShowDetails(true);
                          }}
                        />
                      ))}

                      {/* Direct Freights */}
                      {activeFreights.map((freight) => (
                        <Card key={freight.id} className="border-l-4 border-l-blue-600">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold">{getCargoTypeLabel(freight.cargo_type)}</h3>
                              <Badge variant="secondary">
                                {freight.status === 'IN_TRANSIT' ? 'Em Trânsito' : 'Aceito'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-1 text-sm">
                              <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-600" />
                                <span className="font-medium">Origem:</span> {freight.origin_city}, {freight.origin_state}
                              </p>
                              <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-red-600" />
                                <span className="font-medium">Destino:</span> {freight.destination_city}, {freight.destination_state}
                              </p>
                            </div>
                            {freight.driver && (
                              <div className="p-2 bg-muted rounded">
                                <p className="text-sm"><strong>Motorista:</strong> {freight.driver.full_name}</p>
                                {freight.driver.contact_phone && (
                                  <p className="text-xs text-muted-foreground">{freight.driver.contact_phone}</p>
                                )}
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                setSelectedFreightId(freight.id);
                                setShowDetails(true);
                              }}
                              className="w-full"
                            >
                              Ver Detalhes
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  Propostas Recebidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gerencie as propostas enviadas pelos motoristas afiliados à sua transportadora.
                </p>
                {company?.id && (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sistema de propostas em desenvolvimento</p>
                    <p className="text-xs mt-2">Em breve você poderá gerenciar propostas aqui</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            {profile?.id && <DriverPayouts driverId={profile.id} />}
          </TabsContent>

          <TabsContent value="areas-ai" className="mt-6">
            <DriverAvailabilityAreasManager
              driverId={profile?.id || ''}
              onFreightAction={(freightId) => {
                setSelectedFreightId(freightId);
                setShowDetails(true);
              }}
            />
          </TabsContent>

          <TabsContent value="freights" className="mt-6">
            <div className="space-y-6">
              <AdvancedFreightSearch 
                onSearch={(filters) => console.log('Search filters:', filters)}
                userRole="MOTORISTA"
              />
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="cities" className="mt-6">
            <UserCityManager userRole="TRANSPORTADORA" />
          </TabsContent>

          <TabsContent value="balance" className="mt-6">
            <CompanyBalance />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <UnifiedHistory userRole="MOTORISTA" />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <CompanyInternalChat />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <CompanyReports />
          </TabsContent>

        </Tabs>
      </div>

      {/* Modals */}
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />

      <CompanyInviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />

      {/* Freight Details Modal */}
      {showDetails && selectedFreightId && profile && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <FreightDetails
              freightId={selectedFreightId}
              currentUserProfile={profile}
              onClose={() => {
                setShowDetails(false);
                setSelectedFreightId(null);
                fetchActiveFreights();
              }}
              onFreightWithdraw={(freight) => {
                setSelectedFreightForWithdrawal(freight);
                setShowWithdrawalModal(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Checkin Modal */}
      {showCheckinModal && selectedFreightForCheckin && profile && (
        <FreightCheckinModal
          freightId={selectedFreightForCheckin}
          isOpen={showCheckinModal}
          onClose={() => {
            setShowCheckinModal(false);
            setSelectedFreightForCheckin(null);
            setInitialCheckinType(null);
            fetchActiveFreights();
          }}
          currentUserProfile={profile}
          initialType={initialCheckinType || undefined}
        />
      )}

      {/* Withdrawal Modal */}
      {showWithdrawalModal && selectedFreightForWithdrawal && (
        <FreightWithdrawalModal
          isOpen={showWithdrawalModal}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedFreightForWithdrawal(null);
          }}
          onConfirm={async () => {
            // Handle withdrawal
            setShowWithdrawalModal(false);
            setSelectedFreightForWithdrawal(null);
            fetchActiveFreights();
            toast.success('Frete retirado com sucesso');
          }}
          freightInfo={{
            cargo_type: selectedFreightForWithdrawal.cargo_type,
            origin_address: selectedFreightForWithdrawal.origin_address,
            destination_address: selectedFreightForWithdrawal.destination_address,
            price: selectedFreightForWithdrawal.price,
          }}
        />
      )}
      
    </div>
  );
};

export default CompanyDashboard;
