import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, CreditCard } from 'lucide-react';
import { SmartFinancialCard } from './SmartFinancialCard';
import { EscrowFlowCard } from './EscrowFlowCard';
import { PaymentOrdersCard } from './PaymentOrdersCard';
import { FinancialTimeline } from './FinancialTimeline';
import { FinancialNotifications } from './FinancialNotifications';
import { OperationalPaymentsCard } from './OperationalPaymentsCard';
import { CashflowForecastCard } from './CashflowForecastCard';
import { AutopayCard } from './AutopayCard';
import { DynamicCreditCard } from './DynamicCreditCard';
import { IncentiveBonusCard } from './IncentiveBonusCard';
import { WalletDepositModal } from './WalletDepositModal';
import { WalletWithdrawModal } from './WalletWithdrawModal';
import { CreditSimulatorModal } from './CreditSimulatorModal';
import { AdvanceSimulatorModal } from './AdvanceSimulatorModal';
import { PaymentManagementTab } from './PaymentManagementTab';
import { useWallet } from '@/hooks/useWallet';
import { useWalletActions } from '@/hooks/useWalletActions';
import { useCredit } from '@/hooks/useCredit';
import { useReceivableAdvance } from '@/hooks/useReceivableAdvance';
import { usePaymentOrders } from '@/hooks/usePaymentOrders';
import { toast } from 'sonner';

interface WalletTabProps {
  role: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'PRESTADOR';
  isAffiliated?: boolean;
  affiliatedCompanyId?: string;
  /** Existing payment components to embed in Gestão de Pagamentos */
  legacyPaymentContent?: React.ReactNode;
}

export const WalletTab: React.FC<WalletTabProps> = ({
  role,
  isAffiliated = false,
  affiliatedCompanyId,
  legacyPaymentContent
}) => {
  const { wallet, transactions, loading, error, refetch } = useWallet();
  const { deposit, withdraw, loading: actionLoading } = useWalletActions(refetch);
  const { creditAccount, pendingInstallments, totalPending, installments } = useCredit();
  const { totalEligible, eligibleReceivables } = useReceivableAdvance();
  const { orders, payouts, escrowTotal, releasedTotal, blockedTotal, loading: ordersLoading } = usePaymentOrders();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [creditSimOpen, setCreditSimOpen] = useState(false);
  const [advanceSimOpen, setAdvanceSimOpen] = useState(false);

  const creditAvailable = creditAccount?.available_limit || 0;
  const totalReceivable = eligibleReceivables.reduce((s, r) => s + (r.total_amount - r.committed_amount), 0);
  const overdueInstallments = pendingInstallments.filter(i => i.status === 'overdue').length;

  // Recently released: completed transactions from last 24h
  const recentlyReleasedAmount = transactions
    .filter(tx => {
      if (tx.transaction_type !== 'freight_credit' && tx.transaction_type !== 'release') return false;
      if (tx.status !== 'completed') return false;
      const txDate = new Date(tx.created_at);
      return (Date.now() - txDate.getTime()) < 24 * 60 * 60 * 1000;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  // Role-based: produtores não devem ver antecipação
  const canAdvance = role !== 'PRODUTOR';

  return (
    <div className="space-y-4">
      <Tabs defaultValue="wallet" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wallet" className="gap-2">
            <Wallet className="h-4 w-4" />
            Carteira AgriRoute
          </TabsTrigger>
          <TabsTrigger value="management" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Gestão de Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallet" className="space-y-4 mt-4">
          {/* Smart Notifications */}
          <FinancialNotifications
            availableBalance={wallet?.available_balance || 0}
            totalReceivable={totalReceivable}
            creditAvailable={creditAvailable}
            pendingInstallments={pendingInstallments.length}
            overdueInstallments={overdueInstallments}
            totalPendingAmount={totalPending}
            onAdvance={() => setAdvanceSimOpen(true)}
            onPayInstallment={() => toast.info('Acesse a aba Gestão de Pagamentos para pagar parcelas')}
            onWithdraw={() => setWithdrawOpen(true)}
            onUseCredit={() => setCreditSimOpen(true)}
            role={role}
            escrowTotal={escrowTotal}
            releasedTotal={releasedTotal}
            recentlyReleasedAmount={recentlyReleasedAmount}
            installments={installments}
          />

          {/* Smart Financial Card */}
          <SmartFinancialCard
            wallet={wallet}
            loading={loading}
            error={error}
            creditAvailable={creditAvailable}
            totalReceivable={totalReceivable}
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
            onUseCredit={() => setCreditSimOpen(true)}
            onAdvance={() => setAdvanceSimOpen(true)}
            role={role}
            isAffiliated={isAffiliated}
            escrowTotal={escrowTotal}
            releasedTotal={releasedTotal}
          />

          {/* Cashflow Forecast */}
          <CashflowForecastCard />

          {/* Incentive Bonuses */}
          <IncentiveBonusCard role={role} />

          {/* Autopay + Dynamic Credit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AutopayCard />
            <DynamicCreditCard />
          </div>

          {/* Escrow Flow States */}
          <EscrowFlowCard wallet={wallet} />

          {/* Payment Orders & Split */}
          <PaymentOrdersCard
            orders={orders}
            payouts={payouts}
            escrowTotal={escrowTotal}
            releasedTotal={releasedTotal}
            loading={ordersLoading}
          />

          {/* Operational Payments */}
          <OperationalPaymentsCard
            availableBalance={wallet?.available_balance || 0}
            creditAvailable={creditAvailable}
            role={role}
          />

          {/* Financial Timeline */}
          <FinancialTimeline
            transactions={transactions}
            loading={loading}
            onRefresh={refetch}
          />
        </TabsContent>

        <TabsContent value="management" className="space-y-6 mt-4">
          <PaymentManagementTab
            role={role}
            isAffiliated={isAffiliated}
            affiliatedCompanyId={affiliatedCompanyId}
            walletId={wallet?.id}
            legacyContent={legacyPaymentContent}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <WalletDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onDeposit={deposit}
        loading={actionLoading}
      />
      <WalletWithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={withdraw}
        loading={actionLoading}
        availableBalance={wallet?.available_balance || 0}
      />
      <CreditSimulatorModal
        open={creditSimOpen}
        onClose={() => setCreditSimOpen(false)}
        creditLimit={creditAvailable}
      />
      {canAdvance && (
        <AdvanceSimulatorModal
          open={advanceSimOpen}
          onClose={() => setAdvanceSimOpen(false)}
          totalEligible={totalEligible}
          eligibleCount={eligibleReceivables.length}
        />
      )}
    </div>
  );
};
