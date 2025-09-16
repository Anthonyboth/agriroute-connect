import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'payment';

  const getCancelMessage = () => {
    switch (type) {
      case 'subscription':
        return {
          title: 'Assinatura Cancelada',
          message: 'Você cancelou o processo de assinatura. Nenhuma cobrança foi realizada.',
          redirectPath: '/plans',
          redirectText: 'Ver Planos Novamente'
        };
      case 'freight_advance':
        return {
          title: 'Adiantamento Cancelado',
          message: 'Você cancelou a solicitação de adiantamento. Nenhuma cobrança foi realizada.',
          redirectPath: '/producer-dashboard',
          redirectText: 'Voltar aos Fretes'
        };
      case 'freight_payment':
        return {
          title: 'Pagamento Cancelado',
          message: 'Você cancelou o pagamento do frete. Nenhuma cobrança foi realizada.',
          redirectPath: '/producer-dashboard',
          redirectText: 'Voltar aos Fretes'
        };
      default:
        return {
          title: 'Pagamento Cancelado',
          message: 'Você cancelou o processo de pagamento. Nenhuma cobrança foi realizada.',
          redirectPath: '/',
          redirectText: 'Voltar ao Início'
        };
    }
  };

  const cancelInfo = getCancelMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 to-muted/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-orange-700 dark:text-orange-400">
            {cancelInfo.title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            {cancelInfo.message}
          </p>
          
          <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Não se preocupe!</strong> Você pode tentar novamente a qualquer momento. 
              Seus dados foram salvos e você pode continuar de onde parou.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to={cancelInfo.redirectPath} className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                {cancelInfo.redirectText}
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