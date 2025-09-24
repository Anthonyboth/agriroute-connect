import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, CreditCard, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function ServicePaymentCancel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    // Mostrar toast informativo
    toast({
      title: "Pagamento Cancelado",
      description: "O pagamento foi cancelado. Você pode tentar novamente a qualquer momento.",
      variant: "default"
    });

    // Countdown para redirecionamento automático
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard/client');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-orange-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-xl text-orange-800">
            Pagamento Cancelado
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              O pagamento foi cancelado e nenhuma cobrança foi efetuada.
            </p>
            <p className="text-sm font-medium">
              Você pode tentar realizar o pagamento novamente quando estiver pronto.
            </p>
          </div>

          {/* Informação sobre o Cancelamento */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Nenhuma Cobrança Realizada</span>
            </div>
            <p className="text-xs text-orange-600">
              Seu cartão ou conta não foi debitado. O pagamento pode ser refeito a qualquer momento.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/dashboard/client')}
              className="w-full"
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Redirecionamento automático em {countdown}s
              </p>
            </div>
          </div>

          {/* Informações Úteis */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Como pagar depois:
            </h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Acesse o serviço concluído no seu dashboard</li>
              <li>• Clique em "Pagar Serviço" quando estiver pronto</li>
              <li>• O prestador receberá automaticamente após o pagamento</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}