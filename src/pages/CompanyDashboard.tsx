import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Users, 
  Truck, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Package, 
  Navigation,
  MapPin,
  DollarSign,
  Loader2,
  Building2,
  Link2,
  Calendar,
  Wrench,
  Target,
  Banknote,
  Star,
  Clock,
  BarChart,
  Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanySmartFreightMatcher } from '@/components/CompanySmartFreightMatcher';
import { CompanyDriverManager } from '@/components/CompanyDriverManager';
import { CompanyDashboard as CompanyDashboardComponent } from '@/components/CompanyDashboard';
import { CompanyAnalyticsDashboard } from '@/components/CompanyAnalyticsDashboard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { AdvancedVehicleManager } from '@/components/AdvancedVehicleManager';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';
import { cn } from '@/lib/utils';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { FRETES_IA_LABEL, AI_ABBR, AREAS_IA_LABEL } from '@/lib/ui-labels';
import Header from '@/components/Header';
import { SystemAnnouncementModal } from '@/components/SystemAnnouncementModal';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import { PendingVehiclesApproval } from '@/components/PendingVehiclesApproval';

// Placeholder for heroLogistics
const heroLogistics = '';

// Definição de tabs
const getCompanyTabs = (activeCount: number, chatCount: number) => [
  { 
    value: 'overview', 
    label: 'Visão Geral', 
    shortLabel: 'Visão', 
    icon: Building2,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'marketplace', label: FRETES_IA_LABEL, shortLabel: AI_ABBR, icon: TrendingUp, badge: undefined },
  { value: 'drivers', label: 'Motoristas', shortLabel: 'Mot', icon: Users, badge: undefined },
  { value: 'fleet', label: 'Frota', shortLabel: 'Frota', icon: Truck, badge: undefined },
  { value: 'assignments', label: 'Vínculos', shortLabel: 'Vínc', icon: Link2, badge: undefined },
  { value: 'freights', label: 'Fretes', shortLabel: 'Fretes', icon: Package, badge: undefined },
  { value: 'scheduled', label: 'Agendamentos', shortLabel: 'Agend', icon: Calendar, badge: undefined },
  { 
    value: 'active', 
    label: 'Em Andamento', 
    shortLabel: 'Ativo', 
    icon: Navigation,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'proposals', label: 'Propostas', shortLabel: 'Prop', icon: FileText, badge: undefined },
  { value: 'services', label: 'Serviços', shortLabel: 'Serv', icon: Wrench, badge: undefined },
  { value: 'payments', label: 'Pagamentos', shortLabel: 'Pag', icon: DollarSign, badge: undefined },
  { value: 'areas-ai', label: AREAS_IA_LABEL, shortLabel: 'Áreas', icon: Target, badge: undefined },
  { value: 'cities', label: 'Cidades', shortLabel: 'Cid', icon: MapPin, badge: undefined },
  { value: 'balance', label: 'Saldo', shortLabel: '$', icon: Banknote, badge: undefined },
  { value: 'ratings', label: 'Avaliações', shortLabel: 'Aval', icon: Star, badge: undefined },
  { value: 'history', label: 'Histórico', shortLabel: 'Hist', icon: Clock, badge: undefined },
  { 
    value: 'chat', 
    label: 'Chat Interno', 
    shortLabel: 'Chat', 
    icon: MessageSquare,
    badge: chatCount > 0 ? chatCount : undefined
  },
  { value: 'reports', label: 'Relatórios', shortLabel: 'Rel', icon: BarChart, badge: undefined }
];

const CompanyDashboard = () => {
  const { profile, profiles, switchProfile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const tabsScrollRef = React.useRef<HTMLDivElement>(null);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [driverFileModalOpen, setDriverFileModalOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const { company, isLoadingCompany: companyLoading, drivers, pendingDrivers } = useTransportCompany();
  
  const getInitialTab = () => {
    const storedTab = localStorage.getItem('company_active_tab');
    return storedTab || 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights } = useDriverPermissions();
  
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'TRANSPORTADORA'
  );
  
  // Estado para analytics
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  useEffect(() => {
    localStorage.setItem('company_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleMovedToHistory = () => {
      setActiveTab('history');
      setShowDetails(false);
      setSelectedFreightId(null);
    };
    
    window.addEventListener('freight:movedToHistory', handleMovedToHistory);
    return () => window.removeEventListener('freight:movedToHistory', handleMovedToHistory);
  }, []);
  
  const refetchCompany = async () => {
    await fetchActiveFreights();
  };

  const handleNavigateToReport = (tabValue: string) => {
    setActiveTab(tabValue);
    setTimeout(() => {
      const tabsElement = document.querySelector('[role="tablist"]');
      if (tabsElement) {
        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleAddVehicle = async (vehicleData: any) => {
    if (!company?.id || !profile?.id) {
      toast.error('Informações da empresa não encontradas. Recarregue a página.');
      return;
    }

    try {
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

      if (error) throw error;
      
      toast.success('✅ Veículo cadastrado e aprovado automaticamente!');
      refetchCompany();
    } catch (error: any) {
      console.error('Erro ao cadastrar veículo:', error);
      toast.error(error?.message || 'Erro ao cadastrar veículo. Tente novamente.');
    }
  };
  
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<any | null>(null);
  
  const [activeFreights, setActiveFreights] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);

  const fetchActiveFreights = React.useCallback(async () => {
    if (!company?.id || !profile?.id) {
      // ✅ Silent guard - sem console.warn para evitar spam
      return;
    }

    try {
      setIsLoadingActive(true);

      const affiliatedDriverIds = (drivers || [])
        .map(d => d?.driver_profile_id)
        .filter((id): id is string => Boolean(id));

      const orFilters: string[] = [`company_id.eq.${company.id}`];
      if (affiliatedDriverIds.length > 0) {
        orFilters.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }
      const orFilterStr = orFilters.join(',');

      const { data: assignments, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*,
            producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
          ),
          driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .or(orFilterStr)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      let mergedAssignments = assignments || [];

      const orFiltersFreights: string[] = [`company_id.eq.${company.id}`];
      if (affiliatedDriverIds.length > 0) {
        orFiltersFreights.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }
      const orFilterStrFreights = orFiltersFreights.join(',');

      const { data: directFreights } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone),
          driver:profiles!freights_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .or(orFilterStrFreights)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('created_at', { ascending: false });

      const freightIdsWithCompany = (directFreights || []).map((f: any) => f.id);
      if (freightIdsWithCompany.length > 0) {
        const { data: extraAssignments, error: extraErr } = await supabase
          .from('freight_assignments')
          .select(`
            *,
            freight:freights(*,
              producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
            ),
            driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
          `)
          .in('freight_id', freightIdsWithCompany)
          .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
          .order('accepted_at', { ascending: false });
        if (!extraErr && extraAssignments) {
          const byId = new Map<string, any>();
          [...mergedAssignments, ...extraAssignments].forEach((a: any) => byId.set(a.id, a));
          mergedAssignments = Array.from(byId.values());
        }
      }

      setMyAssignments(mergedAssignments);
      setActiveFreights(directFreights || []);
    } catch (error) {
      console.error('Erro ao buscar fretes:', error);
      toast.error('Erro ao carregar fretes ativos');
    } finally {
      setIsLoadingActive(false);
    }
  }, [company?.id, profile?.id, drivers]);

  React.useEffect(() => {
    if (company?.id && profile?.id) {
      fetchActiveFreights();
    }
  }, [company?.id, profile?.id, fetchActiveFreights]);

  React.useEffect(() => {
    if (!company?.id) return;

    const affiliatedDriverIds = (drivers || [])
      .map(d => d?.driver_profile_id)
      .filter((id): id is string => Boolean(id));
    
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

    if (affiliatedDriverIds.length > 0) {
      affiliatedDriverIds.forEach(driverId => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'freight_assignments',
            filter: `driver_id=eq.${driverId}`
          },
          () => fetchActiveFreights()
        );
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, drivers, fetchActiveFreights]);

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      setActiveTab(e.detail);
    };
    
    window.addEventListener('navigate-to-tab', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handleNavigate as EventListener);
  }, []);

  useEffect(() => {
    if (companyLoading) return;

    const handleProfileSwitch = async () => {
      if (!company) {
        const transportProfile = profiles.find(p => p.role === 'TRANSPORTADORA');
        
        if (transportProfile && profile?.id !== transportProfile.id) {
          setIsSwitchingProfile(true);
          await switchProfile(transportProfile.id);
          return;
        }
      }
      setIsSwitchingProfile(false);
    };

    handleProfileSwitch();
  }, [company, companyLoading, profile?.id, profiles, switchProfile]);

  // Early return for loading
  if (!company?.id || companyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (companyLoading || isSwitchingProfile) {
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

  if (!profile) return null;

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

  const totalActiveFreights = myAssignments.length + activeFreights.length;
  const COMPANY_TABS = getCompanyTabs(totalActiveFreights, chatUnreadCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SystemAnnouncementModal />
      <Header
        user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} 
        onLogout={signOut}
        userProfile={profile ? { ...profile, active_mode: 'TRANSPORTADORA' } : undefined}
      />
      
      <section className="relative py-6 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center space-y-4">
            <Badge variant="default" className="mb-1">
              <Building2 className="h-3 w-3 mr-1" />
              Transportadora
            </Badge>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Painel de Gerenciamento
            </h1>
            
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              {company?.company_name || 'Transportadora'}
            </p>
            
            <div className="flex flex-wrap justify-center gap-2">
              <Button 
                onClick={() => setActiveTab('marketplace')}
                className="gradient-primary text-primary-foreground font-semibold rounded-full px-6 py-2.5 w-full sm:w-auto shadow-glow hover:scale-105 transition-bounce"
              >
                <Brain className="mr-2 h-5 w-5" />
                {FRETES_IA_LABEL}
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
                onClick={() => setActiveTab('fleet')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Truck className="mr-1 h-4 w-4" />
                Frota
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-8">
        <SubscriptionExpiryNotification />
        <FreightLimitTracker hideForAffiliatedDriver={true} />

        {company && (
          <div className="mb-6">
            <PendingVehiclesApproval companyId={company.id} />
          </div>
        )}

        {/* Navegação por Tabs */}
        {isMobile || isTablet ? (
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2">
              {COMPANY_TABS.slice(0, 6).map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.value === activeTab;
                
                return (
                  <Button
                    key={tab.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "flex items-center justify-center gap-2",
                      isActive && "font-semibold"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.shortLabel}</span>
                    {tab.badge && tab.badge > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {tab.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="relative mb-6">
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
                    {tab.badge && tab.badge > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="overview" className="mt-6">
            <CompanyDashboardComponent onNavigateToReport={handleNavigateToReport} />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <CompanySmartFreightMatcher />
          </TabsContent>

          <TabsContent value="drivers" className="mt-6">
            <CompanyDriverManager />
          </TabsContent>

          <TabsContent value="fleet" className="mt-6">
            <AdvancedVehicleManager onVehicleAdd={handleAddVehicle} />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
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
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Carregando fretes ativos...</p>
                  </div>
                ) : myAssignments.length === 0 && activeFreights.length === 0 ? (
                  <div className="text-center py-8">
                    <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-semibold mb-2">Nenhum frete em andamento</p>
                    <p className="text-sm text-muted-foreground">
                      Seus fretes aceitos aparecerão aqui automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myAssignments.map((assignment) => (
                      <MyAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onAction={() => {}}
                      />
                    ))}
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Placeholder tabs */}
          {['assignments', 'freights', 'scheduled', 'proposals', 'services', 'payments', 'areas-ai', 'cities', 'balance', 'ratings', 'history', 'chat'].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {COMPANY_TABS.find(t => t.value === tabValue)?.label || tabValue}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8">
                    Funcionalidade em desenvolvimento
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
          
          {/* Aba de Relatórios Analytics */}
          <TabsContent value="reports" className="mt-6">
            <CompanyAnalyticsDashboard
              assignments={myAssignments}
              drivers={drivers || []}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompanyDashboard;
