import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ServicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceRequest: {
    id: string;
    service_type: string;
    problem_description: string;
    location_address: string;
    final_price: number | null;
    estimated_price: number;
    status: string;
  };
}

export const ServicePaymentModal: React.FC<ServicePaymentModalProps> = ({
  isOpen,
  onClose,
  serviceRequest
}) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const servicePrice = serviceRequest.final_price || serviceRequest.estimated_price;

  const handleStripePayment = async () => {
    if (!servicePrice || servicePrice <= 0) {
      toast({
        title: "Erro",
        description: "Valor do serviço inválido",
        variant: "destructive"
      });
      return;
    }

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
        onClose();
        
        toast({
          title: "Checkout Iniciado",
          description: "Você será redirecionado para o pagamento seguro da Stripe",
        });
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamento do Serviço
          </DialogTitle>
          <DialogDescription>
            Finalize o pagamento de forma segura através da Stripe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Detalhes do Serviço */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {serviceRequest.service_type.replace('_', ' ').toUpperCase()}
              </CardTitle>
              <CardDescription className="text-xs">
                {serviceRequest.problem_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="text-xs text-muted-foreground">
                📍 {serviceRequest.location_address}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor do serviço:</span>
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                  R$ {servicePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Informações de Segurança */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-blue-800">
                    Pagamento 100% Seguro
                  </p>
                  <p className="text-xs text-blue-700">
                    Processado pela Stripe com criptografia de ponta a ponta. 
                    Seus dados financeiros estão protegidos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botão de Pagamento */}
          <div className="space-y-2">
            <Button
              onClick={handleStripePayment}
              disabled={processing || serviceRequest.status !== 'COMPLETED'}
              className="w-full"
              size="lg"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar R$ {servicePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>

            {serviceRequest.status !== 'COMPLETED' && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-700">
                  O pagamento só pode ser realizado após a conclusão do serviço.
                </p>
              </div>
            )}
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};