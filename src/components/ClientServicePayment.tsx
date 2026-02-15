import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, Shield, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ClientServicePaymentProps {
  serviceRequest: {
    id: string;
    service_type: string;
    problem_description: string;
    location_address: string;
    final_price: number | null;
    estimated_price: number;
    status: string;
    provider: {
      full_name: string;
    };
  };
  onPaymentInitiated?: () => void;
}

export const ClientServicePayment: React.FC<ClientServicePaymentProps> = ({
  serviceRequest,
  onPaymentInitiated
}) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const servicePrice = serviceRequest.final_price || serviceRequest.estimated_price;
  const canPay = serviceRequest.status === 'COMPLETED' && servicePrice > 0;

  const handlePayment = async () => {
    if (!canPay) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-service-payment', {
        body: { serviceRequestId: serviceRequest.id }
      });
      
      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirecionar para o checkout da Stripe
      if (data.url) {
        window.open(data.url, '_blank');
        
        toast({
          title: "Redirecionando para Pagamento",
          description: "Você será direcionado para o checkout seguro da Stripe",
        });

        onPaymentInitiated?.();
      }
    } catch (error: any) {
      console.error('Erro ao iniciar pagamento:', error);
      toast({
        title: "Erro no Pagamento",
        description: error.message || "Não foi possível iniciar o pagamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamento do Serviço
          </span>
          <Badge 
            variant={canPay ? "default" : "secondary"}
            className={canPay ? "bg-green-100 text-green-800" : ""}
          >
            {serviceRequest.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Detalhes do Serviço */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Serviço:</span>
            <span className="text-sm font-medium">
              {serviceRequest.service_type.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Prestador:</span>
            <span className="text-sm font-medium">
              {serviceRequest.provider.full_name}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Valor:</span>
            <Badge variant="outline" className="font-semibold">
              R$ {servicePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
          </div>
        </div>

        {/* Informações de Segurança */}
        {canPay && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-800">
                  Pagamento 100% Seguro via Stripe
                </p>
                <p className="text-xs text-blue-700">
                  Seus dados são protegidos com criptografia de ponta a ponta. 
                  Aceitamos cartão de crédito, débito e PIX.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botão de Pagamento */}
        <Button
          onClick={handlePayment}
          disabled={!canPay || processing}
          className="w-full"
          size="lg"
        >
          {processing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Iniciando Checkout...
            </>
          ) : canPay ? (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar R$ {servicePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              <ExternalLink className="h-3 w-3 ml-2" />
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Pagamento Disponível Após Conclusão
            </>
          )}
        </Button>

        {!canPay && serviceRequest.status !== 'COMPLETED' && (
          <p className="text-xs text-muted-foreground text-center">
            O pagamento ficará disponível assim que o serviço for concluído pelo prestador.
          </p>
        )}
      </CardContent>
    </Card>
  );
};