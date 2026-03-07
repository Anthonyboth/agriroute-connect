import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, CreditCard, Zap,
  TrendingUp, ShieldAlert, AlertTriangle
} from 'lucide-react';
import type { WalletData } from '@/hooks/useWallet';

interface SmartFinancialCardProps {
  wallet: WalletData | null;
  loading: boolean;
  error: string | null;
  creditAvailable: number;
  totalReceivable: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onUseCredit: () => void;
  onAdvance: () => void;
  role: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const SmartFinancialCard: React.FC<SmartFinancialCardProps> = ({
  wallet, loading, error, creditAvailable, totalReceivable,
  onDeposit, onWithdraw, onUseCredit, onAdvance, role
}) => {
  if (loading) {
    return (
      <Card className="shadow-md border-primary/20 overflow-hidden">
        <CardContent className="pt-6 pb-5 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
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

  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_balance || 0;
  const reserved = wallet?.reserved_balance || 0;
  const blocked = wallet?.blocked_balance || 0;
  const total = available + pending + reserved + blocked;

  // For visual bars — normalized to max of all three
  const maxBar = Math.max(totalReceivable, creditAvailable, available, 1);
  const barReceivable = (totalReceivable / maxBar) * 100;
  const barCredit = (creditAvailable / maxBar) * 100;
  const barAvailable = (available / maxBar) * 100;

  const isBlocked = wallet?.status === 'blocked';

  return (
    <Card className="shadow-md border-primary/20 overflow-hidden">
      {/* Header gradient — 60% primary zone */}
      <div className="bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/15 p-2">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Carteira AgriRoute</p>
          </div>
          {isBlocked && (
            <div className="flex items-center gap-1 text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold">Bloqueada</span>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight mt-2">{formatBRL(available)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Saldo disponível</p>
      </div>

      <CardContent className="pt-4 pb-5 space-y-5">
        {/* Three key metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg p-3 bg-primary/[0.06] border border-primary/15">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recebíveis</p>
            <p className="text-lg font-bold text-primary mt-0.5">{formatBRL(totalReceivable)}</p>
            <div className="mt-1.5"><Progress value={barReceivable} className="h-1.5" /></div>
          </div>
          <div className="rounded-lg p-3 bg-accent/[0.06] border border-accent/15">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Crédito</p>
            <p className="text-lg font-bold text-accent mt-0.5">{formatBRL(creditAvailable)}</p>
            <div className="mt-1.5"><Progress value={barCredit} className="h-1.5" /></div>
          </div>
          <div className="rounded-lg p-3 bg-muted/60 border border-border/40">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Saldo</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{formatBRL(available)}</p>
            <div className="mt-1.5"><Progress value={barAvailable} className="h-1.5" /></div>
          </div>
        </div>

        {/* Secondary balances */}
        {(pending > 0 || reserved > 0 || blocked > 0) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            {pending > 0 && <span>Pendente: <strong className="text-warning">{formatBRL(pending)}</strong></span>}
            {reserved > 0 && <span>Reservado: <strong className="text-primary">{formatBRL(reserved)}</strong></span>}
            {blocked > 0 && <span>Bloqueado: <strong className="text-destructive">{formatBRL(blocked)}</strong></span>}
          </div>
        )}

        {/* Quick actions — 10% accent zone for primary CTAs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button onClick={onDeposit} size="sm" className="text-xs gap-1.5 h-9">
            <ArrowDownToLine className="h-3.5 w-3.5" /> Adicionar
          </Button>
          <Button
            onClick={onWithdraw}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-9"
            disabled={!wallet || available <= 0 || isBlocked}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Sacar Pix
          </Button>
          <Button
            onClick={onUseCredit}
            size="sm"
            className="text-xs gap-1.5 h-9 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={creditAvailable <= 0}
          >
            <CreditCard className="h-3.5 w-3.5" /> Usar Crédito
          </Button>
          <Button
            onClick={onAdvance}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-9"
            disabled={totalReceivable <= 0}
          >
            <Zap className="h-3.5 w-3.5" /> Antecipar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
