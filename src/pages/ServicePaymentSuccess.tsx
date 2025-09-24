import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, CreditCard, ArrowRight, Receipt } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function ServicePaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Mostrar toast de sucesso
    toast({
      title: "Pagamento Processado com Sucesso!",
      description: "Seu pagamento foi confirmado pela Stripe. O prestador será notificado automaticamente.",
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-green-200 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl text-green-800">
            Pagamento Confirmado!
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Seu pagamento foi processado com sucesso pela Stripe.
            </p>
            <p className="text-sm font-medium">
              O prestador foi notificado e o valor foi creditado automaticamente em sua conta.
            </p>
          </div>

          {/* Informações do Pagamento */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <Receipt className="h-4 w-4" />
              <span className="text-sm font-medium">Comprovante Stripe</span>
            </div>
            <p className="text-xs text-green-600">
              Você receberá um e-mail com o comprovante oficial da Stripe em instantes.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/dashboard/client')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Redirecionamento automático em {countdown}s
              </p>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Próximos passos:
            </h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• O prestador foi notificado sobre o pagamento</li>
              <li>• Você pode avaliar o serviço no dashboard</li>
              <li>• O comprovante chegará por e-mail</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}