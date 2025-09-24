import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentIntegrationProps {
  requestId: string;
  providerId: string;
  amount: number;
  onPaymentComplete: () => void;
}

export const PaymentIntegration: React.FC<PaymentIntegrationProps> = ({
  requestId,
  providerId,
  amount,
  onPaymentComplete
}) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const processPayment = async () => {
    setProcessing(true);
    try {
      // Simular processamento de pagamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Pagamento Processado",
        description: `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será creditado em sua conta`,
      });

      onPaymentComplete();
    } catch (error: any) {
      console.error('Erro no processamento do pagamento:', error);
      toast({
        title: "Erro no Pagamento",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="bg-green-50 border-green-200 mt-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center text-green-800">
          <DollarSign className="h-4 w-4 mr-1" />
          Pagamento do Serviço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">Valor do serviço:</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
          </div>
          
          <Button
            onClick={processPayment}
            disabled={processing}
            className="w-full mt-3 bg-green-600 hover:bg-green-700"
            size="sm"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="h-3 w-3 mr-1" />
                Receber Pagamento
              </>
            )}
          </Button>
          
          <p className="text-xs text-green-600 mt-2">
            O pagamento será creditado instantaneamente em sua conta da plataforma.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};