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

const CompanyDashboard = () => {
  const { profile, profiles, switchProfile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const { company, isLoadingCompany } = useTransportCompany();

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-auto min-w-full w-max sm:w-full p-1 gap-1 bg-card border rounded-lg">
              <TabsTrigger value="overview" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Building2 className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Visão Geral</span>
                <span className="sm:hidden">Visão</span>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Users className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Motoristas</span>
                <span className="sm:hidden">Mot</span>
              </TabsTrigger>
              <TabsTrigger value="fleet" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Truck className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Frota</span>
                <span className="sm:hidden">Frota</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Link2 className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Vínculos</span>
                <span className="sm:hidden">Vínc</span>
              </TabsTrigger>
              <TabsTrigger value="freights" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Package className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Fretes</span>
                <span className="sm:hidden">Fretes</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Calendar className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendamentos</span>
                <span className="sm:hidden">Agend</span>
              </TabsTrigger>
              <TabsTrigger value="ai-freights" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Brain className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Fretes IA</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
              <TabsTrigger value="active" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Navigation className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger value="proposals" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <FileText className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Prop</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <DollarSign className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Pagamentos</span>
                <span className="sm:hidden">Pag</span>
              </TabsTrigger>
              <TabsTrigger value="areas-ai" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Target className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Áreas IA</span>
                <span className="sm:hidden">Áreas</span>
              </TabsTrigger>
              <TabsTrigger value="cities" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Cidades</span>
                <span className="sm:hidden">Cid</span>
              </TabsTrigger>
              <TabsTrigger value="balance" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Banknote className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Saldo</span>
                <span className="sm:hidden">$</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Hist</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Chat Interno</span>
                <span className="sm:hidden">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium">
                <BarChart className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Relatórios</span>
                <span className="sm:hidden">Rel</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
            <AdvancedVehicleManager onVehicleAdd={() => {}} />
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
      
    </div>
  );
};

export default CompanyDashboard;
