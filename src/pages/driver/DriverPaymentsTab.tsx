import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Banknote, CheckCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface Payment {
  id: string;
  freight_id: string;
  producer_id: string;
  amount: number;
  payment_method?: string;
  payment_notes?: string;
  created_at?: string;
  freight?: {
    id: string;
    price?: number;
    pricing_type?: string;
    price_per_km?: number;
    price_per_ton?: number;
    required_trucks?: number;
    weight?: number;
    distance_km?: number;
  };
}

interface DriverPaymentsTabProps {
  pendingPayments: Payment[];
  onConfirmPayment: (payment: { id: string; freight_id: string; producer_id: string }) => void;
  onDisputePayment: (paymentId: string) => void;
}

export const DriverPaymentsTab: React.FC<DriverPaymentsTabProps> = ({
  pendingPayments,
  onConfirmPayment,
  onDisputePayment,
}) => {
  const getUnitPrice = (payment: Payment): string => {
    if (payment.freight) {
      const pd = precoPreenchidoDoFrete(payment.freight.id, {
        price: payment.freight.price || 0,
        pricing_type: payment.freight.pricing_type,
        price_per_km: payment.freight.price_per_km,
        price_per_ton: payment.freight.price_per_ton,
        required_trucks: payment.freight.required_trucks,
        weight: payment.freight.weight,
        distance_km: payment.freight.distance_km,
      }, { unitOnly: true });
      return pd.primaryText;
    }
    return 'Preço indisponível';
  };

  return (
    <SafeListWrapper>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Pagamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum pagamento pendente</h3>
              <p className="text-muted-foreground">
                Quando um produtor confirmar pagamento por fora da plataforma, aparecerá aqui para você confirmar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirme apenas pagamentos já recebidos</AlertTitle>
                <AlertDescription>
                  Verifique se o valor foi realmente creditado antes de confirmar. Se houver problema, use "Contestar".
                </AlertDescription>
              </Alert>
              
              <Separator />
              
              <SafeListWrapper fallback={<div className="p-4 text-muted-foreground">Carregando pagamentos...</div>}>
                {pendingPayments.map((payment) => (
                  <Card key={payment.id} className="bg-gradient-to-r from-green-50/30 to-emerald-50/30 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200 dark:border-green-800">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg">Pagamento Externo</h4>
                          <p className="text-sm text-muted-foreground">
                            ID do frete: {payment.freight_id?.slice(0, 8)}...
                          </p>
                        </div>
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {getUnitPrice(payment)}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="gradient-primary flex-1"
                          onClick={() => onConfirmPayment({
                            id: payment.id,
                            freight_id: payment.freight_id,
                            producer_id: payment.producer_id
                          })}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirmar Recebimento
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => onDisputePayment(payment.id)}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Contestar
                        </Button>
                      </div>

                      {payment.payment_method && (
                        <p className="text-xs text-muted-foreground">
                          Método: {payment.payment_method === 'PIX' ? '💳 PIX' : 
                                  payment.payment_method === 'TED' ? '🏦 TED' : 
                                  payment.payment_method === 'MONEY' ? '💵 Dinheiro' : payment.payment_method}
                          {payment.created_at && ` • ${new Date(payment.created_at).toLocaleDateString('pt-BR')}`}
                        </p>
                      )}

                      {payment.payment_notes && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded text-xs">
                          <p className="font-medium mb-1">Observações:</p>
                          <p className="text-muted-foreground">{payment.payment_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>
    </SafeListWrapper>
  );
};
