import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  MessageSquare, 
  MapPin, 
  Calendar,
  DollarSign,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { FreightChat } from './FreightChat';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { getCargoTypeLabel } from '@/lib/cargo-types';

interface Freight {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: string;
  status: string;
  distance_km: number;
  service_type?: string;
  created_at: string;
  producer?: {
    id: string;
    full_name: string;
  };
  driver?: {
    id: string;
    full_name: string;
  };
}

export const FreightHistory: React.FC = () => {
  const { profile } = useAuth();
  const [freights, setFreights] = useState<Freight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFreight, setSelectedFreight] = useState<Freight | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (profile?.id) {
      fetchFreights();
      
      // Real-time updates
      const channel = supabase
        .channel('freight-history-updates')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'freights' 
        }, () => {
          fetchFreights();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  const fetchFreights = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name),
          driver:profiles!freights_driver_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (profile.role === 'PRODUTOR') {
        query = query.eq('producer_id', profile.id);
      } else if (profile.role === 'MOTORISTA') {
        query = query.eq('driver_id', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform data to match interface
      const transformedData = (data || []).map(item => ({
        ...item,
        producer: Array.isArray(item.producer) && item.producer.length > 0 ? item.producer[0] : undefined,
        driver: Array.isArray(item.driver) && item.driver.length > 0 ? item.driver[0] : undefined
      }));
      
      setFreights(transformedData as Freight[]);
    } catch (error) {
      console.error('Erro ao carregar histórico de fretes:', error);
      toast.error('Erro ao carregar histórico de fretes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLabel = getFreightStatusLabel(status as any);
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      'OPEN': { label: statusLabel, variant: 'default', icon: AlertCircle },
      'ACCEPTED': { label: statusLabel, variant: 'secondary', icon: CheckCircle },
      'IN_TRANSIT': { label: statusLabel, variant: 'secondary', icon: Truck },
      'DELIVERED': { label: statusLabel, variant: 'outline', icon: CheckCircle },
      'DELIVERED_PENDING_CONFIRMATION': { label: statusLabel, variant: 'secondary', icon: Clock },
      'CANCELLED': { label: statusLabel, variant: 'destructive', icon: XCircle }
    };
    return statusMap[status] || { label: statusLabel, variant: 'default', icon: AlertCircle };
  };

  const filteredFreights = freights.filter(freight => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['OPEN', 'ACCEPTED', 'IN_TRANSIT'].includes(freight.status);
    if (activeTab === 'completed') return ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION'].includes(freight.status);
    if (activeTab === 'cancelled') return freight.status === 'CANCELLED';
    return true;
  });

  const openChatDialog = (freight: Freight) => {
    setSelectedFreight(freight);
    setShowChatDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Histórico de Fretes
          </CardTitle>
          <CardDescription>
            {profile?.role === 'PRODUTOR' 
              ? 'Visualize todos os fretes que você criou'
              : 'Visualize todos os fretes que você transportou'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos ({freights.length})</TabsTrigger>
              <TabsTrigger value="active">
                Ativos ({freights.filter(f => ['OPEN', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Concluídos ({freights.filter(f => ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).length})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelados ({freights.filter(f => f.status === 'CANCELLED').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-4">
              {filteredFreights.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum frete encontrado</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' && (profile?.role === 'PRODUTOR' 
                      ? 'Você ainda não criou nenhum frete.'
                      : 'Você ainda não transportou nenhum frete.')}
                    {activeTab === 'active' && 'Não há fretes ativos no momento.'}
                    {activeTab === 'completed' && 'Nenhum frete foi concluído ainda.'}
                    {activeTab === 'cancelled' && 'Nenhum frete foi cancelado.'}
                  </p>
                </div>
              ) : (
                filteredFreights.map((freight) => {
                  const statusBadge = getStatusBadge(freight.status);
                  const urgencyLabel = getUrgencyLabel(freight.urgency as any);
                  const urgencyVariant = getUrgencyVariant(freight.urgency as any);
                  const StatusIcon = statusBadge.icon;
                  const isProducer = profile?.role === 'PRODUTOR';

                  return (
                    <Card key={freight.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">
                                {getCargoTypeLabel(freight.cargo_type)}
                              </CardTitle>
                              <Badge variant={statusBadge.variant}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusBadge.label}
                              </Badge>
                              <Badge variant={urgencyVariant}>
                                {urgencyLabel}
                              </Badge>
                            </div>
                            <CardDescription>
                              {freight.weight} kg • {freight.distance_km} km
                              {isProducer && freight.driver && ` • Motorista: ${freight.driver.full_name}`}
                              {!isProducer && freight.producer && ` • Produtor: ${freight.producer.full_name}`}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              R$ {freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">Origem:</p>
                              <p className="text-muted-foreground line-clamp-2">{freight.origin_address}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">Destino:</p>
                              <p className="text-muted-foreground line-clamp-2">{freight.destination_address}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Coleta:</p>
                              <p className="text-muted-foreground">
                                {format(new Date(freight.pickup_date), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-medium">Entrega:</p>
                              <p className="text-muted-foreground">
                                {format(new Date(freight.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </div>

                        {freight.service_type && (
                          <div className="pt-2 border-t">
                            <Badge variant="outline" className="text-xs">
                              {freight.service_type}
                            </Badge>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openChatDialog(freight)}
                            className="flex-1"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de Chat */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedFreight && `${getCargoTypeLabel(selectedFreight.cargo_type)} - Chat`}
            </DialogTitle>
          </DialogHeader>
          {selectedFreight && profile && (
            <div className="h-[60vh]">
              <FreightChat 
                freightId={selectedFreight.id}
                currentUserProfile={profile}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
