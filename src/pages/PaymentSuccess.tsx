import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type') || 'payment';

  useEffect(() => {
    // Simulate processing time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const getSuccessMessage = () => {
    switch (type) {
      case 'subscription':
        return {
          title: 'Assinatura Confirmada!',
          message: 'Sua assinatura foi processada com sucesso. Agora você tem acesso a todos os recursos do seu plano.',
          redirectPath: '/dashboard',
          redirectText: 'Ir para Dashboard'
        };
      case 'freight_advance':
        return {
          title: 'Adiantamento Aprovado!',
          message: 'Seu adiantamento foi processado com sucesso. O valor será creditado em sua conta.',
          redirectPath: '/producer-dashboard',
          redirectText: 'Ver Meus Fretes'
        };
      case 'freight_payment':
        return {
          title: 'Pagamento Concluído!',
          message: 'O pagamento do frete foi processado com sucesso. O frete foi marcado como entregue.',
          redirectPath: '/producer-dashboard',
          redirectText: 'Ver Histórico'
        };
      default:
        return {
          title: 'Pagamento Aprovado!',
          message: 'Seu pagamento foi processado com sucesso.',
          redirectPath: '/',
          redirectText: 'Voltar ao Início'
        };
    }
  };

  const successInfo = getSuccessMessage();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-lg font-semibold mb-2">Processando pagamento...</h2>
            <p className="text-sm text-muted-foreground text-center">
              Aguarde enquanto confirmamos sua transação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
            {successInfo.title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            {successInfo.message}
          </p>
          
          {sessionId && (
            <div className="bg-muted/20 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">ID da Transação</p>
              <p className="font-mono text-sm break-all">{sessionId}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to={successInfo.redirectPath}>
                {successInfo.redirectText}
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}