import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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

  const filteredPayments = usePaymentsFilter(externalPayments, filters);

  const normalizeStatus = (status: string) => status === 'confirmed' ? 'completed' : status;

  const receivedRequests = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'proposed' || normalizeStatus(p.status) === 'requested'
  );
  
  const pendingExecution = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'approved'
  );
  
  const awaitingConfirmation = filteredPayments.filter(p => 
    normalizeStatus(p.status) === 'paid_by_producer'
  );
  
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
    setActiveTab('awaiting');
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const hasPayments = externalPayments.length > 0 || freightPayments.length > 0;

  const renderPaymentSection = (
    payments: PaymentCardData[], 
    emptyTitle: string,
    emptyDescription: string,
    defaultExpanded: boolean = false
  ) => {
    if (payments.length === 0) {
      return (
        <Card className="border-dashed bg-card">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h4 className="font-medium text-base mb-1 text-foreground">{emptyTitle}</h4>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{emptyDescription}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
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
          <h3 className="text-lg font-semibold text-foreground">Gestão de Pagamentos</h3>
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
        <div className="text-sm text-muted-foreground bg-muted/30 px-4 py-2.5 rounded-lg flex items-center gap-2 border border-border/30">
          <AlertCircle className="h-4 w-4" />
          Mostrando {filteredPayments.length} de {externalPayments.length} pagamentos
        </div>
      )}
      
      {/* Tabs com as 4 seções */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto gap-1 bg-muted/40 p-1.5 rounded-xl">
          <TabsTrigger value="received" className="flex flex-col gap-1.5 py-2.5 px-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Recebidas</span>
            </span>
            {receivedRequests.length > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {receivedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="pending" className="flex flex-col gap-1.5 py-2.5 px-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Pendentes</span>
            </span>
            {pendingExecution.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-500/[0.08] text-orange-700 border-orange-200">
                {pendingExecution.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="awaiting" className="flex flex-col gap-1.5 py-2.5 px-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Aguardando</span>
            </span>
            {awaitingConfirmation.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-500/[0.08] text-blue-700 border-blue-200">
                {awaitingConfirmation.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="history" className="flex flex-col gap-1.5 py-2.5 px-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <span className="flex items-center gap-1.5">
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
        <TabsContent value="received" className="mt-6">
          <div className="space-y-5">
            <div className="px-1">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2.5 mb-1.5">
                <Clock className="h-5 w-5 text-blue-600" />
                Solicitações de Pagamento Recebidas
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Motoristas e prestadores solicitaram estes pagamentos. Revise e aprove ou conteste.
              </p>
            </div>
            {renderPaymentSection(
              receivedRequests,
              "Nenhuma solicitação pendente",
              "Quando motoristas solicitarem pagamentos, eles aparecerão aqui.",
              true
            )}
          </div>
        </TabsContent>

        {/* B) Pagamentos Pendentes */}
        <TabsContent value="pending" className="mt-6">
          <div className="space-y-5">
            <div className="px-1">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2.5 mb-1.5">
                <DollarSign className="h-5 w-5 text-orange-600" />
                Pagamentos Pendentes de Execução
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pagamentos aprovados que aguardam execução via Stripe ou confirmação manual.
              </p>
            </div>
            {renderPaymentSection(
              pendingExecution,
              "Nenhum pagamento pendente",
              "Pagamentos aprovados aguardando execução aparecerão aqui."
            )}
          </div>
        </TabsContent>

        {/* C) Aguardando Confirmação */}
        <TabsContent value="awaiting" className="mt-6">
          <div className="space-y-5">
            <div className="px-1">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2.5 mb-1.5">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                Pagos - Aguardando Confirmação do Motorista
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você já efetuou o pagamento. Aguardando o motorista confirmar o recebimento.
              </p>
            </div>
            {renderPaymentSection(
              awaitingConfirmation,
              "Nenhum pagamento aguardando confirmação",
              "Pagamentos efetuados que aguardam confirmação do motorista."
            )}
          </div>
        </TabsContent>

        {/* D) Histórico */}
        <TabsContent value="history" className="mt-6">
          <div className="space-y-5">
            <div className="px-1">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2.5 mb-1.5">
                <History className="h-5 w-5 text-emerald-600" />
                Histórico de Pagamentos
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pagamentos concluídos, cancelados ou em disputa.
              </p>
            </div>
            {historyPayments.length > 0 ? (
              <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Mostrando 20 de {historyPayments.length} pagamentos
                  </p>
                )}
              </div>
            ) : (
              <Card className="border-dashed bg-card">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <h4 className="font-medium text-base mb-1 text-foreground">Sem histórico</h4>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Pagamentos finalizados aparecerão aqui.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Estado vazio global */}
      {!hasPayments && (
        <Card className="border-dashed bg-card">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-2 text-foreground">Nenhum pagamento</h3>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
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
