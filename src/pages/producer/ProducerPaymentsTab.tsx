import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, CreditCard, DollarSign } from 'lucide-react';
import type { ExternalPayment, FreightPayment } from './types';

interface ProducerPaymentsTabProps {
  externalPayments: ExternalPayment[];
  freightPayments: FreightPayment[];
  paymentLoading: boolean;
  onConfirmExternalPayment: (freightId: string, amount: number) => void;
  onConfirmPaymentMade: (paymentId: string) => void;
  onProcessStripePayment: (freightId: string, amount: number) => void;
}

export const ProducerPaymentsTab: React.FC<ProducerPaymentsTabProps> = ({
  externalPayments,
  freightPayments,
  paymentLoading,
  onConfirmExternalPayment,
  onConfirmPaymentMade,
  onProcessStripePayment,
}) => {
  const proposedPayments = externalPayments.filter(p => p.status === 'proposed');
  const pendingDriverConfirmation = externalPayments.filter(p => p.status === 'paid_by_producer');
  const completedPayments = externalPayments.filter(p => p.status === 'completed');
  const pendingFreightPayments = freightPayments.filter(p => p.status === 'PENDING');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Pagamentos</h3>
      </div>
      
      <div className="space-y-6">
        {/* Pagamentos Externos Solicitados */}
        {proposedPayments.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-blue-700">Solicitações de Pagamento Recebidas</h4>
            {proposedPayments.map((payment) => (
              <Card key={payment.id} className="p-4 border-blue-200 bg-blue-50/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-semibold text-lg">
                        Solicitação de Pagamento - {payment.freight?.cargo_type || 'Frete'}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        Valor solicitado: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Motorista: {payment.driver?.full_name}
                      </p>
                      {payment.notes && (
                        <p className="text-sm mt-2 p-2 bg-gray-100 rounded">
                          Nota: {payment.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => onConfirmPaymentMade(payment.id)}
                        size="sm"
                        disabled={paymentLoading}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar Pagamento
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagamentos Aguardando Confirmação do Motorista */}
        {pendingDriverConfirmation.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-orange-700">Aguardando Confirmação do Motorista</h4>
            {pendingDriverConfirmation.map((payment) => (
              <Card key={payment.id} className="p-4 border-orange-200 bg-orange-50/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-semibold text-lg">
                        Pagamento Informado - {payment.freight?.cargo_type || 'Frete'}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        Valor: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Motorista: {payment.driver?.full_name}
                      </p>
                    </div>
                    <div className="flex items-center text-orange-600">
                      <Clock className="h-4 w-4 mr-2" />
                      Aguardando confirmação
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagamentos de Fretes Pendentes */}
        {pendingFreightPayments.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-purple-700">Pagamentos de Frete Pendentes</h4>
            {pendingFreightPayments.map((payment) => (
              <Card key={payment.id} className="p-4 border-purple-200 bg-purple-50/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-semibold text-lg">Pagamento Pendente</h5>
                      <p className="text-sm text-muted-foreground">
                        Valor: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <Button
                      onClick={() => onProcessStripePayment(payment.freight_id, payment.amount)}
                      size="sm"
                      disabled={paymentLoading}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pagar via Stripe
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagamentos Concluídos */}
        {completedPayments.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-green-700">Pagamentos Concluídos</h4>
            {completedPayments.slice(0, 5).map((payment) => (
              <Card key={payment.id} className="p-4 border-green-200 bg-green-50/50">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-semibold">
                      {payment.freight?.cargo_type || 'Frete'}
                    </h5>
                    <p className="text-sm text-muted-foreground">
                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Concluído
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Estado vazio */}
        {proposedPayments.length === 0 && 
         pendingDriverConfirmation.length === 0 && 
         pendingFreightPayments.length === 0 &&
         completedPayments.length === 0 && (
          <Card className="border-dashed">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhum pagamento</h3>
              <p className="text-muted-foreground max-w-sm">
                Você não possui pagamentos pendentes ou histórico de pagamentos.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
