import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Clock, User, Truck, MessageCircle, Star, Phone, FileText } from 'lucide-react';
import { FreightChat } from './FreightChat';
import { FreightStatusTracker } from './FreightStatusTracker';
import { FreightRatingModal } from './FreightRatingModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FreightDetailsProps {
  freightId: string;
  currentUserProfile: any;
  onClose: () => void;
}

export const FreightDetails: React.FC<FreightDetailsProps> = ({
  freightId,
  currentUserProfile,
  onClose
}) => {
  const { toast } = useToast();
  const [freight, setFreight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [userToRate, setUserToRate] = useState<any>(null);

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
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do frete:', error);
      toast({
        title: "Erro ao carregar frete",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'OPEN': { label: 'Aberto', variant: 'default' as const },
      'IN_NEGOTIATION': { label: 'Em Negociação', variant: 'secondary' as const },
      'ACCEPTED': { label: 'Aceito', variant: 'default' as const },
      'LOADING': { label: 'Carregando', variant: 'secondary' as const },
      'LOADED': { label: 'Carregado', variant: 'secondary' as const },
      'IN_TRANSIT': { label: 'Em Trânsito', variant: 'secondary' as const },
      'DELIVERED': { label: 'Entregue', variant: 'default' as const },
      'CANCELLED': { label: 'Cancelado', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
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
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-muted-foreground">Peso:</span>
            <p className="font-medium">{freight.weight >= 1000 ? `${(freight.weight / 1000).toFixed(1)}t` : `${freight.weight}kg`}</p>
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

      {/* Rating Modal */}
      {ratingModalOpen && userToRate && (
        <FreightRatingModal
          isOpen={ratingModalOpen}
          onClose={() => setRatingModalOpen(false)}
          freightId={freightId}
          userToRate={userToRate}
          currentUserProfile={currentUserProfile}
        />
      )}
    </div>
  );
};