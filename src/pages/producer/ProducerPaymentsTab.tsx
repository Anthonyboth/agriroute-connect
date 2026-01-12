import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { PaymentCard, PaymentCardData } from '@/components/producer/PaymentCard';
import { PaymentsSummary } from '@/components/producer/PaymentsSummary';
import { PaymentChatModal } from '@/components/producer/PaymentChatModal';
import type { FreightPayment } from './types';

interface ProducerPaymentsTabProps {
  externalPayments: PaymentCardData[];
  freightPayments: FreightPayment[];
  paymentLoading: boolean;
  onConfirmExternalPayment: (freightId: string, amount: number) => void;
  onConfirmPaymentMade: (paymentId: string) => void;
  onProcessStripePayment: (freightId: string, amount: number) => void;
  currentUserProfile?: any;
}

export const ProducerPaymentsTab: React.FC<ProducerPaymentsTabProps> = ({
  externalPayments,
  freightPayments,
  paymentLoading,
  onConfirmPaymentMade,
  currentUserProfile,
}) => {
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');

  const proposedPayments = externalPayments.filter(p => p.status === 'proposed');
  const pendingDriverConfirmation = externalPayments.filter(p => p.status === 'paid_by_producer');
  const completedPayments = externalPayments.filter(p => p.status === 'completed');

  const handleOpenChat = (freightId: string, driverId: string) => {
    const payment = externalPayments.find(p => p.freight_id === freightId);
    setSelectedFreightId(freightId);
    setSelectedDriverName(payment?.driver?.full_name || 'Motorista');
    setChatModalOpen(true);
  };

  const handleConfirmPayment = (paymentId: string) => {
    onConfirmPaymentMade(paymentId);
  };

  const hasPayments = externalPayments.length > 0 || freightPayments.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Pagamentos</h3>
      </div>

      {/* Resumo Financeiro */}
      {hasPayments && (
        <PaymentsSummary payments={externalPayments} />
      )}
      
      <div className="space-y-6">
        {/* Solicitações de Pagamento (Pendentes) */}
        {proposedPayments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-blue-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              Solicitações de Pagamento ({proposedPayments.length})
            </h4>
            <div className="space-y-3">
              {proposedPayments.map((payment, index) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onConfirmPayment={handleConfirmPayment}
                  onOpenChat={handleOpenChat}
                  isLoading={paymentLoading}
                  defaultExpanded={index === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Aguardando Confirmação do Motorista */}
        {pendingDriverConfirmation.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-orange-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-600 rounded-full" />
              Aguardando Confirmação do Motorista ({pendingDriverConfirmation.length})
            </h4>
            <div className="space-y-3">
              {pendingDriverConfirmation.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onConfirmPayment={handleConfirmPayment}
                  onOpenChat={handleOpenChat}
                  isLoading={paymentLoading}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pagamentos Concluídos */}
        {completedPayments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-green-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full" />
              Pagamentos Concluídos ({completedPayments.length})
            </h4>
            <div className="space-y-3">
              {completedPayments.slice(0, 10).map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onConfirmPayment={handleConfirmPayment}
                  onOpenChat={handleOpenChat}
                  isLoading={paymentLoading}
                />
              ))}
              {completedPayments.length > 10 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Mostrando 10 de {completedPayments.length} pagamentos concluídos
                </p>
              )}
            </div>
          </div>
        )}

        {/* Estado Vazio */}
        {!hasPayments && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nenhum pagamento</h3>
              <p className="text-muted-foreground max-w-sm">
                Você não possui pagamentos pendentes ou histórico de pagamentos no momento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Chat */}
      <PaymentChatModal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        freightId={selectedFreightId}
        driverName={selectedDriverName}
        currentUserProfile={currentUserProfile}
      />
    </div>
  );
};
