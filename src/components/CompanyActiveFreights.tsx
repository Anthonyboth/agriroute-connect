import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, MapPin, Clock, User, Phone, MessageSquare, Navigation, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CompanyInternalChat } from './CompanyInternalChat';
import { useDriverChat } from '@/hooks/useDriverChat';

interface ActiveFreight {
  id: string;
  assignment_id: string;
  cargo_type: string;
  origin_address: string;
  destination_address: string;
  status: string;
  driver: {
    id: string;
    full_name: string;
    contact_phone?: string;
    rating?: number;
  };
  vehicle?: {
    license_plate: string;
    model: string;
  };
  created_at: string;
  accepted_at: string;
  last_tracking?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
}

export const CompanyActiveFreights: React.FC = () => {
  const { company, drivers } = useTransportCompany();
  const [activeFreights, setActiveFreights] = useState<ActiveFreight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverChat, setSelectedDriverChat] = useState<{
    driverId: string;
    driverName: string;
  } | null>(null);

  useEffect(() => {
    if (company?.id) {
      fetchActiveFreights();
      
      // Real-time subscription
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
          () => {
            fetchActiveFreights();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [company]);

  const fetchActiveFreights = async () => {
    if (!company?.id) return;

    try {
      // Obter IDs dos motoristas afiliados de forma segura
      const affiliatedDriverIds = (drivers || [])
        .map(d => d?.driver_profile_id)
        .filter((id): id is string => Boolean(id));
      
      console.log('[CompanyActiveFreights] affiliatedDriverIds:', affiliatedDriverIds);

      // Construir filtro OR dinâmico
      const orFilters: string[] = [`company_id.eq.${company.id}`];
      if (affiliatedDriverIds.length > 0) {
        orFilters.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }
      const orFilterStr = orFilters.join(',');
      
      // Buscar assignments ativos: por company_id OU por driver afiliado
      const { data: assignments, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*),
          driver:profiles!driver_id(
            id,
            full_name,
            contact_phone,
            rating
          ),
          vehicle:vehicles(license_plate, model)
        `)
        .or(orFilterStr)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      const formattedFromAssignments: ActiveFreight[] = (assignments || []).map((a: any) => ({
        id: a.freight.id,
        assignment_id: a.id,
        cargo_type: a.freight.cargo_type,
        origin_address: a.freight.origin_address,
        destination_address: a.freight.destination_address,
        status: a.status,
        driver: a.driver,
        vehicle: a.vehicle,
        created_at: a.freight.created_at,
        accepted_at: a.accepted_at,
        last_tracking: null
      }));

      // 🔗 Fallback: também buscar fretes diretos da empresa
      const { data: directFreights } = await supabase
        .from('freights')
        .select(`
          *,
          driver:profiles!freights_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
        .order('created_at', { ascending: false });

      const formattedFromFreights: ActiveFreight[] = (directFreights || []).map((f: any) => ({
        id: f.id,
        assignment_id: f.id, // sem assignment, usamos o id do frete como fallback
        cargo_type: f.cargo_type,
        origin_address: f.origin_address,
        destination_address: f.destination_address,
        status: f.status,
        driver: f.driver ? { id: f.driver.id, full_name: f.driver.full_name } : { id: '', full_name: 'Motorista' },
        vehicle: undefined,
        created_at: f.created_at,
        accepted_at: f.created_at,
        last_tracking: null
      }));

      // Mesclar e deduplicar por id de frete
      const byFreightId = new Map<string, ActiveFreight>();
      [...formattedFromAssignments, ...formattedFromFreights].forEach((item) => {
        byFreightId.set(item.id, item);
      });

      setActiveFreights(Array.from(byFreightId.values()));
    } catch (error) {
      console.error('Erro ao buscar fretes ativos:', error);
      toast.error('Erro ao carregar fretes em andamento');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      ACCEPTED: { label: 'Aceito', variant: 'outline' },
      LOADING: { label: 'Carregando', variant: 'secondary' },
      LOADED: { label: 'Carregado', variant: 'secondary' },
      IN_TRANSIT: { label: 'Em Trânsito', variant: 'default' },
      DELIVERED_PENDING_CONFIRMATION: { label: 'Aguardando Confirmação', variant: 'outline' }
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Carregando fretes em andamento...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fretes em Andamento
            <Badge variant="secondary">{activeFreights.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeFreights.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhum frete em andamento</h3>
              <p className="text-muted-foreground">
                Seus motoristas não têm fretes ativos no momento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeFreights.map((freight) => (
                <Card key={freight.assignment_id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Header com Status */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{freight.cargo_type}</h4>
                          <p className="text-sm text-muted-foreground">
                            Aceito {formatDistanceToNow(new Date(freight.accepted_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                        </div>
                        {getStatusBadge(freight.status)}
                      </div>

                      {/* Motorista e Veículo */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{freight.driver?.full_name || 'Motorista'}</span>
                          {freight.driver?.rating && (
                            <Badge variant="outline" className="text-xs">
                              {freight.driver.rating.toFixed(1)}★
                            </Badge>
                          )}
                        </div>
                        {freight.vehicle && (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {freight.vehicle.license_plate}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Rota */}
                      <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Origem</p>
                            <p className="text-sm">{freight.origin_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Destino</p>
                            <p className="text-sm">{freight.destination_address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 pt-2">
                        {freight.driver?.contact_phone && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => window.open(`tel:${freight.driver.contact_phone}`)}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Ligar
                          </Button>
                        )}
                        <ChatButton
                          companyId={company?.id || ''}
                          driverId={freight.driver?.id || ''}
                          driverName={freight.driver?.full_name || 'Motorista'}
                          onOpenChat={() => setSelectedDriverChat({
                            driverId: freight.driver?.id || '',
                            driverName: freight.driver?.full_name || 'Motorista'
                          })}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => toast.info('Rastreamento GPS em desenvolvimento')}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Rastrear
                        </Button>
                      </div>

                      {/* Alertas (se houver) */}
                      {freight.status === 'DELIVERED_PENDING_CONFIRMATION' && (
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-900">
                              Aguardando confirmação de entrega
                            </p>
                            <p className="text-xs text-yellow-700">
                              O motorista reportou a entrega. O produtor tem 72h para confirmar.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Chat */}
      {selectedDriverChat && (
        <Dialog open={!!selectedDriverChat} onOpenChange={() => setSelectedDriverChat(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Chat com {selectedDriverChat.driverName}</DialogTitle>
            </DialogHeader>
            <div className="h-[60vh]">
              <CompanyInternalChat />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Componente auxiliar para o botão de chat com badge de não lidas
const ChatButton: React.FC<{
  companyId: string;
  driverId: string;
  driverName: string;
  onOpenChat: () => void;
}> = ({ companyId, driverId, driverName, onOpenChat }) => {
  const { unreadCount } = useDriverChat(companyId, driverId);

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex-1 relative"
      onClick={onOpenChat}
    >
      <MessageSquare className="h-3 w-3 mr-1" />
      Chat
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
};
