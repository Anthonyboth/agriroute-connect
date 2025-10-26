import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FreightCard } from '@/components/FreightCard';
import { 
  MessageSquare, 
  Send, 
  Users,
  MapPin,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Driver {
  id: string;
  full_name: string;
  status: string;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  sender?: {
    full_name: string;
  };
}

export function CompanyInternalChat() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadCompanyAndDrivers();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedDriver && companyId) {
      loadMessages();
      
      // Subscribe to new messages
      const channel = supabase
        .channel('company_internal_messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'company_internal_messages',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            loadMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedDriver, companyId]);

  const loadCompanyAndDrivers = async () => {
    try {
      // Get company
      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      if (companyData) {
        setCompanyId(companyData.id);

        // Get drivers
        const { data: driversData } = await supabase
          .from('company_drivers')
          .select(`
            driver_profile_id,
            status,
            driver:profiles!company_drivers_driver_profile_id_fkey(
              id,
              full_name
            )
          `)
          .eq('company_id', companyData.id)
          .eq('status', 'ACTIVE');

        if (driversData) {
          const formattedDrivers = driversData.map((d: any) => ({
            id: d.driver.id,
            full_name: d.driver.full_name,
            status: d.status
          }));
          setDrivers(formattedDrivers);
        }
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadMessages = async () => {
    if (!companyId || !selectedDriver) return;

    try {
      const { data } = await supabase
        .from('company_internal_messages')
        .select(`
          *,
          sender:sender_id (
            full_name
          )
        `)
        .eq('company_id', companyId)
        .or(`sender_id.eq.${selectedDriver.id},sender_id.eq.${profile?.id}`)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleAcceptSharedFreight = async (freightId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'accept-freight-multiple',
        {
          body: { 
            freight_id: freightId,
            num_trucks: 1
          }
        }
      );

      if (error) {
        const errorMsg = (error as any)?.context?.response?.error 
          || (error as any)?.message 
          || 'Não foi possível aceitar o frete';
        toast.error(errorMsg);
        return;
      }

      toast.success('Frete aceito com sucesso!', {
        description: 'O frete foi atribuído à transportadora.'
      });

      loadMessages();
    } catch (error: any) {
      const errorMessage = (error as any)?.context?.response?.error 
        || error?.message 
        || 'Erro ao aceitar frete';
      toast.error(errorMessage);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !companyId || !selectedDriver) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_internal_messages')
        .insert({
          company_id: companyId,
          sender_id: profile?.id,
          message: newMessage,
          message_type: 'TEXT'
        });

      if (error) throw error;

      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Motoristas */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Motoristas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum motorista ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.map((driver) => (
                <Button
                  key={driver.id}
                  variant={selectedDriver?.id === driver.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedDriver(driver)}
                >
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback>{driver.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{driver.full_name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {driver.status}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {selectedDriver ? `Chat com ${selectedDriver.full_name}` : 'Selecione um motorista'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDriver ? (
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Selecione um motorista para iniciar uma conversa
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Messages */}
              <div className="h-96 overflow-y-auto space-y-4 border rounded-lg p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    // Verificar se é mensagem de compartilhamento de frete
                    let freightData = null;
                    try {
                      const parsed = JSON.parse(message.message);
                      if (parsed.type === 'FREIGHT_SHARE') {
                        freightData = parsed;
                      }
                    } catch {
                      // Mensagem normal, não é JSON
                    }

                    if (freightData) {
                      // Converter dados do compartilhamento para formato do FreightCard
                      const freightForCard = {
                        id: freightData.freight_id,
                        cargo_type: freightData.cargo_type,
                        weight: freightData.weight || 0,
                        origin_address: freightData.origin_address,
                        destination_address: freightData.destination_address,
                        origin_city: freightData.origin_city,
                        origin_state: freightData.origin_state,
                        destination_city: freightData.destination_city,
                        destination_state: freightData.destination_state,
                        pickup_date: freightData.pickup_date,
                        delivery_date: freightData.delivery_date,
                        price: freightData.price,
                        minimum_antt_price: freightData.minimum_antt_price || 0,
                        distance_km: freightData.distance_km || 0,
                        urgency: freightData.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
                        status: 'OPEN' as const,
                        service_type: freightData.service_type as 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO',
                        required_trucks: freightData.required_trucks || 1,
                        accepted_trucks: freightData.accepted_trucks || 0
                      };

                      return (
                        <div key={message.id} className="mb-4">
                          {/* Header do compartilhamento */}
                          <div className="mb-2 p-2 bg-primary/5 border border-primary/20 rounded-t-lg">
                            <p className="text-sm text-primary font-medium">
                              🔗 Frete compartilhado por <strong>{freightData.shared_by}</strong>
                              {' • '}
                              {new Date(freightData.shared_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          
                          {/* Card completo do frete */}
                          <FreightCard
                            freight={freightForCard}
                            showActions={true}
                            canAcceptFreights={true}
                            onAction={async (action) => {
                              if (action === 'accept') {
                                await handleAcceptSharedFreight(freightData.freight_id);
                              }
                              loadMessages();
                            }}
                          />
                        </div>
                      );
                    }

                    // Mensagem normal
                    const isOwn = message.sender_id === profile?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button onClick={sendMessage} disabled={loading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
