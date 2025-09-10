import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle } from 'lucide-react';
import heroLogistics from '@/assets/hero-logistics.jpg';

interface Freight {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string; // Allow all database status values
  distance_km: number;
  minimum_antt_price: number;
}

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  status: string; // Allow all database status values
  freight?: Freight;
}

const DriverDashboard = () => {
  const { profile } = useAuth();
  const [availableFreights, setAvailableFreights] = useState<Freight[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [filters, setFilters] = useState({
    cargo_type: '',
    service_type: '',
    min_weight: '',
    max_weight: '',
    max_distance: '',
    min_price: '',
    max_price: '',
    origin_city: '',
    destination_city: '',
    vehicle_type: '',
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      cargo_type: '',
      service_type: '',
      min_weight: '',
      max_weight: '',
      max_distance: '',
      min_price: '',
      max_price: '',
      origin_city: '',
      destination_city: '',
      vehicle_type: '',
    });
  };
  const [loading, setLoading] = useState(true);

  // Buscar fretes disponíveis
  const fetchAvailableFreights = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableFreights(data || []);
    } catch (error) {
      console.error('Error fetching freights:', error);
      toast.error('Erro ao carregar fretes disponíveis');
    }
  };

  // Buscar propostas do motorista
  const fetchMyProposals = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(*)
        `)
        .eq('driver_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar suas propostas');
    }
  };

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAvailableFreights(), fetchMyProposals()]);
      setLoading(false);
    };

    if (profile) {
      loadData();
    }
  }, [profile]);

  // Calcular estatísticas
  const acceptedProposals = myProposals.filter(p => p.status === 'ACCEPTED');
  const activeTrips = acceptedProposals.filter(p => p.freight?.status === 'IN_TRANSIT').length;
  const completedTrips = acceptedProposals.filter(p => p.freight?.status === 'DELIVERED').length;
  const availableCount = availableFreights.length;
  const totalEarnings = acceptedProposals
    .filter(p => p.freight?.status === 'DELIVERED')
    .reduce((sum, proposal) => sum + (proposal.proposed_price || 0), 0);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erro ao fazer logout');
    } else {
      toast.success('Logout realizado com sucesso');
    }
  };

  const handleMenuClick = () => {
    // Implementar menu lateral se necessário
  };

  const handleFreightAction = async (freightId: string, action: 'propose' | 'accept' | 'complete') => {
    if (!profile?.id) return;

    try {
      if (action === 'propose') {
        // Criar uma proposta para o frete
        const freight = availableFreights.find(f => f.id === freightId);
        if (!freight) return;

        const { error } = await supabase
          .from('freight_proposals')
          .insert({
            freight_id: freightId,
            driver_id: profile.id,
            proposed_price: freight.price, // Por enquanto aceita o preço oferecido
            status: 'PENDING'
          });

        if (error) throw error;
        
        toast.success('Proposta enviada com sucesso!');
        fetchMyProposals(); // Atualizar lista
      }
    } catch (error) {
      console.error('Error handling freight action:', error);
      toast.error('Erro ao processar ação');
    }
  };

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
      <Header 
        user={{ name: profile?.full_name || 'Motorista', role: 'MOTORISTA' }}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <section className="relative h-[300px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10 text-center text-white">
          <h1 className="text-4xl font-bold mb-4">
            Olá, {profile?.full_name || 'Motorista'}
          </h1>
          <p className="text-xl mb-6 opacity-90">
            Encontre fretes agrícolas próximos e aumente sua renda
          </p>
          <Button 
            variant="default"
            size="lg"
            onClick={() => setActiveTab('available')}
            className="bg-white text-primary hover:bg-white/90"
          >
            <MapPin className="mr-2 h-5 w-5" />
            Buscar Fretes
          </Button>
        </div>
      </section>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <MapPin className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Fretes Disponíveis
                  </p>
                  <p className="text-2xl font-bold">{availableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Viagens Ativas
                  </p>
                  <p className="text-2xl font-bold">{activeTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Concluídas
                  </p>
                  <p className="text-2xl font-bold">{completedTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ganhos Totais
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 0
                    }).format(totalEarnings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available">Fretes Disponíveis ({availableCount})</TabsTrigger>
            <TabsTrigger value="my-trips">Minhas Propostas ({myProposals.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="available" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Fretes Disponíveis</h3>
              <Button variant="outline" size="sm">
                Filtros
              </Button>
            </div>
            {availableFreights.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableFreights.map((freight) => (
                  <FreightCard 
                    key={freight.id} 
                    freight={{
                      ...freight,
                      status: freight.status as 'OPEN'
                    }}
                    onAction={(action) => handleFreightAction(freight.id, action)}
                    showActions={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum frete disponível no momento
              </p>
            )}
          </TabsContent>
          <TabsContent value="my-trips" className="space-y-4">
            <h3 className="text-lg font-semibold">Minhas Propostas e Viagens</h3>
            {myProposals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myProposals.map((proposal) => (
                  proposal.freight && (
                    <div key={proposal.id} className="relative">
                      <FreightCard 
                        freight={{
                          ...proposal.freight,
                          status: proposal.freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED'
                        }}
                        showActions={false}
                      />
                      <div className="mt-2 flex justify-between items-center">
                        <Badge 
                          variant={
                            proposal.status === 'ACCEPTED' ? 'default' :
                            proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                          }
                        >
                          {proposal.status === 'ACCEPTED' ? 'Aceita' :
                           proposal.status === 'PENDING' ? 'Pendente' : 'Rejeitada'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Proposta: R$ {proposal.proposed_price?.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Você ainda não fez propostas para fretes
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DriverDashboard;