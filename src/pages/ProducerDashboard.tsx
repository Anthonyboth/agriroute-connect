import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import FreightCard from '@/components/FreightCard';
import CreateFreightModal from '@/components/CreateFreightModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProducerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [freights, setFreights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchFreights();
    }
  }, [profile]);

  const fetchFreights = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('producer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFreights(data || []);
    } catch (error) {
      console.error('Error fetching freights:', error);
      toast.error('Erro ao carregar fretes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const openFreights = freights.filter(f => f.status === 'OPEN').length;
  const activeFreights = freights.filter(f => ['IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).length;
  const completedFreights = freights.filter(f => f.status === 'DELIVERED').length;
  const totalValue = freights.reduce((sum, f) => sum + f.price, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as 'PRODUTOR' | 'MOTORISTA') || 'PRODUTOR' }}
        onLogout={signOut}
        onMenuClick={() => {}}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard do Produtor</h1>
          <p className="text-muted-foreground">Gerencie seus fretes e acompanhe o desempenho</p>
        </div>

        <div className="mb-6">
          <CreateFreightModal 
            onFreightCreated={fetchFreights}
            userProfile={profile}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Fretes Abertos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openFreights}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeFreights}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedFreights}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meus Fretes</CardTitle>
          </CardHeader>
          <CardContent>
            {freights.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum frete cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {freights.map((freight) => (
                  <FreightCard
                    key={freight.id}
                    freight={{
                      id: freight.id,
                      cargoType: freight.cargo_type,
                      weight: freight.weight,
                      distance: freight.distance_km,
                      origin: freight.origin_address,
                      destination: freight.destination_address,
                      price: freight.price,
                      status: freight.status,
                      pickupDate: freight.pickup_date,
                      deliveryDate: freight.delivery_date,
                      urgency: freight.urgency,
                      description: freight.description
                    }}
                    userRole="PRODUTOR"
                    onAction={() => {}}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProducerDashboard;