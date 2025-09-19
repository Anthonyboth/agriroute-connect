import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Clock, User, Truck, MessageCircle, Star, Phone, FileText, CreditCard, DollarSign, Bell } from 'lucide-react';
import { FreightChat } from './FreightChat';
import { FreightStatusTracker } from './FreightStatusTracker';
import { FreightRatingModal } from './FreightRatingModal';
import { FreightAdvanceModal } from './FreightAdvanceModal';
import { FreightPaymentModal } from './FreightPaymentModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';

interface FreightDetailsProps {
  freightId: string;
  currentUserProfile: any;
  onClose: () => void;
  onFreightWithdraw?: (freight: any) => void;
}

export const FreightDetails: React.FC<FreightDetailsProps> = ({
  freightId,
  currentUserProfile,
  onClose,
  onFreightWithdraw
}) => {
  // No toast initialization needed - using sonner directly
  const [freight, setFreight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [userToRate, setUserToRate] = useState<any>(null);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [advances, setAdvances] = useState<any[]>([]);

  const fetchFreightDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!producer_id(id, full_name, contact_phone, role),
          driver:profiles!driver_id(id, full_name, contact_phone, role)
        `)
        .eq('id', freightId)
        .single();

      if (error) throw error;
      setFreight(data);

      // Buscar adiantamentos
      const { data: advancesData } = await supabase
        .from('freight_advances')
        .select('*')
        .eq('freight_id', freightId)
        .order('requested_at', { ascending: false });
      
      setAdvances(advancesData || []);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do frete:', error);
      toast.error("Erro ao carregar frete: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <Badge variant={getFreightStatusVariant(status)}>{getFreightStatusLabel(status)}</Badge>;
  };

  const canRate = () => {
    return freight?.status === 'DELIVERED' && currentUserProfile;
  };

  const handleOpenRating = (userToRate: any) => {
    setUserToRate(userToRate);
    setRatingModalOpen(true);
  };

  const isProducer = currentUserProfile?.role === 'PRODUTOR';
  const isDriver = currentUserProfile?.role === 'MOTORISTA';
  const isParticipant = freight?.producer?.id === currentUserProfile?.id || freight?.driver?.id === currentUserProfile?.id;
  const isFreightProducer = freight?.producer?.id === currentUserProfile?.id;
  
  const totalAdvances = advances.reduce((sum, advance) => sum + (advance.approved_amount || 0), 0);
  const remainingAmount = freight?.price - totalAdvances;
  
  const canRequestAdvance = isDriver && (freight?.status === 'ACCEPTED' || freight?.status === 'LOADING' || freight?.status === 'IN_TRANSIT') && totalAdvances < (freight?.price * 0.5);
  const canMakePayment = isFreightProducer && freight?.status === 'DELIVERED' && remainingAmount > 0;

  useEffect(() => {
    fetchFreightDetails();
  }, [freightId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando detalhes do frete...</p>
        </CardContent>
      </Card>
    );
  }

  if (!freight) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Frete não encontrado.</p>
          <Button onClick={onClose} className="mt-4">Voltar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Frete: {freight.cargo_type}
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(freight.status)}
              <Button variant="destructive" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-muted-foreground">Peso:</span>
            <p className="font-medium">{(freight.weight / 1000).toFixed(1)}t</p>
          </div>
          <div>
            <span className="text-muted-foreground">Distância:</span>
            <p className="font-medium">{freight.distance_km} km</p>
          </div>
          <div>
            <span className="text-muted-foreground">Valor:</span>
            <p className="font-medium">R$ {freight.price?.toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Urgência:</span>
            <p className="font-medium">{freight.urgency}</p>
          </div>
        </CardContent>
      </Card>

      {/* Route Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-success" />
              Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{freight.origin_address}</p>
            <p className="text-sm text-muted-foreground mt-2">
              <Clock className="h-3 w-3 inline mr-1" />
              Coleta: {format(new Date(freight.pickup_date), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
            {freight.pickup_observations && (
              <p className="text-sm mt-2 p-2 bg-muted rounded">
                {freight.pickup_observations}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-destructive" />
              Destino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{freight.destination_address}</p>
            <p className="text-sm text-muted-foreground mt-2">
              <Clock className="h-3 w-3 inline mr-1" />
              Entrega: {format(new Date(freight.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
            {freight.delivery_observations && (
              <p className="text-sm mt-2 p-2 bg-muted rounded">
                {freight.delivery_observations}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Produtor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{freight.producer?.full_name}</p>
                {freight.producer?.contact_phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {freight.producer.contact_phone}
                  </p>
                )}
              </div>
              {canRate() && isDriver && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenRating(freight.producer)}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Avaliar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {freight.driver && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Motorista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{freight.driver?.full_name}</p>
                  {freight.driver?.contact_phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {freight.driver.contact_phone}
                    </p>
                  )}
                </div>
                {canRate() && isProducer && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenRating(freight.driver)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Avaliar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Advance Request Notifications */}
      {isProducer && advances && advances.filter(advance => advance.status === 'PENDING').length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell className="h-5 w-5 text-orange-600" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">
                    {advances.filter(advance => advance.status === 'PENDING').length}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-orange-800">
                    {advances.filter(advance => advance.status === 'PENDING').length === 1 
                      ? 'Nova solicitação de adiantamento' 
                      : `${advances.filter(advance => advance.status === 'PENDING').length} solicitações de adiantamento`
                    }
                  </p>
                  <p className="text-sm text-orange-600">
                    O motorista solicitou adiantamento para este frete
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  const element = document.getElementById('advance-requests');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                Ver Solicitações
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Actions */}
      {(canRequestAdvance || canMakePayment || (isDriver && freight?.status === 'ACCEPTED')) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {(canRequestAdvance || canMakePayment) ? 'Pagamentos' : 'Ações do Frete'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalAdvances > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Adiantamentos pagos: R$ {totalAdvances.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Valor restante: R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Pending Advance Requests for Producers */}
            {isProducer && advances && advances.length > 0 && (
              <div className="space-y-3" id="advance-requests">
                <h4 className="font-medium text-sm">Solicitações de Adiantamento</h4>
                {advances.filter(advance => advance.status === 'PENDING').map((advance) => (
                  <div key={advance.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Adiantamento solicitado</p>
                        <p className="text-2xl font-bold text-orange-600">
                          R$ {((advance.requested_amount || 0) / 100).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Solicitado em {new Date(advance.requested_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.functions.invoke('approve-freight-advance', {
                              body: { advance_id: advance.id }
                            });
                            if (error) throw error;
                            window.open(data.url, '_blank');
                            toast.success("Redirecionando para pagamento do adiantamento");
                          } catch (error) {
                            console.error('Error approving advance:', error);
                            toast.error("Erro ao processar pagamento do adiantamento");
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pagar Adiantamento
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Advance History */}
            {advances && advances.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Histórico de Adiantamentos</h4>
                {advances.filter(advance => advance.status !== 'PENDING').map((advance) => (
                  <div key={advance.id} className="bg-muted/20 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          R$ {((advance.approved_amount || advance.requested_amount || 0) / 100).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {advance.status === 'APPROVED' ? 'Aprovado' : 
                           advance.status === 'PAID' ? 'Pago' : 
                           advance.status === 'REJECTED' ? 'Rejeitado' : advance.status}
                        </p>
                      </div>
                      <Badge variant={
                        advance.status === 'PAID' ? 'default' : 
                        advance.status === 'APPROVED' ? 'secondary' : 
                        'destructive'
                      }>
                        {advance.status === 'PAID' ? 'Pago' : 
                         advance.status === 'APPROVED' ? 'Aprovado' : 
                         advance.status === 'REJECTED' ? 'Rejeitado' : advance.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3">
              {canRequestAdvance && (
                <Button 
                  onClick={() => setAdvanceModalOpen(true)}
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Solicitar Adiantamento
                </Button>
              )}
              
              {canMakePayment && (
                <Button 
                  onClick={() => setPaymentModalOpen(true)}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar Frete
                </Button>
              )}
            </div>

            {/* Botão de desistir do frete para motoristas */}
            {isDriver && (freight?.status === 'ACCEPTED' || freight?.status === 'LOADING') && onFreightWithdraw && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => onFreightWithdraw(freight)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
                >
                  Desistir do Frete (Taxa R$ 20)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs - Only for participants */}
      {isParticipant && (
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="status">Status da Viagem</TabsTrigger>
            <TabsTrigger value="chat">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="mt-6">
            <FreightStatusTracker
              freightId={freightId}
              currentStatus={freight.status}
              currentUserProfile={currentUserProfile}
              isDriver={isDriver}
            />
          </TabsContent>
          
          <TabsContent value="chat" className="mt-6">
            <FreightChat
              freightId={freightId}
              currentUserProfile={currentUserProfile}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Documents */}
      {freight.fiscal_documents_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <a 
                href={freight.fiscal_documents_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Visualizar Documentos
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      {ratingModalOpen && userToRate && (
        <FreightRatingModal
          isOpen={ratingModalOpen}
          onClose={() => setRatingModalOpen(false)}
          freightId={freightId}
          userToRate={userToRate}
          currentUserProfile={currentUserProfile}
        />
      )}

      {advanceModalOpen && (
        <FreightAdvanceModal
          isOpen={advanceModalOpen}
          onClose={() => setAdvanceModalOpen(false)}
          freightId={freightId}
          freightPrice={freight?.price || 0}
        />
      )}

      {paymentModalOpen && (
        <FreightPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          freightId={freightId}
          freightPrice={freight?.price || 0}
          advancesTotal={totalAdvances}
        />
      )}
    </div>
  );
};