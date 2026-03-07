import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, CreditCard, Zap,
  TrendingUp, ShieldAlert, AlertTriangle, Truck, Receipt,
  ChevronDown, ChevronUp, Lock, CheckCircle2, Clock, ArrowRight,
  Calendar, Banknote
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
  isAffiliated?: boolean;
  escrowTotal?: number;
  releasedTotal?: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const SmartFinancialCard: React.FC<SmartFinancialCardProps> = ({
  wallet, loading, error, creditAvailable, totalReceivable,
  onDeposit, onWithdraw, onUseCredit, onAdvance, role, isAffiliated = false,
  escrowTotal = 0, releasedTotal = 0
}) => {
  const [expanded, setExpanded] = useState(false);

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
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            Verifique sua conexão e tente novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_balance || 0;
  const reserved = wallet?.reserved_balance || 0;
  const blocked = wallet?.blocked_balance || 0;

  const maxBar = Math.max(totalReceivable, creditAvailable, available, 1);
  const barReceivable = (totalReceivable / maxBar) * 100;
  const barCredit = (creditAvailable / maxBar) * 100;
  const barAvailable = (available / maxBar) * 100;

  const isBlocked = wallet?.status === 'blocked';

  const canAdvance = role !== 'PRODUTOR';
  const canWithdraw = role !== 'PRODUTOR';
  const showReceivables = role !== 'PRODUTOR';

  const depositLabel = role === 'PRODUTOR' ? 'Adicionar Saldo' : 'Adicionar';
  const withdrawLabel = 'Sacar Pix';
  const primaryCTALabel = role === 'PRODUTOR' ? 'Pagar Frete' : 'Usar Crédito';
  const primaryCTAIcon = role === 'PRODUTOR' ? <Truck className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />;

  // Financial capacity
  const advanceAvailable = totalReceivable * 0.8;
  const totalCapacity = available + advanceAvailable + creditAvailable;

  // Estimated receivables forecast (simplified from reserved/pending)
  const forecastToday = Math.round(pending * 0.3);
  const forecastTomorrow = Math.round(pending * 0.4);
  const forecastLater = Math.round(pending * 0.3 + reserved * 0.2);
  const hasForecast = pending > 0 || reserved > 0;

  return (
    <Card className="shadow-md border-primary/20 overflow-hidden">
      {/* Header gradient — 60% primary zone */}
      <div className="bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/15 p-2">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Carteira AgriRoute</p>
              <p className="text-[10px] text-muted-foreground">Resumo Financeiro</p>
            </div>
          </div>
          {isBlocked && (
            <div className="flex items-center gap-1 text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold">Bloqueada</span>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight mt-2">{formatBRL(available)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Disponível para saque</p>
      </div>

      <CardContent className="pt-4 pb-5 space-y-4">
        {/* Three key metrics */}
        <div className={`grid gap-3 ${showReceivables ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {showReceivables && (
            <div className="rounded-lg p-3 bg-primary/[0.06] border border-primary/15">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recebíveis</p>
              <p className="text-lg font-bold text-primary mt-0.5">{formatBRL(totalReceivable)}</p>
              <div className="mt-1.5"><Progress value={barReceivable} className="h-1.5" /></div>
            </div>
          )}
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
            {reserved > 0 && <span>Em Escrow: <strong className="text-primary">{formatBRL(reserved)}</strong></span>}
            {blocked > 0 && <span>Bloqueado: <strong className="text-destructive">{formatBRL(blocked)}</strong></span>}
          </div>
        )}

        {/* === MONEY FLOW VISUALIZATION === */}
        {(reserved > 0 || pending > 0) && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Fluxo do Dinheiro</p>
            <div className="flex items-center justify-between gap-1">
              {[
                { icon: Truck, label: 'Frete', value: reserved + pending, color: 'text-warning', bg: 'bg-warning/10' },
                { icon: Lock, label: 'Escrow', value: reserved, color: 'text-primary', bg: 'bg-primary/10' },
                { icon: Clock, label: 'Processando', value: pending, color: 'text-warning', bg: 'bg-warning/10' },
                { icon: CheckCircle2, label: 'Disponível', value: available, color: 'text-primary', bg: 'bg-primary/10' },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <React.Fragment key={step.label}>
                    {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                    <div className="flex-1 min-w-0 text-center">
                      <div className={`mx-auto w-7 h-7 rounded-full ${step.bg} flex items-center justify-center mb-1`}>
                        <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{step.label}</p>
                      <p className={`text-[10px] font-bold ${step.color}`}>{formatBRL(step.value)}</p>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable section */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? 'Menos detalhes' : 'Previsão e capacidade financeira'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* === RECEIVABLE FORECAST === */}
            {hasForecast && showReceivables && (
              <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recebimentos Previstos</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Hoje', value: forecastToday },
                    { label: 'Amanhã', value: forecastTomorrow },
                    { label: 'Em 3 dias', value: forecastLater },
                  ].filter(f => f.value > 0).map(f => (
                    <div key={f.label} className="text-center p-2 rounded-md bg-muted/40">
                      <p className="text-[10px] text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-bold text-foreground">{formatBRL(f.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === TOTAL FINANCIAL CAPACITY === */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capacidade Financeira</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" /> Disponível agora
                  </span>
                  <span className="text-sm font-bold text-foreground">{formatBRL(available)}</span>
                </div>
                {showReceivables && advanceAvailable > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> Com antecipação
                    </span>
                    <span className="text-sm font-bold text-primary">{formatBRL(available + advanceAvailable)}</span>
                  </div>
                )}
                {creditAvailable > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" /> Com crédito
                    </span>
                    <span className="text-sm font-bold text-accent">{formatBRL(totalCapacity)}</span>
                  </div>
                )}
                {totalCapacity > available && (
                  <>
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-foreground">Capacidade total</span>
                      <span className="text-base font-bold text-foreground">{formatBRL(totalCapacity)}</span>
                    </div>
                    {/* Stacked bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      {available > 0 && <div className="h-full bg-foreground/30" style={{ width: `${(available / totalCapacity) * 100}%` }} />}
                      {advanceAvailable > 0 && showReceivables && <div className="h-full bg-primary/60" style={{ width: `${(advanceAvailable / totalCapacity) * 100}%` }} />}
                      {creditAvailable > 0 && <div className="h-full bg-accent/60" style={{ width: `${(creditAvailable / totalCapacity) * 100}%` }} />}
                    </div>
                    <div className="flex gap-3 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground/30" /> Saldo</span>
                      {showReceivables && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60" /> Antecipação</span>}
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/60" /> Crédito</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Affiliated driver warning */}
        {isAffiliated && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/[0.08] border border-warning/20">
            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Motorista afiliado — você gerencia apenas seu saldo pessoal. Valores da transportadora não aparecem aqui.
            </p>
          </div>
        )}

        {/* Quick actions — 10% accent zone for primary CTAs */}
        <div className={`grid gap-2 ${canAdvance ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
          <Button onClick={onDeposit} size="sm" className="text-xs gap-1.5 h-9">
            <ArrowDownToLine className="h-3.5 w-3.5" /> {depositLabel}
          </Button>
          {canWithdraw && (
            <Button
              onClick={onWithdraw}
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-9"
              disabled={!wallet || available <= 0 || isBlocked}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" /> {withdrawLabel}
            </Button>
          )}
          <Button
            onClick={onUseCredit}
            size="sm"
            className="text-xs gap-1.5 h-9 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={creditAvailable <= 0}
          >
            {primaryCTAIcon} {primaryCTALabel}
          </Button>
          {canAdvance && (
            <Button
              onClick={onAdvance}
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-9"
              disabled={totalReceivable <= 0}
            >
              <Zap className="h-3.5 w-3.5" /> Antecipar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
