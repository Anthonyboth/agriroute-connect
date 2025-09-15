import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import FreightCard from '@/components/FreightCard';
import CreateFreightModal from '@/components/CreateFreightModal';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const [freights, setFreights] = useState<any[]>([]);
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
        userProfile={profile}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Notificação de assinatura */}
        <SubscriptionExpiryNotification />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard do Produtor</h1>
          <p className="text-muted-foreground">Gerencie seus fretes e acompanhe o desempenho</p>
        </div>

        <Tabs defaultValue="fretes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fretes">Fretes Imediatos</TabsTrigger>
            <TabsTrigger value="agendados">Fretes Agendados</TabsTrigger>
          </TabsList>

          <TabsContent value="fretes" className="space-y-6">
            <div className="mb-6 space-y-4">
              <FreightLimitTracker />
              <div className="flex justify-end">
                <CreateFreightModal 
                  onFreightCreated={fetchFreights}
                  userProfile={profile}
                />
              </div>
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
                          cargo_type: freight.cargo_type,
                          weight: freight.weight,
                          distance_km: freight.distance_km,
                          origin_address: freight.origin_address,
                          destination_address: freight.destination_address,
                          price: freight.price,
                          status: freight.status,
                          pickup_date: freight.pickup_date,
                          delivery_date: freight.delivery_date,
                          urgency: freight.urgency,
                          minimum_antt_price: freight.minimum_antt_price || 0
                        }}
                        onAction={() => {}}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agendados">
            <ScheduledFreightsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProducerDashboard;