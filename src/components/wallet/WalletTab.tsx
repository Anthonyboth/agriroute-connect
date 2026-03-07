import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, CreditCard } from 'lucide-react';
import { WalletOverview } from './WalletOverview';
import { WalletStatement } from './WalletStatement';
import { WalletDepositModal } from './WalletDepositModal';
import { WalletWithdrawModal } from './WalletWithdrawModal';
import { PaymentManagementTab } from './PaymentManagementTab';
import { useWallet } from '@/hooks/useWallet';
import { useWalletActions } from '@/hooks/useWalletActions';

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
  
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

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

        <TabsContent value="wallet" className="space-y-6 mt-4">
          <WalletOverview
            wallet={wallet}
            loading={loading}
            error={error}
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
            role={role}
          />

          <WalletStatement
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
    </div>
  );
};
