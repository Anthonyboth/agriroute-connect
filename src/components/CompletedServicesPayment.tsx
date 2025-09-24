import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, MapPin, Wrench, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ComponentLoader } from '@/components/LazyComponents';
import { ServicePaymentModal } from './ServicePaymentModal';

interface CompletedService {
  id: string;
  service_type: string;
  problem_description: string;
  location_address: string;
  final_price: number | null;
  estimated_price: number;
  status: string;
  completed_at: string;
  provider: {
    id: string;
    full_name: string;
  };
  payment?: {
    id: string;
    status: string;
    amount: number;
  };
}

export const CompletedServicesPayment: React.FC = () => {
  const [services, setServices] = useState<CompletedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<CompletedService | null>(null);
  const { toast } = useToast();

  const fetchCompletedServices = async () => {
    try {
      setLoading(true);

      // Buscar serviços concluídos do usuário atual
      const { data: serviceRequests, error: servicesError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false });

      if (servicesError) {
        throw servicesError;
      }

      // Buscar dados do prestador separadamente
      const serviceIds = (serviceRequests || []).map(s => s.id);
      const providerIds = (serviceRequests || []).map(s => s.provider_id);
      
      const { data: providers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', providerIds);

      const { data: payments } = await supabase
        .from('service_payments')
        .select('*')
        .in('service_request_id', serviceIds);

      // Combinar dados
      const servicesWithPayments = (serviceRequests || []).map(service => ({
        ...service,
        provider: providers?.find(p => p.id === service.provider_id) || { id: service.provider_id, full_name: 'Desconhecido' },
        payment: payments?.find(p => p.service_request_id === service.id)
      }));

      setServices(servicesWithPayments as CompletedService[]);
    } catch (err) {
      console.error('Error fetching completed services:', err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os serviços concluídos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedServices();
  }, []);

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'MECANICO':
        return <Wrench className="h-4 w-4" />;
      case 'ELETRICISTA_AUTOMOTIVO':
      case 'AUTO_ELETRICA':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getPaymentStatus = (service: CompletedService) => {
    if (!service.payment) {
      return { status: 'UNPAID', label: 'Não Pago', variant: 'destructive' as const };
    }
    
    switch (service.payment.status) {
      case 'COMPLETED':
        return { status: 'PAID', label: 'Pago', variant: 'default' as const };
      case 'PENDING':
        return { status: 'PROCESSING', label: 'Processando', variant: 'secondary' as const };
      default:
        return { status: 'UNPAID', label: 'Pendente', variant: 'outline' as const };
    }
  };

  if (loading) {
    return <ComponentLoader />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Serviços Concluídos - Pagamentos
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum serviço concluído encontrado
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => {
                const paymentStatus = getPaymentStatus(service);
                const servicePrice = service.final_price || service.estimated_price;

                return (
                  <div key={service.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getServiceIcon(service.service_type)}
                        <div>
                          <p className="font-medium text-sm">
                            {service.service_type.replace('_', ' ').toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {service.provider.full_name}
                          </p>
                        </div>
                      </div>
                      <Badge variant={paymentStatus.variant}>
                        {paymentStatus.label}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {service.problem_description}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {service.location_address}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Concluído em {new Date(service.completed_at).toLocaleString('pt-BR')}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-sm font-medium">
                          R$ {servicePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {service.payment && (
                          <p className="text-xs text-green-600">
                            Comissão: R$ {(service.payment.amount * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (2%)
                          </p>
                        )}
                      </div>

                      {!service.payment && (
                        <Button
                          onClick={() => setSelectedService(service)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Pagar via Stripe
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedService && (
        <ServicePaymentModal
          isOpen={!!selectedService}
          onClose={() => setSelectedService(null)}
          serviceRequest={selectedService}
        />
      )}
    </>
  );
};