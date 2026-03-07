import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, ArrowDownToLine, ArrowUpFromLine, 
  Clock, Lock, ShieldAlert, AlertTriangle 
} from 'lucide-react';
import type { WalletData } from '@/hooks/useWallet';

interface WalletOverviewProps {
  wallet: WalletData | null;
  loading: boolean;
  error: string | null;
  onDeposit: () => void;
  onWithdraw: () => void;
  role: string;
}

const formatBRL = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const WalletOverview: React.FC<WalletOverviewProps> = ({
  wallet, loading, error, onDeposit, onWithdraw, role
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const balanceCards = [
    {
      label: 'Saldo Disponível',
      value: wallet?.available_balance || 0,
      icon: Wallet,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Saldo Pendente',
      value: wallet?.pending_balance || 0,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Saldo Reservado',
      value: wallet?.reserved_balance || 0,
      icon: Lock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Saldo Bloqueado',
      value: wallet?.blocked_balance || 0,
      icon: ShieldAlert,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status badge */}
      {wallet?.status && wallet.status !== 'active' && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-2 py-3">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">
              Carteira {wallet.status === 'blocked' ? 'Bloqueada' : 'Em Análise'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {balanceCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="shadow-sm border-border/60">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                    <p className="text-lg font-bold text-foreground">{formatBRL(card.value)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onDeposit} className="gap-2" variant="default">
          <ArrowDownToLine className="h-4 w-4" />
          Adicionar Dinheiro
        </Button>
        <Button 
          onClick={onWithdraw} 
          className="gap-2" 
          variant="outline"
          disabled={!wallet || wallet.available_balance <= 0 || wallet.status !== 'active'}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Sacar via Pix
        </Button>
      </div>
    </div>
  );
};
