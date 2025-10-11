import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Settings, 
  MapPin, 
  Brain, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Eye,
  EyeOff,
  Wrench,
  Target
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';
import { ServicesModal } from '@/components/ServicesModal';
import { useToast } from '@/hooks/use-toast';

interface ServiceProviderStats {
  total_requests: number;
  pending_requests: number;
  accepted_requests: number;
  completed_requests: number;
  total_earnings: number;
}

export const ServiceProviderHeroDashboard: React.FC = () => {
  const { profile, profiles } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ServiceProviderStats>({
    total_requests: 0,
    pending_requests: 0,
    accepted_requests: 0,
    completed_requests: 0,
    total_earnings: 0
  });
  const [showEarnings, setShowEarnings] = useState(true);
  const [showServiceTypesModal, setShowServiceTypesModal] = useState(false);
  const [showAreasModal, setShowAreasModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const getProviderProfileId = () => {
    if (profile?.role === 'PRESTADOR_SERVICOS') return profile.id;
    const alt = (profiles || []).find((p: any) => p.role === 'PRESTADOR_SERVICOS');
    return alt?.id as string | undefined;
  };

  useEffect(() => {
    fetchStats();
  }, [profile, profiles]);

  const fetchStats = async () => {
    const providerProfileId = getProviderProfileId();
    if (!providerProfileId) {
      setStats({
        total_requests: 0,
        pending_requests: 0,
        accepted_requests: 0,
        completed_requests: 0,
        total_earnings: 0
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
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
        total_earnings: totalEarnings
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar estatísticas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const userName = profile?.full_name || 'Prestador';
  const firstName = userName.split(' ')[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-green-500 to-green-600 text-white overflow-hidden">
        <div className="relative container mx-auto px-4 py-12 md:py-16">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Olá, {firstName}
            </h1>
            <p className="text-green-100 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Sistema IA encontra solicitações de serviços para você
            </p>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto">
              <Button
                onClick={() => setShowAreasModal(true)}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto bg-white/90 hover:bg-white text-green-700 border-0 shadow-lg"
              >
                <MapPin className="h-5 w-5 mr-2" />
                Configurar Região
              </Button>
              
              <Button
                onClick={() => setShowServiceTypesModal(true)}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto bg-white/90 hover:bg-white text-green-700 border-0 shadow-lg"
              >
                <Wrench className="h-5 w-5 mr-2" />
                Configurar Serviços
              </Button>
              
              <Button
                onClick={() => setServicesModalOpen(true)}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto bg-white/90 hover:bg-white text-green-700 border-0 shadow-lg"
              >
                <Settings className="h-5 w-5 mr-2" />
                Solicitar Serviços
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container mx-auto px-4 -mt-8 pb-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Disponível</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Ativas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.accepted_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Concluídos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completed_requests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Saldo</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {showEarnings 
                        ? 'R$ 0,00'
                        : '****'
                      }
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEarnings(!showEarnings)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                >
                  {showEarnings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showServiceTypesModal} onOpenChange={setShowServiceTypesModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Configurar Tipos de Serviços
            </DialogTitle>
          </DialogHeader>
          <ServiceProviderServiceTypeManager />
        </DialogContent>
      </Dialog>

      <Dialog open={showAreasModal} onOpenChange={setShowAreasModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Gerenciar Áreas de Atendimento
            </DialogTitle>
          </DialogHeader>
          <ServiceProviderAreasManager />
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Prestador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Configurações Disponíveis</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowServiceTypesModal(true);
                    }}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Tipos de Serviços
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowAreasModal(true);
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Áreas de Atendimento
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      fetchStats();
                      toast({
                        title: "Estatísticas atualizadas",
                        description: "Dados foram recarregados com sucesso.",
                      });
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Atualizar Estatísticas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
      
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />
    </div>
  );
};

export default ServiceProviderHeroDashboard;