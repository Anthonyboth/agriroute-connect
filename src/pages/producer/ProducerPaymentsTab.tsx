import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  History,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { PaymentCard, PaymentCardData } from '@/components/producer/PaymentCard';
import { PaymentsSummary } from '@/components/producer/PaymentsSummary';
import { PaymentChatModal } from '@/components/producer/PaymentChatModal';
import { PaymentsExportButton } from '@/components/producer/PaymentsExportButton';
import { PaymentsFilters, PaymentFilters, usePaymentsFilter } from '@/components/producer/PaymentsFilters';
import type { FreightPayment } from './types';

interface ProducerPaymentsTabProps {
  externalPayments: PaymentCardData[];
  freightPayments: FreightPayment[];
  paymentLoading: boolean;
  onConfirmExternalPayment: (freightId: string, amount: number) => void;
  onConfirmPaymentMade: (paymentId: string) => Promise<void> | void;
  onProcessStripePayment: (freightId: string, amount: number) => void;
  currentUserProfile?: any;
  onRefresh?: () => void;
}

export const ProducerPaymentsTab: React.FC<ProducerPaymentsTabProps> = ({
  externalPayments,
  freightPayments,
  paymentLoading,
  onConfirmPaymentMade,
  currentUserProfile,
  onRefresh,
}) => {
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [activeTab, setActiveTab] = useState('received');

  // Apply filters to payments
  const filteredPayments = usePaymentsFilter(externalPayments, filters);

  // ✅ Normalizar status para categorização (confirmed → completed)
  const normalizeStatus = (status: string) => status === 'confirmed' ? 'completed' : status;

  // ========== 4 SEÇÕES OBRIGATÓRIAS ==========
  // A) Solicitações de pagamento recebidas (motorista solicitou)
  const receivedRequests = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'proposed' || normalizeStatus(p.status) === 'requested'
  );
  
  // B) Pagamentos pendentes de execução (aprovados, aguardando pagamento)
  const pendingExecution = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'approved'
  );
  
  // C) Pagos aguardando confirmação do motorista
  const awaitingConfirmation = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'paid_by_producer'
  );
  
  // D) Histórico (concluídos, cancelados, rejeitados)
  const historyPayments = filteredPayments.filter(p => 
    ['completed', 'rejected', 'cancelled', 'disputed'].includes(normalizeStatus(p.status))
  );

  const handleOpenChat = (freightId: string, driverId: string) => {
    const payment = externalPayments.find(p => p.freight_id === freightId);
    setSelectedFreightId(freightId);
    setSelectedDriverName(payment?.driver?.full_name || 'Motorista');
    setChatModalOpen(true);
  };

  const handleConfirmPayment = async (paymentId: string) => {
    await onConfirmPaymentMade(paymentId);
    // ✅ Após confirmar pagamento, mover automaticamente para aba "Aguardando"
    setActiveTab('awaiting');
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const hasPayments = externalPayments.length > 0 || freightPayments.length > 0;
  const hasFilteredPayments = filteredPayments.length > 0;

  const renderPaymentSection = (
    payments: PaymentCardData[], 
    emptyTitle: string,
    emptyDescription: string,
    defaultExpanded: boolean = false
  ) => {
    if (payments.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
            <h4 className="font-medium text-base mb-1">{emptyTitle}</h4>
            <p className="text-sm text-muted-foreground max-w-sm">{emptyDescription}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {payments.map((payment, index) => (
          <PaymentCard
            key={payment.id}
            payment={payment}
            onConfirmPayment={handleConfirmPayment}
            onOpenChat={handleOpenChat}
            isLoading={paymentLoading}
            defaultExpanded={defaultExpanded && index === 0}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header com título e ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Gestão de Pagamentos</h3>
          {onRefresh && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRefresh}
              disabled={paymentLoading}
            >
              <RefreshCw className={`h-4 w-4 ${paymentLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
        <PaymentsExportButton 
          payments={filteredPayments}
          dateRange={filters.dateRange}
          disabled={filteredPayments.length === 0}
        />
      </div>

      {/* Resumo Financeiro */}
      {hasPayments && (
        <PaymentsSummary payments={externalPayments} />
      )}

      {/* Filtros Avançados */}
      {hasPayments && (
        <PaymentsFilters
          payments={externalPayments}
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Indicador de filtros ativos */}
      {hasPayments && filteredPayments.length !== externalPayments.length && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Mostrando {filteredPayments.length} de {externalPayments.length} pagamentos
        </div>
      )}
      
      {/* Tabs com as 4 seções obrigatórias */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="received" className="flex flex-col gap-1 py-2 px-1 text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Recebidas</span>
            </span>
            {receivedRequests.length > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {receivedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="pending" className="flex flex-col gap-1 py-2 px-1 text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pendentes</span>
            </span>
            {pendingExecution.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                {pendingExecution.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="awaiting" className="flex flex-col gap-1 py-2 px-1 text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Aguardando</span>
            </span>
            {awaitingConfirmation.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700">
                {awaitingConfirmation.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="history" className="flex flex-col gap-1 py-2 px-1 text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </span>
            {historyPayments.length > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {historyPayments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* A) Solicitações Recebidas */}
        <TabsContent value="received" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Solicitações de Pagamento Recebidas
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Motoristas e prestadores solicitaram estes pagamentos. Revise e aprove ou conteste.
              </p>
            </CardHeader>
            <CardContent>
              {renderPaymentSection(
                receivedRequests,
                "Nenhuma solicitação pendente",
                "Quando motoristas solicitarem pagamentos, eles aparecerão aqui.",
                true
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* B) Pagamentos Pendentes de Execução */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-600" />
                Pagamentos Pendentes de Execução
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pagamentos aprovados que aguardam execução via Stripe ou confirmação manual.
              </p>
            </CardHeader>
            <CardContent>
              {renderPaymentSection(
                pendingExecution,
                "Nenhum pagamento pendente",
                "Pagamentos aprovados aguardando execução aparecerão aqui."
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* C) Pagos Aguardando Confirmação */}
        <TabsContent value="awaiting" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                Pagos - Aguardando Confirmação do Motorista
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Você já efetuou o pagamento. Aguardando o motorista confirmar o recebimento.
              </p>
            </CardHeader>
            <CardContent>
              {renderPaymentSection(
                awaitingConfirmation,
                "Nenhum pagamento aguardando confirmação",
                "Pagamentos efetuados que aguardam confirmação do motorista."
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* D) Histórico */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5 text-green-600" />
                Histórico de Pagamentos
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pagamentos concluídos, cancelados ou em disputa.
              </p>
            </CardHeader>
            <CardContent>
              {historyPayments.length > 0 ? (
                <div className="space-y-3">
                  {historyPayments.slice(0, 20).map((payment) => (
                    <PaymentCard
                      key={payment.id}
                      payment={payment}
                      onConfirmPayment={handleConfirmPayment}
                      onOpenChat={handleOpenChat}
                      isLoading={paymentLoading}
                    />
                  ))}
                  {historyPayments.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Mostrando 20 de {historyPayments.length} pagamentos
                    </p>
                  )}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
                    <h4 className="font-medium text-base mb-1">Sem histórico</h4>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Pagamentos finalizados aparecerão aqui.
                    </p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Estado vazio global */}
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
